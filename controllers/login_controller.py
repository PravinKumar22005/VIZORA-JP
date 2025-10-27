from datetime import datetime
from db import SessionLocal
from models.user import User
from utils.auth import verify_password
from utils.jwt import create_access_token

def login_user(email: str, password: str):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user or not verify_password(password, user.password):
            return {"error": "Invalid email or password"}
        
        user.last_login = datetime.utcnow()
        db.commit()
        db.refresh(user)
        
        access_token = create_access_token(data={"sub": user.email})
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {"id": user.id, "name": user.name, "email": user.email}
        }
    finally:
        db.close()