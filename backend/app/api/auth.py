import secrets

from fastapi import APIRouter, Depends, Header, HTTPException
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.auth_jwt import create_access_token
from app.core.config import get_settings
from app.core.database import get_db_session
from app.models import User

router = APIRouter(prefix="/auth", tags=["auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str | None

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class OAuthSyncRequest(BaseModel):
    email: EmailStr
    name: str | None = None
    image: str | None = None


@router.post("/register", response_model=TokenResponse)
def register(body: RegisterRequest, db: Session = Depends(get_db_session)) -> TokenResponse:
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    existing = db.query(User).filter(User.email == body.email.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=body.email.lower(),
        password_hash=pwd_context.hash(body.password),
        name=(body.name or "").strip() or None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db_session)) -> TokenResponse:
    user = db.query(User).filter(User.email == body.email.lower()).first()
    if user is None or not user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not pwd_context.verify(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/oauth-sync", response_model=TokenResponse)
def oauth_sync(
    body: OAuthSyncRequest,
    x_auth_sync: str | None = Header(None, alias="X-Auth-Sync-Secret"),
    db: Session = Depends(get_db_session),
) -> TokenResponse:
    settings = get_settings()
    if not settings.auth_sync_secret or x_auth_sync != settings.auth_sync_secret:
        raise HTTPException(status_code=401, detail="Invalid sync secret")
    email = body.email.lower()
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        user = User(
            email=email,
            password_hash=None,
            name=(body.name or "").strip() or None,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    elif body.name and not user.name:
        user.name = body.name.strip()
        db.commit()
        db.refresh(user)
    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))
