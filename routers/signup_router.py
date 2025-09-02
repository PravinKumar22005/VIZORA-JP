from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, constr
from controllers.signup_controller import signup_user

router = APIRouter()

class SignupPayload(BaseModel):
    name: constr(min_length=2, max_length=50)
    email: EmailStr
    password: constr(min_length=6)

@router.post("/signup")
async def signup(payload: SignupPayload):
    try:
        result = signup_user(payload.name, payload.email, payload.password)
        return result
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))