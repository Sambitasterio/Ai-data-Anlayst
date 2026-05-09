import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db_session
from app.models import Conversation
from app.schemas import ConversationDashboardUpdateRequest, SharedDashboardResponse

router = APIRouter(prefix="/shared", tags=["shared"])


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


@router.get("/{token}", response_model=SharedDashboardResponse)
def get_shared_dashboard(token: str, db: Session = Depends(get_db_session)) -> SharedDashboardResponse:
    conversation = db.query(Conversation).filter(Conversation.share_token == token).first()
    if conversation is None or not conversation.share_permission:
        raise HTTPException(status_code=404, detail="Share link not found or revoked")

    return SharedDashboardResponse(
        conversation_id=conversation.id,
        title=conversation.title,
        permission=conversation.share_permission,
        dashboard_layout=_safe_json_list(conversation.dashboard_layout),
        dashboard_items=_safe_json_list(conversation.dashboard_items),
    )


@router.patch("/{token}/dashboard", response_model=SharedDashboardResponse)
def patch_shared_dashboard(
    token: str,
    request: ConversationDashboardUpdateRequest,
    db: Session = Depends(get_db_session),
) -> SharedDashboardResponse:
    conversation = db.query(Conversation).filter(Conversation.share_token == token).first()
    if conversation is None or not conversation.share_permission:
        raise HTTPException(status_code=404, detail="Share link not found or revoked")
    if conversation.share_permission != "edit":
        raise HTTPException(status_code=403, detail="This share link is view-only")

    conversation.dashboard_layout = json.dumps(request.dashboard_layout)
    conversation.dashboard_items = json.dumps(request.dashboard_items)
    db.commit()
    db.refresh(conversation)

    return SharedDashboardResponse(
        conversation_id=conversation.id,
        title=conversation.title,
        permission=conversation.share_permission,
        dashboard_layout=_safe_json_list(conversation.dashboard_layout),
        dashboard_items=_safe_json_list(conversation.dashboard_items),
    )
