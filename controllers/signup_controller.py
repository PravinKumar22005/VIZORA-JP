from db import SessionLocal
from models.user import User
from sqlalchemy.exc import IntegrityError
from utils.auth import get_password_hash
from fastapi import HTTPException
from datetime import datetime

def signup_user(name: str, email: str, password: str):
    db = SessionLocal()
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")

        # Create new user
        now = datetime.utcnow()
        hashed_password = get_password_hash(password)
        user = User(
            name=name,
            email=email,
            password=hashed_password,
            created_at=now,
            last_login=now
        )
        
        db.add(user)
        db.commit()
        db.refresh(user)
        
        return {
            "id": user.id,
            "name": user.name,
            "email": user.email
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()