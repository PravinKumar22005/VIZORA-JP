from fastapi import HTTPException
from db import SessionLocal
from models.chat import Chat
from models.message import Message
from models.file_metadata import FileMetadata


def delete_chat_permanently(user_id: int, chat_id: int):
    db = SessionLocal()
    try:
        chat = (
            db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == user_id).first()
        )
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")

        # Delete all messages for this chat
        db.query(Message).filter(Message.chat_id == chat_id).delete()
        # Delete all files for this chat
        db.query(FileMetadata).filter(FileMetadata.chat_id == chat_id).delete()

        db.delete(chat)
        db.commit()
        return {"detail": "Chat permanently deleted"}
    finally:
        db.close()
