from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.core.config import get_settings
from app.core.duckdb_engine import get_duckdb_engine
from app.schemas import DatasetInfo, DatasetPreviewResponse


router = APIRouter(tags=["datasets"])

SUPPORTED_EXTENSIONS = {".csv", ".xls", ".xlsx"}


@router.post("/upload", response_model=DatasetInfo)
async def upload_file(file: UploadFile = File(...)) -> DatasetInfo:
    file_name = file.filename or ""
    suffix = Path(file_name).suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Allowed: .csv, .xls, .xlsx",
        )

    settings = get_settings()
    temp_file_path = settings.uploads_dir / f"tmp_{uuid4()}{suffix}"
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)

    content = await file.read()
    temp_file_path.write_bytes(content)

    try:
        record = get_duckdb_engine(settings.uploads_dir).register_upload(
            source_path=temp_file_path,
            original_name=file_name,
        )
    except Exception as exc:
        if temp_file_path.exists():
            temp_file_path.unlink()
        raise HTTPException(status_code=400, detail=f"Failed to process file: {exc}") from exc

    return DatasetInfo(
        id=record.id,
        file_name=record.file_name,
        stored_file_name=record.stored_file_name,
        view_name=record.view_name,
        columns=record.columns,
    )


@router.get("/datasets", response_model=list[DatasetInfo])
def list_datasets() -> list[DatasetInfo]:
    settings = get_settings()
    datasets = get_duckdb_engine(settings.uploads_dir).list_datasets()
    return [
        DatasetInfo(
            id=dataset.id,
            file_name=dataset.file_name,
            stored_file_name=dataset.stored_file_name,
            view_name=dataset.view_name,
            columns=dataset.columns,
        )
        for dataset in datasets
    ]


@router.get("/datasets/{dataset_id}/preview", response_model=DatasetPreviewResponse)
def preview_dataset(dataset_id: str) -> DatasetPreviewResponse:
    settings = get_settings()
    engine = get_duckdb_engine(settings.uploads_dir)
    try:
        rows = engine.preview_dataset(dataset_id=dataset_id, limit=20)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Dataset not found") from exc

    return DatasetPreviewResponse(dataset_id=dataset_id, rows=rows)
