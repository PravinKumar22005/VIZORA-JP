from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from models.user import User
from utils.jwt import get_current_user
from db import SessionLocal
from models.file_metadata import FileMetadata
from services.ai_services import ask_ai

router = APIRouter()


class AIAskRequest(BaseModel):
    question: str
    file_id: Optional[int] = None


@router.post("/ai/ask")
def ai_ask(req: AIAskRequest, user: User = Depends(get_current_user)):
    metadata = None
    if req.file_id:
        db = SessionLocal()
        file_meta = (
            db.query(FileMetadata)
            .filter(FileMetadata.id == req.file_id, FileMetadata.user_id == user.id)
            .first()
        )
        db.close()
        if not file_meta:
            raise HTTPException(status_code=404, detail="File not found")
        metadata = {
            "columns": file_meta.columns,
            "num_rows": file_meta.num_rows,
            "num_columns": file_meta.num_columns,
            "summary_stats": file_meta.summary_stats,
            "table_names": file_meta.table_names,
        }
    # If no metadata, pass None or empty dict
    return {"answer": ask_ai(req.question, metadata)}
