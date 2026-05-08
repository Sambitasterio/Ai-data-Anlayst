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
