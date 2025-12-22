from fastapi import HTTPException
from db import SessionLocal
from models.message import Message


def delete_message_permanently(user_id: int, message_id: int):
    db = SessionLocal()
    try:
        message = db.query(Message).filter(Message.id == message_id).first()
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")
        db.delete(message)
        db.commit()
        return {"detail": "Message permanently deleted"}
    finally:
        db.close()
