from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.agent.graph import ask_dataset
from app.core.database import get_db_session
from app.core.sql_context import build_schema_context_for_dataset_id
from app.schemas import AskRequest, AskResponse


router = APIRouter(tags=["agent"])


@router.post("/ask", response_model=AskResponse)
def ask(request: AskRequest, db: Session = Depends(get_db_session)) -> AskResponse:
    try:
        question = request.question
        schema_context = build_schema_context_for_dataset_id(
            dataset_id=request.dataset_id,
            db=db,
        )
        if schema_context:
            question = f"{schema_context}\n\nQuestion: {request.question}"
        result = ask_dataset(question=question, dataset_id=request.dataset_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Dataset not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return AskResponse(answer=result["answer"], sql=result["sql"])
