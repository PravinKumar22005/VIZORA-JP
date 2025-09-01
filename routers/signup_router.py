from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from controllers.signup_controller import signup_user

router = APIRouter()

class SignupPayload(BaseModel):
    name: str
    email: str
    password: str

@router.post("/signup")
def signup(payload: SignupPayload):
    result = signup_user(payload.name, payload.email, payload.password)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result