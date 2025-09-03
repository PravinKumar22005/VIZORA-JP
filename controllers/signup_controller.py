from db import SessionLocal
from models.user import User
from sqlalchemy.exc import IntegrityError
from utils.auth import get_password_hash
from utils.jwt import create_access_token
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
        
        # Create a token for the new user, just like in login
        access_token = create_access_token(data={"sub": user.email})
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {"id": user.id, "name": user.name, "email": user.email}
        }
    except Exception as e:
        db.rollback()
        # Check for specific integrity error for existing user
        if isinstance(e, IntegrityError):
             raise HTTPException(status_code=400, detail="Email already registered")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()