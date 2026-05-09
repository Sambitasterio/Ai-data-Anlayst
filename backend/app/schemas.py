from typing import Literal

from pydantic import BaseModel, Field


class DatasetColumn(BaseModel):
    name: str
    dtype: str


class DatasetInfo(BaseModel):
    id: str
    file_name: str
    stored_file_name: str
    view_name: str
    columns: list[DatasetColumn]


class DatasetPreviewResponse(BaseModel):
    dataset_id: str
    rows: list[dict[str, object]]


class AskRequest(BaseModel):
    dataset_id: str
    question: str


class AskResponse(BaseModel):
    answer: str
    sql: str


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    dataset_id: str
    messages: list[ChatMessage]
    conversation_id: str | None = None


class ConversationCreateRequest(BaseModel):
    title: str | None = None
    dataset_id: str | None = None


class ConversationUpdateRequest(BaseModel):
    title: str


class ConversationDashboardUpdateRequest(BaseModel):
    dashboard_layout: list[dict[str, object]]
    dashboard_items: list[dict[str, object]]


class ConversationMessageResponse(BaseModel):
    id: str
    role: str
    content: str
    created_at: str


class ConversationSummaryResponse(BaseModel):
    id: str
    title: str
    dataset_id: str | None
    created_at: str
    updated_at: str
    dashboard_layout: list[dict[str, object]] = Field(default_factory=list)
    dashboard_items: list[dict[str, object]] = Field(default_factory=list)


class ConversationDetailResponse(ConversationSummaryResponse):
    messages: list[ConversationMessageResponse]


class UserPublicResponse(BaseModel):
    id: str
    email: str
    name: str | None = None


class ShareLinkRequest(BaseModel):
    permission: Literal["view", "edit"]


class ShareLinkResponse(BaseModel):
    token: str
    permission: str


class SharedDashboardResponse(BaseModel):
    conversation_id: str
    title: str
    permission: str
    dashboard_layout: list[dict[str, object]] = Field(default_factory=list)
    dashboard_items: list[dict[str, object]] = Field(default_factory=list)


class SQLConnectionConnectRequest(BaseModel):
    db_type: str
    host: str | None = None
    port: int | None = None
    username: str | None = None
    password: str | None = None
    database: str | None = None
    sqlite_path: str | None = None
    name: str | None = None


class SQLColumnSchema(BaseModel):
    name: str
    type: str


class SQLTableSchema(BaseModel):
    table: str
    columns: list[SQLColumnSchema]


class SQLConnectionSummaryResponse(BaseModel):
    id: str
    name: str
    db_type: str
    is_active: bool


class SQLConnectionStatusResponse(BaseModel):
    connection: SQLConnectionSummaryResponse | None
    schema: list[SQLTableSchema]
