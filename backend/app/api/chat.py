import json
from collections.abc import Iterator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.agent.graph import ask_dataset
from app.api.deps import get_current_user_optional, ensure_chat_access
from app.core.database import get_db_session
from app.core.sql_context import (
    build_schema_context_for_dataset_id,
    build_uploaded_dataset_schema_context,
)
from app.models import Conversation, ConversationMessage, User
from app.schemas import ChatRequest


router = APIRouter(tags=["chat"])


def _sse_event(event: str, payload: dict[str, object]) -> str:
    return f"event: {event}\ndata: {json.dumps(payload)}\n\n"


def _build_contextual_question(
    previous_messages: list[ConversationMessage],
    latest_user_message: str,
) -> str:
    if not previous_messages:
        return latest_user_message

    window = previous_messages[-8:]
    history_lines = [f"{message.role.title()}: {message.content}" for message in window]
    history = "\n".join(history_lines)
    return (
        "Use the conversation history for context, but only answer the final user question.\n\n"
        f"Conversation history:\n{history}\n\n"
        f"Final user question: {latest_user_message}"
    )


def _chat_stream(
    question: str,
    dataset_id: str,
    conversation: Conversation,
    db: Session,
) -> Iterator[str]:
    try:
        history_messages = (
            db.query(ConversationMessage)
            .filter(ConversationMessage.conversation_id == conversation.id)
            .order_by(ConversationMessage.created_at.asc())
            .all()
        )
        contextual_question = _build_contextual_question(history_messages, question)
        schema_context = build_schema_context_for_dataset_id(dataset_id=dataset_id, db=db)
        if not schema_context:
            schema_context = build_uploaded_dataset_schema_context(dataset_id)
        if schema_context:
            contextual_question = f"{schema_context}\n\n{contextual_question}"

        user_message = ConversationMessage(
            conversation_id=conversation.id,
            role="user",
            content=question,
        )
        db.add(user_message)
        db.commit()

        result = ask_dataset(question=contextual_question, dataset_id=dataset_id)
        transitions = result.get("transitions", [])
        for node in transitions:
            yield _sse_event("thought", {"message": f"{node} node"})

        assistant_answer = result["answer"]
        assistant_message = ConversationMessage(
            conversation_id=conversation.id,
            role="assistant",
            content=assistant_answer,
        )
        db.add(assistant_message)
        conversation.dataset_id = dataset_id
        db.commit()
        db.refresh(conversation)

        yield _sse_event(
            "final",
            {
                "answer": assistant_answer,
                "sql": result["sql"],
                "python": result.get("python", ""),
                "warning": result.get("warning", ""),
                "conversation_id": conversation.id,
                "conversation_title": conversation.title,
            },
        )
    except KeyError:
        yield _sse_event(
            "final",
            {
                "answer": (
                    "Dataset not found. Please upload the file again and use the new dataset_id."
                ),
                "sql": "",
                "python": "",
                "warning": "",
                "conversation_id": conversation.id,
                "conversation_title": conversation.title,
            },
        )
    except Exception as exc:
        yield _sse_event(
            "final",
            {
                "answer": f"Chat processing failed: {exc}",
                "sql": "",
                "python": "",
                "warning": "",
                "conversation_id": conversation.id,
                "conversation_title": conversation.title,
            },
        )
    yield _sse_event("done", {"ok": True})


@router.post("/chat")
def chat(
    request: ChatRequest,
    db: Session = Depends(get_db_session),
    current_user: User | None = Depends(get_current_user_optional),
) -> StreamingResponse:
    if not request.messages:
        raise HTTPException(status_code=400, detail="messages cannot be empty")

    user_messages = [message for message in request.messages if message.role == "user"]
    if not user_messages:
        raise HTTPException(status_code=400, detail="at least one user message is required")

    latest_user_message = user_messages[-1].content.strip()
    if not latest_user_message:
        raise HTTPException(status_code=400, detail="latest user message cannot be empty")

    conversation: Conversation | None = None
    if request.conversation_id:
        conversation = (
            db.query(Conversation).filter(Conversation.id == request.conversation_id).first()
        )
        if conversation is None:
            raise HTTPException(status_code=404, detail="Conversation not found")
        ensure_chat_access(conversation, current_user)

    if conversation is None:
        generated_title = latest_user_message[:60].strip() or "New chat"
        conversation = Conversation(
            title=generated_title,
            dataset_id=request.dataset_id,
            user_id=current_user.id if current_user else None,
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)

    stream = _chat_stream(
        question=latest_user_message,
        dataset_id=request.dataset_id,
        conversation=conversation,
        db=db,
    )
    return StreamingResponse(stream, media_type="text/event-stream")
