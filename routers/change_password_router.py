from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, constr
from controllers.change_password_controller import change_password

router = APIRouter()

class ChangePasswordPayload(BaseModel):
    email: EmailStr
    old_password: constr(min_length=6)
    new_password: constr(min_length=6)

@router.post("/change-password")
async def change_password_route(payload: ChangePasswordPayload):
    try:
        result = change_password(
            payload.email, 
            payload.old_password, 
            payload.new_password
        )
        return result
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))