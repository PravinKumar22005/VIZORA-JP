from typing import List

from fastapi import HTTPException

from db import SessionLocal
from models.chat import Chat
from models.file_metadata import FileMetadata
from models.message import Message


def create_chat(user_id: int, title: str):
    db = SessionLocal()
    try:
        chat = Chat(user_id=user_id, title=title)
        db.add(chat)
        db.commit()
        db.refresh(chat)
        return {"id": chat.id, "title": chat.title, "created_at": chat.created_at}
    finally:
        db.close()


def list_chats(user_id: int):
    db = SessionLocal()
    try:
        chats = (
            db.query(Chat)
            .filter(Chat.user_id == user_id)
            .order_by(Chat.created_at.desc())
            .all()
        )
        return [
            {"id": c.id, "title": c.title, "created_at": c.created_at} for c in chats
        ]
    finally:
        db.close()


def add_message(user_id: int, chat_id: int, text: str, sender: str):
    db = SessionLocal()
    try:
        chat = (
            db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == user_id).first()
        )
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        msg = Message(chat_id=chat_id, sender=sender, text=text)
        db.add(msg)
        db.commit()
        db.refresh(msg)
        return {
            "id": msg.id,
            "sender": msg.sender,
            "text": msg.text,
            "created_at": msg.created_at,
        }
    finally:
        db.close()


def get_messages(user_id: int, chat_id: int):
    db = SessionLocal()
    try:
        chat = (
            db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == user_id).first()
        )
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        messages = (
            db.query(Message)
            .filter(Message.chat_id == chat_id)
            .order_by(Message.created_at)
            .all()
        )
        return [
            {"id": m.id, "sender": m.sender, "text": m.text, "created_at": m.created_at}
            for m in messages
        ]
    finally:
        db.close()


def add_file_metadata(
    user_id: int,
    chat_id: int,
    file_name: str,
    file_size: int,
    file_type: str,
    columns: list,
    num_rows: int,
    num_columns: int,
    summary_stats: dict,
    bucket_path: str,
    table_names: list = None,
):
    db = SessionLocal()
    try:
        file_meta = FileMetadata(
            user_id=user_id,
            chat_id=chat_id,
            file_name=file_name,
            file_size=file_size,
            file_type=file_type,
            columns=columns,
            num_rows=num_rows,
            num_columns=num_columns,
            summary_stats=summary_stats,
            bucket_path=bucket_path,
            table_names=table_names,
        )
        db.add(file_meta)
        db.commit()
        db.refresh(file_meta)
        return {
            "id": file_meta.id,
            "file_name": file_meta.file_name,
            "file_size": file_meta.file_size,
            "file_type": file_meta.file_type,
            "columns": file_meta.columns,
            "num_rows": file_meta.num_rows,
            "num_columns": file_meta.num_columns,
            "summary_stats": file_meta.summary_stats,
            "bucket_path": file_meta.bucket_path,
            "table_names": file_meta.table_names,
            "uploaded_at": file_meta.uploaded_at,
        }
    finally:
        db.close()

def list_file_metadata(user_id: int, chat_id: int):
    db = SessionLocal()
    try:
        chat = (
            db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == user_id).first()
        )
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        files = (
            db.query(FileMetadata)
            .filter(FileMetadata.chat_id == chat_id)
            .order_by(FileMetadata.uploaded_at)
            .all()
        )
        return [
            {
                "id": f.id,
                "file_name": f.file_name,
                "file_size": f.file_size,
                "file_type": f.file_type,
                "columns": f.columns,
                "num_rows": f.num_rows,
                "num_columns": f.num_columns,
                "summary_stats": f.summary_stats,
                "bucket_path": f.bucket_path,
                "table_names": f.table_names,
                "uploaded_at": f.uploaded_at,
            }
            for f in files
        ]
    finally:
        db.close()
