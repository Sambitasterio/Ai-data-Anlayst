from app.api.agent import router as agent_router
from app.api.chat import router as chat_router
from app.api.conversations import router as conversations_router
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.upload import router as upload_router
from app.core.config import get_settings
from app.core.database import Base, engine
from app import models  # noqa: F401


settings = get_settings()

app = FastAPI(title=settings.app_name, version=settings.app_version)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.on_event("startup")
def init_database() -> None:
    Base.metadata.create_all(bind=engine)
    with engine.begin() as connection:
        conversation_columns = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info(conversations)")).fetchall()
        }
        if "dashboard_layout" not in conversation_columns:
            connection.execute(
                text(
                    "ALTER TABLE conversations ADD COLUMN dashboard_layout TEXT NOT NULL DEFAULT '[]'"
                )
            )
        if "dashboard_items" not in conversation_columns:
            connection.execute(
                text(
                    "ALTER TABLE conversations ADD COLUMN dashboard_items TEXT NOT NULL DEFAULT '[]'"
                )
            )


app.include_router(upload_router)
app.include_router(agent_router)
app.include_router(chat_router)
app.include_router(conversations_router)
