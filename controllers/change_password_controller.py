from db import SessionLocal
from models.user import User
from utils.auth import get_password_hash, verify_password
from fastapi import HTTPException

def change_password(email: str, old_password: str, new_password: str):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        if not verify_password(old_password, user.password):
            raise HTTPException(status_code=401, detail="Invalid old password")
            
        user.password = get_password_hash(new_password)
        db.commit()
        
        return {"message": "Password updated successfully"}
    finally:
        db.close()