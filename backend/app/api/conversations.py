from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db_session
from app.models import Conversation, ConversationMessage
from app.schemas import (
    ConversationCreateRequest,
    ConversationDetailResponse,
    ConversationMessageResponse,
    ConversationSummaryResponse,
    ConversationUpdateRequest,
)


router = APIRouter(prefix="/conversations", tags=["conversations"])


def _to_summary(conversation: Conversation) -> ConversationSummaryResponse:
    return ConversationSummaryResponse(
        id=conversation.id,
        title=conversation.title,
        dataset_id=conversation.dataset_id,
        created_at=conversation.created_at.isoformat(),
        updated_at=conversation.updated_at.isoformat(),
    )


@router.get("", response_model=list[ConversationSummaryResponse])
def list_conversations(db: Session = Depends(get_db_session)) -> list[ConversationSummaryResponse]:
    conversations = db.query(Conversation).order_by(Conversation.updated_at.desc()).all()
    return [_to_summary(item) for item in conversations]


@router.post("", response_model=ConversationSummaryResponse)
def create_conversation(
    request: ConversationCreateRequest,
    db: Session = Depends(get_db_session),
) -> ConversationSummaryResponse:
    title = (request.title or "").strip() or "New chat"
    conversation = Conversation(
        title=title,
        dataset_id=request.dataset_id,
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return _to_summary(conversation)


@router.get("/{conversation_id}", response_model=ConversationDetailResponse)
def get_conversation(
    conversation_id: str,
    db: Session = Depends(get_db_session),
) -> ConversationDetailResponse:
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages = db.query(ConversationMessage).filter(
        ConversationMessage.conversation_id == conversation_id
    ).order_by(ConversationMessage.created_at.asc()).all()

    return ConversationDetailResponse(
        **_to_summary(conversation).model_dump(),
        messages=[
            ConversationMessageResponse(
                id=message.id,
                role=message.role,
                content=message.content,
                created_at=message.created_at.isoformat(),
            )
            for message in messages
        ],
    )


@router.patch("/{conversation_id}", response_model=ConversationSummaryResponse)
def rename_conversation(
    conversation_id: str,
    request: ConversationUpdateRequest,
    db: Session = Depends(get_db_session),
) -> ConversationSummaryResponse:
    title = request.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="title cannot be empty")

    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conversation.title = title
    db.commit()
    db.refresh(conversation)
    return _to_summary(conversation)


@router.delete("/{conversation_id}")
def delete_conversation(conversation_id: str, db: Session = Depends(get_db_session)) -> dict[str, bool]:
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    db.delete(conversation)
    db.commit()
    return {"ok": True}
