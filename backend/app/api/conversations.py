import json
import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import ensure_conversation_owner, get_current_user_optional
from app.core.database import get_db_session
from app.models import Conversation, ConversationMessage, User
from app.schemas import (
    ConversationCreateRequest,
    ConversationDashboardUpdateRequest,
    ConversationDetailResponse,
    ConversationMessageResponse,
    ConversationSummaryResponse,
    ConversationUpdateRequest,
    ShareLinkRequest,
    ShareLinkResponse,
)


router = APIRouter(prefix="/conversations", tags=["conversations"])


def _safe_json_list(value: str | None) -> list[dict[str, object]]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return [item for item in parsed if isinstance(item, dict)]
    except json.JSONDecodeError:
        return []
    return []


def _to_summary(conversation: Conversation) -> ConversationSummaryResponse:
    return ConversationSummaryResponse(
        id=conversation.id,
        title=conversation.title,
        dataset_id=conversation.dataset_id,
        created_at=conversation.created_at.isoformat(),
        updated_at=conversation.updated_at.isoformat(),
        dashboard_layout=_safe_json_list(conversation.dashboard_layout),
        dashboard_items=_safe_json_list(conversation.dashboard_items),
    )


@router.get("", response_model=list[ConversationSummaryResponse])
def list_conversations(
    db: Session = Depends(get_db_session),
    current_user: User | None = Depends(get_current_user_optional),
) -> list[ConversationSummaryResponse]:
    query = db.query(Conversation)
    if current_user is None:
        query = query.filter(Conversation.user_id.is_(None))
    else:
        query = query.filter(Conversation.user_id == current_user.id)
    conversations = query.order_by(Conversation.updated_at.desc()).all()
    return [_to_summary(item) for item in conversations]


@router.post("", response_model=ConversationSummaryResponse)
def create_conversation(
    request: ConversationCreateRequest,
    db: Session = Depends(get_db_session),
    current_user: User | None = Depends(get_current_user_optional),
) -> ConversationSummaryResponse:
    title = (request.title or "").strip() or "New chat"
    conversation = Conversation(
        title=title,
        dataset_id=request.dataset_id,
        user_id=current_user.id if current_user else None,
        dashboard_layout="[]",
        dashboard_items="[]",
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return _to_summary(conversation)


@router.get("/{conversation_id}", response_model=ConversationDetailResponse)
def get_conversation(
    conversation_id: str,
    db: Session = Depends(get_db_session),
    current_user: User | None = Depends(get_current_user_optional),
) -> ConversationDetailResponse:
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    ensure_conversation_owner(conversation, current_user)

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
    current_user: User | None = Depends(get_current_user_optional),
) -> ConversationSummaryResponse:
    title = request.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="title cannot be empty")

    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    ensure_conversation_owner(conversation, current_user)

    conversation.title = title
    db.commit()
    db.refresh(conversation)
    return _to_summary(conversation)


@router.delete("/{conversation_id}")
def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db_session),
    current_user: User | None = Depends(get_current_user_optional),
) -> dict[str, bool]:
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    ensure_conversation_owner(conversation, current_user)

    db.delete(conversation)
    db.commit()
    return {"ok": True}


@router.patch("/{conversation_id}/dashboard", response_model=ConversationSummaryResponse)
def update_dashboard(
    conversation_id: str,
    request: ConversationDashboardUpdateRequest,
    db: Session = Depends(get_db_session),
    current_user: User | None = Depends(get_current_user_optional),
) -> ConversationSummaryResponse:
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    ensure_conversation_owner(conversation, current_user)

    conversation.dashboard_layout = json.dumps(request.dashboard_layout)
    conversation.dashboard_items = json.dumps(request.dashboard_items)
    db.commit()
    db.refresh(conversation)
    return _to_summary(conversation)


@router.post("/{conversation_id}/share", response_model=ShareLinkResponse)
def create_share_link(
    conversation_id: str,
    request: ShareLinkRequest,
    db: Session = Depends(get_db_session),
    current_user: User | None = Depends(get_current_user_optional),
) -> ShareLinkResponse:
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    ensure_conversation_owner(conversation, current_user)
    if current_user is None:
        raise HTTPException(status_code=401, detail="Sign in to create a share link")

    token = secrets.token_urlsafe(24)
    conversation.share_token = token
    conversation.share_permission = request.permission
    db.commit()
    return ShareLinkResponse(token=token, permission=request.permission)


@router.delete("/{conversation_id}/share")
def revoke_share_link(
    conversation_id: str,
    db: Session = Depends(get_db_session),
    current_user: User | None = Depends(get_current_user_optional),
) -> dict[str, bool]:
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    ensure_conversation_owner(conversation, current_user)
    if current_user is None:
        raise HTTPException(status_code=401, detail="Sign in to revoke share link")

    conversation.share_token = None
    conversation.share_permission = None
    db.commit()
    return {"ok": True}
