from db import SessionLocal
from models.user import User
from sqlalchemy.exc import IntegrityError

def signup_user(name: str, email: str, password: str):
    db = SessionLocal()
    user = User(name=name, email=email, password=password)
    try:
        db.add(user)
        db.commit()
        db.refresh(user)
        return {"id": user.id, "name": user.name, "email": user.email}
    except IntegrityError:
        db.rollback()
        return {"error": "Email already exists"}
    finally:
        db.close()