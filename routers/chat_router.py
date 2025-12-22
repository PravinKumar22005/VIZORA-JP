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
import numpy as np
from datetime import datetime

router = APIRouter()


class ChatCreate(BaseModel):
    title: str


class MessageCreate(BaseModel):
    text: str
    sender: str


class ChatUpdate(BaseModel):
    is_active: int


class ChatRename(BaseModel):
    title: str


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


@router.patch("/chats/{chat_id}/title", response_model=dict)
def rename_chat(
    chat_id: int,
    payload: ChatRename,
    user: User = Depends(get_current_user),
):
    return chat_controller.update_chat(user.id, chat_id, title=payload.title)


@router.post("/chats", response_model=dict)
def create_chat(
    chat: ChatCreate,
    user: User = Depends(get_current_user),
):
    return chat_controller.create_chat(user.id, chat.title)


@router.get("/chats", response_model=List[dict])
def list_chats(user: User = Depends(get_current_user)):
    return chat_controller.list_chats(user.id)


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
        filename_lower = (file.filename or "").lower()
        content_type = getattr(file, "content_type", "unknown")
        print(
            f"[upload_file_metadata] filename={file.filename} content_type={content_type}"
        )

        bucket_path = upload_file_to_azure(file.file, file.filename)

        file.file.seek(0)
        content = await file.read()

        table_names: List[str] = []
        per_sheet: List[dict] = []
        selected_df = None
        selected_sheet = None

        if filename_lower.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
            selected_df = df
            selected_sheet = "csv"
            table_names = ["csv"]
            per_sheet.append(
                {"sheet": "csv", "num_rows": len(df), "num_columns": len(df.columns)}
            )
        elif filename_lower.endswith(".xlsb"):
            xls = pd.ExcelFile(io.BytesIO(content), engine="pyxlsb")
            table_names = xls.sheet_names
            for sheet in table_names:
                tmp = xls.parse(sheet)
                if len(tmp.columns) > 0 and len(tmp) > 0:
                    if selected_df is None:
                        selected_df = tmp
                        selected_sheet = sheet
                    per_sheet.append(
                        {
                            "sheet": sheet,
                            "num_rows": len(tmp),
                            "num_columns": len(tmp.columns),
                        }
                    )
        elif filename_lower.endswith(".xlsm") or filename_lower.endswith(".xlsx"):
            parsed = False
            try:
                xls = pd.ExcelFile(io.BytesIO(content))
                table_names = xls.sheet_names
                for sheet in table_names:
                    tmp = xls.parse(sheet)
                    if len(tmp.columns) > 0 and len(tmp) > 0:
                        if selected_df is None:
                            selected_df = tmp
                            selected_sheet = sheet
                        per_sheet.append(
                            {
                                "sheet": sheet,
                                "num_rows": len(tmp),
                                "num_columns": len(tmp.columns),
                            }
                        )
                parsed = True
            except Exception:
                parsed = False
            if not parsed or selected_df is None:
                try:
                    xls = pd.ExcelFile(io.BytesIO(content), engine="openpyxl")
                    table_names = xls.sheet_names
                    for sheet in table_names:
                        tmp = xls.parse(sheet)
                        if len(tmp.columns) > 0 and len(tmp) > 0:
                            if selected_df is None:
                                selected_df = tmp
                                selected_sheet = sheet
                            per_sheet.append(
                                {
                                    "sheet": sheet,
                                    "num_rows": len(tmp),
                                    "num_columns": len(tmp.columns),
                                }
                            )
                except Exception:
                    all_sheets = pd.read_excel(io.BytesIO(content), sheet_name=None)
                    table_names = list(all_sheets.keys())
                    for name, tmp in all_sheets.items():
                        if len(tmp.columns) > 0 and len(tmp) > 0:
                            if selected_df is None:
                                selected_df = tmp
                                selected_sheet = name
                            per_sheet.append(
                                {
                                    "sheet": name,
                                    "num_rows": len(tmp),
                                    "num_columns": len(tmp.columns),
                                }
                            )
        elif filename_lower.endswith(".xls"):
            xls = pd.ExcelFile(io.BytesIO(content), engine="xlrd")
            table_names = xls.sheet_names
            for sheet in table_names:
                tmp = xls.parse(sheet)
                if len(tmp.columns) > 0 and len(tmp) > 0:
                    if selected_df is None:
                        selected_df = tmp
                        selected_sheet = sheet
                    per_sheet.append(
                        {
                            "sheet": sheet,
                            "num_rows": len(tmp),
                            "num_columns": len(tmp.columns),
                        }
                    )
        else:
            all_sheets = pd.read_excel(io.BytesIO(content), sheet_name=None)
            table_names = list(all_sheets.keys())
            for name, tmp in all_sheets.items():
                if len(tmp.columns) > 0 and len(tmp) > 0:
                    if selected_df is None:
                        selected_df = tmp
                        selected_sheet = name
                    per_sheet.append(
                        {
                            "sheet": name,
                            "num_rows": len(tmp),
                            "num_columns": len(tmp.columns),
                        }
                    )

        if selected_df is None:
            raise HTTPException(
                status_code=400, detail="No non-empty sheets found in workbook."
            )

        # Helper to convert numpy/pandas/datetime values to JSON-safe primitives
        def make_json_safe(obj):
            if obj is None:
                return None
            if isinstance(obj, (np.generic,)):
                return obj.item()
            if isinstance(obj, pd.Timestamp):
                return obj.isoformat()
            if isinstance(obj, datetime):
                return obj.isoformat()
            if isinstance(obj, (np.datetime64,)):
                try:
                    return pd.Timestamp(obj).isoformat()
                except Exception:
                    return str(obj)
            if isinstance(
                obj,
                (
                    np.int64,
                    np.int32,
                    np.int16,
                    np.int8,
                    np.uint64,
                    np.uint32,
                    np.uint16,
                    np.uint8,
                ),
            ):
                return int(obj)
            if isinstance(obj, (np.float64, np.float32, np.float16)):
                return float(obj)
            if isinstance(obj, (np.bool_,)):
                return bool(obj)
            if isinstance(obj, dict):
                return {str(k): make_json_safe(v) for k, v in obj.items()}
            if isinstance(obj, (list, tuple, set)):
                return [make_json_safe(v) for v in obj]
            # pandas NA / NaN
            try:
                if pd.isna(obj):
                    return None
            except Exception:
                pass
            return obj if isinstance(obj, (str, int, float, bool)) else str(obj)

        columns = [
            {
                "name": str(col),
                "type": str(selected_df[col].dtype),
                "sample_values": make_json_safe(selected_df[col].head(3).tolist()),
            }
            for col in selected_df.columns
        ]
        num_rows = len(selected_df)
        num_columns = len(selected_df.columns)
        try:
            stats = selected_df.describe(include="all").to_dict()
        except Exception:
            stats = {}

        def clean_nans(obj):
            if isinstance(obj, float) and math.isnan(obj):
                return None
            if isinstance(obj, dict):
                return {k: clean_nans(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [clean_nans(x) for x in obj]
            return obj

        columns = make_json_safe(clean_nans(columns))
        stats = make_json_safe(clean_nans(stats))

        return chat_controller.add_file_metadata(
            user.id,
            chat_id,
            file.filename,
            len(content),
            file.content_type,
            columns=columns,
            num_rows=num_rows,
            num_columns=num_columns,
            summary_stats=make_json_safe(
                {
                    "selected_sheet": selected_sheet,
                    "per_sheet": per_sheet,
                    "stats": stats,
                }
            ),
            bucket_path=bucket_path,
            table_names=table_names,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"File processing error: {str(e)}")


@router.get("/chats/{chat_id}/files", response_model=List[dict])
def list_file_metadata(
    chat_id: int,
    user: User = Depends(get_current_user),
):
    return chat_controller.list_file_metadata(user.id, chat_id)
