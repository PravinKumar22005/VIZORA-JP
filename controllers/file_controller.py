from fastapi import HTTPException
from db import SessionLocal
from models.file_metadata import FileMetadata


def delete_file_permanently(user_id: int, file_id: int):
    db = SessionLocal()
    try:
        file = (
            db.query(FileMetadata)
            .filter(FileMetadata.id == file_id, FileMetadata.user_id == user_id)
            .first()
        )
        if not file:
            raise HTTPException(status_code=404, detail="File not found")
        db.delete(file)
        db.commit()
        return {"detail": "File permanently deleted"}
    finally:
        db.close()
