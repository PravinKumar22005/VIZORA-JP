from fastapi import HTTPException
from db import SessionLocal
from models.shared_chat import SharedChat


def delete_shared_chat_permanently(user_id: int, shared_chat_id: int):
    db = SessionLocal()
    try:
        shared_chat = (
            db.query(SharedChat).filter(SharedChat.id == shared_chat_id).first()
        )
        if not shared_chat:
            raise HTTPException(status_code=404, detail="Shared chat not found")
        db.delete(shared_chat)
        db.commit()
        return {"detail": "Shared chat permanently deleted"}
    finally:
        db.close()
