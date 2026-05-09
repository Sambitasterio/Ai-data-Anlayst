from pydantic import BaseModel


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


class ConversationDetailResponse(ConversationSummaryResponse):
    messages: list[ConversationMessageResponse]
