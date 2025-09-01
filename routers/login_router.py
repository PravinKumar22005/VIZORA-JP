from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from controllers.login_controller import login_user

router = APIRouter()

class LoginPayload(BaseModel):
    email: str
    password: str

@router.post("/login")
def login(payload: LoginPayload):
    result = login_user(payload.email, payload.password)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result