from db import SessionLocal
from models.user import User


def login_user(email: str, password: str):
    print("Attempting login for:", email)
    db = SessionLocal()
    user = db.query(User).filter(User.email == email).first()
    db.close()
    if not user:
        return {"error": "User does not exist"}
    if user.password != password:
        return {"error": "Invalid password"}
    return {"email": user.email, "name": user.name}
