from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db import SessionLocal
from models.chat import Chat
from models.shared_chat import SharedChat
from models.user import User
from utils.jwt import get_current_user

router = APIRouter()


@router.post("/chats/{chat_id}/share")
def share_chat(
    chat_id: int,
    db: Session = Depends(SessionLocal),
    current_user: User = Depends(get_current_user),
):
    chat = (
        db.query(Chat)
        .filter(Chat.id == chat_id, Chat.user_id == current_user.id)
        .first()
    )
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    shared_chat = SharedChat(chat_id=chat.id)
    db.add(shared_chat)
    db.commit()
    db.refresh(shared_chat)
    return {"share_code": shared_chat.share_code}


@router.get("/chats/shared/{share_code}")
def get_shared_chat(share_code: str, db: Session = Depends(SessionLocal)):
    shared_chat = (
        db.query(SharedChat).filter(SharedChat.share_code == share_code).first()
    )
    if not shared_chat:
        raise HTTPException(status_code=404, detail="Shared chat not found")

    chat = db.query(Chat).filter(Chat.id == shared_chat.chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Original chat not found")

    return chat
