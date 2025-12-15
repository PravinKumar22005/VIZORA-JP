from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from models.user import User
from utils.jwt import get_current_user
from db import SessionLocal
from models.file_metadata import FileMetadata
from services.ai_services import ask_ai
from controllers.chat_controller import add_message

router = APIRouter()


class AIAskRequest(BaseModel):
    question: str
    file_id: Optional[int] = None
    file_ids: Optional[List[int]] = None
    chat_id: Optional[int] = None  # Added chat_id field


@router.post("/ai/ask")
def ai_ask(req: AIAskRequest, user: User = Depends(get_current_user)):
    db = SessionLocal()
    metadata = None
    chat_id = (
        req.chat_id
    )  # <-- You need to add chat_id to AIAskRequest and frontend payload

    if req.file_ids:
        metadata = {}
        for idx, fid in enumerate(req.file_ids):
            file_meta = (
                db.query(FileMetadata)
                .filter(FileMetadata.id == fid, FileMetadata.user_id == user.id)
                .first()
            )
            if not file_meta:
                db.close()
                raise HTTPException(status_code=404, detail=f"File {fid} not found")
            metadata[f"df{idx+1}"] = {
                "columns": file_meta.columns,
                "num_rows": file_meta.num_rows,
                "num_columns": file_meta.num_columns,
                "summary_stats": file_meta.summary_stats,
                "table_names": file_meta.table_names,
            }
        db.close()
    elif req.file_id:
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
    # If neither, metadata remains None

    answer = ask_ai(req.question, metadata)

    # Save bot's response to the database
    if chat_id and answer and answer.get("answer"):
        bot_response_text = answer["answer"]
        if answer.get("sql"):
            bot_response_text += f"\n```sql\n{answer['sql']}\n```"
        add_message(
            user_id=user.id, chat_id=chat_id, text=bot_response_text, sender="bot"
        )

    # The frontend is responsible for saving the user and bot messages.
    # The AI router's only job is to get the answer.
    return answer
