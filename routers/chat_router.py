from controllers import message_controller


from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import List
from models.user import User
from utils.jwt import get_current_user
from pydantic import BaseModel
from controllers import chat_controller
from controllers import chat_controller_delete
from utils.azure_blob import upload_file_to_azure
import pandas as pd
import io
import math

router = APIRouter()


class ChatCreate(BaseModel):
    title: str


class MessageCreate(BaseModel):
    text: str
    sender: str


class ChatUpdate(BaseModel):
    is_active: int


@router.delete("/messages/permanent/{message_id}")
def delete_message_permanently(
    message_id: int,
    user: User = Depends(get_current_user),
):
    return message_controller.delete_message_permanently(user.id, message_id)


@router.delete("/chats/{chat_id}/permanent", response_model=dict)
def delete_chat_permanently(
    chat_id: int,
    user: User = Depends(get_current_user),
):
    return chat_controller_delete.delete_chat_permanently(user.id, chat_id)


@router.patch("/chats/{chat_id}", response_model=dict)
def update_chat_is_active(
    chat_id: int,
    chat_update: ChatUpdate,
    user: User = Depends(get_current_user),
):
    return chat_controller.update_chat_is_active(
        user.id, chat_id, chat_update.is_active
    )


@router.post("/chats", response_model=dict)
def create_chat(
    chat: ChatCreate,
    user: User = Depends(get_current_user),
):
    return chat_controller.create_chat(user.id, chat.title)


# List active chats
@router.get("/chats", response_model=List[dict])
def list_chats(user: User = Depends(get_current_user)):
    return chat_controller.list_chats(user.id)


# List deleted chats (for recycle bin)
@router.get("/chats/deleted", response_model=List[dict])
def list_deleted_chats(user: User = Depends(get_current_user)):
    return chat_controller.list_deleted_chats(user.id)


@router.post("/chats/{chat_id}/messages", response_model=dict)
def add_message(
    chat_id: int,
    message: MessageCreate,
    user: User = Depends(get_current_user),
):
    return chat_controller.add_message(user.id, chat_id, message.text, message.sender)


@router.get("/chats/{chat_id}/messages", response_model=List[dict])
def get_messages(
    chat_id: int,
    user: User = Depends(get_current_user),
):
    return chat_controller.get_messages(user.id, chat_id)


@router.post("/chats/{chat_id}/files", response_model=dict)
async def upload_file_metadata(
    chat_id: int,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    try:
        # 1. Upload file to Azure Blob
        bucket_path = upload_file_to_azure(file.file, file.filename)

        # 2. Extract metadata
        file.file.seek(0)
        content = await file.read()
        columns = []
        num_rows = 0
        num_columns = 0
        summary_stats = {}
        table_names = None

        if file.filename.lower().endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
            columns = [
                {
                    "name": col,
                    "type": str(df[col].dtype),
                    "sample_values": df[col].head(3).tolist(),
                }
                for col in df.columns
            ]
            num_rows = len(df)
            num_columns = len(df.columns)
            summary_stats = df.describe().to_dict()
        elif file.filename.lower().endswith((".xls", ".xlsx")):
            xls = pd.ExcelFile(io.BytesIO(content))
            table_names = xls.sheet_names
            # For simplicity, extract metadata from the first sheet
            df = xls.parse(table_names[0])
            columns = [
                {
                    "name": col,
                    "type": str(df[col].dtype),
                    "sample_values": df[col].head(3).tolist(),
                }
                for col in df.columns
            ]
            num_rows = len(df)
            num_columns = len(df.columns)
            summary_stats = df.describe().to_dict()
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type")

        def clean_nans(obj):
            if isinstance(obj, float) and math.isnan(obj):
                return None
            if isinstance(obj, dict):
                return {k: clean_nans(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [clean_nans(x) for x in obj]
            return obj

        # Clean NaNs before saving to DB
        columns = clean_nans(columns)
        summary_stats = clean_nans(summary_stats)

        # 3. Save metadata in DB
        return chat_controller.add_file_metadata(
            user.id,
            chat_id,
            file.filename,
            len(content),
            file.content_type,
            columns=columns,
            num_rows=num_rows,
            num_columns=num_columns,
            summary_stats=summary_stats,
            bucket_path=bucket_path,
            table_names=table_names,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"File processing error: {str(e)}")


@router.get("/chats/{chat_id}/files", response_model=List[dict])
def list_file_metadata(
    chat_id: int,
    user: User = Depends(get_current_user),
):
    return chat_controller.list_file_metadata(user.id, chat_id)
