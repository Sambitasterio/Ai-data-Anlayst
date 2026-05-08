from fastapi import APIRouter, HTTPException

from app.agent.graph import ask_dataset
from app.schemas import AskRequest, AskResponse


router = APIRouter(tags=["agent"])


@router.post("/ask", response_model=AskResponse)
def ask(request: AskRequest) -> AskResponse:
    try:
        result = ask_dataset(question=request.question, dataset_id=request.dataset_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Dataset not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return AskResponse(answer=result["answer"], sql=result["sql"])
