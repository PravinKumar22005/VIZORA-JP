from controllers import file_controller
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from models.user import User
from utils.jwt import get_current_user
from db import SessionLocal
from models.file_metadata import FileMetadata
from utils.azure_blob import download_file_from_azure
import pandas as pd
import io

router = APIRouter()

# Permanent delete endpoint for files
@router.delete("/file/permanent/{file_id}")
def delete_file_permanently(
    file_id: int,
    user: User = Depends(get_current_user),
):
    return file_controller.delete_file_permanently(user.id, file_id)
class TableQueryRequest(BaseModel):
    file_ids: Optional[List[int]] = None  # For joins
    file_id: Optional[int] = None  # For single file
    sql: str


@router.post("/table/query")
def table_query(req: TableQueryRequest, user: User = Depends(get_current_user)):
    db = SessionLocal()
    dfs = {}
    # Support both single and multi-file (for joins)
    file_ids = req.file_ids or ([req.file_id] if req.file_id else [])
    if not file_ids:
        raise HTTPException(status_code=400, detail="No file_id(s) provided.")

    for idx, fid in enumerate(file_ids):
        file_meta = (
            db.query(FileMetadata)
            .filter(FileMetadata.id == fid, FileMetadata.user_id == user.id)
            .first()
        )
        if not file_meta:
            db.close()
            raise HTTPException(status_code=404, detail=f"File {fid} not found")
        file_bytes = download_file_from_azure(file_meta.bucket_path)
        if file_meta.file_name.lower().endswith(".csv"):
            df = pd.read_csv(io.BytesIO(file_bytes))
        elif file_meta.file_name.lower().endswith((".xls", ".xlsx")):
            df = pd.read_excel(io.BytesIO(file_bytes))
        else:
            db.close()
            raise HTTPException(status_code=400, detail="Unsupported file type")
        dfs[f"df{idx+1}"] = df
    db.close()

    # Use pandasql to run the SQL
    import pandasql

    try:
        # If only one file, allow 'df' as alias for convenience
        if len(dfs) == 1:
            dfs["df"] = list(dfs.values())[0]
            # Safety net: replace 'your_table' with 'df' in SQL
            if req.sql:
                req.sql = req.sql.replace("your_table", "df")
        result = pandasql.sqldf(req.sql, dfs)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"SQL error: {str(e)}")

    # Limit to 100 rows for safety
    result = result.head(100)
    return {"columns": list(result.columns), "rows": result.to_dict(orient="records")}
