import json
from collections.abc import Iterator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.agent.graph import ask_dataset
from app.schemas import ChatRequest


router = APIRouter(tags=["chat"])


def _sse_event(event: str, payload: dict[str, object]) -> str:
    return f"event: {event}\ndata: {json.dumps(payload)}\n\n"


def _chat_stream(question: str, dataset_id: str) -> Iterator[str]:
    yield _sse_event("thought", {"message": "Analyzing your question"})
    yield _sse_event("thought", {"message": "Running tools on selected dataset"})

    result = ask_dataset(question=question, dataset_id=dataset_id)
    yield _sse_event("final", {"answer": result["answer"], "sql": result["sql"]})
    yield _sse_event("done", {"ok": True})


@router.post("/chat")
def chat(request: ChatRequest) -> StreamingResponse:
    if not request.messages:
        raise HTTPException(status_code=400, detail="messages cannot be empty")

    user_messages = [message for message in request.messages if message.role == "user"]
    if not user_messages:
        raise HTTPException(status_code=400, detail="at least one user message is required")

    latest_user_message = user_messages[-1].content.strip()
    if not latest_user_message:
        raise HTTPException(status_code=400, detail="latest user message cannot be empty")

    stream = _chat_stream(question=latest_user_message, dataset_id=request.dataset_id)
    return StreamingResponse(stream, media_type="text/event-stream")
