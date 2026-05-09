from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.core.auth_jwt import decode_token
from app.core.database import get_db_session
from app.models import Conversation, User


def get_current_user_optional(
    authorization: str | None = Header(None),
    db: Session = Depends(get_db_session),
) -> User | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    user_id = decode_token(token)
    if not user_id:
        return None
    return db.query(User).filter(User.id == user_id).first()


def get_current_user(
    user: User | None = Depends(get_current_user_optional),
) -> User:
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def ensure_conversation_owner(
    conversation: Conversation,
    user: User | None,
) -> None:
    if conversation.user_id is None:
        return
    if user is None or conversation.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not allowed to access this conversation")


def ensure_chat_access(
    conversation: Conversation,
    user: User | None,
) -> None:
    """Legacy conversations (no owner) stay open; owned ones require the same user."""
    ensure_conversation_owner(conversation, user)
