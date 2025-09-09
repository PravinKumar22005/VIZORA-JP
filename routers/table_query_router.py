from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from models.user import User
from utils.jwt import get_current_user
from db import SessionLocal
from models.file_metadata import FileMetadata
from utils.azure_blob import download_file_from_azure
import pandas as pd
import io

router = APIRouter()

class TableQueryRequest(BaseModel):
    file_id: int
    sql: Optional[str] = None  # If not provided, return first 100 rows

@router.post("/table/query")
def table_query(
    req: TableQueryRequest,
    user: User = Depends(get_current_user)
):
    db = SessionLocal()
    file_meta = db.query(FileMetadata).filter(
        FileMetadata.id == req.file_id,
        FileMetadata.user_id == user.id
    ).first()
    db.close()
    if not file_meta:
        raise HTTPException(status_code=404, detail="File not found")
    # Download file from Azure Blob
    file_bytes = download_file_from_azure(file_meta.bucket_path)
    if file_meta.file_name.lower().endswith('.csv'):
        df = pd.read_csv(io.BytesIO(file_bytes))
    elif file_meta.file_name.lower().endswith(('.xls', '.xlsx')):
        df = pd.read_excel(io.BytesIO(file_bytes))
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    # Run SQL or filter
    if req.sql:
        import pandasql
        try:
            result = pandasql.sqldf(req.sql, {'df': df})
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"SQL error: {str(e)}")
    else:
        result = df.head(100)  # Default: first 100 rows
    return {
        "columns": list(result.columns),
        "rows": result.head(100).to_dict(orient="records")
    }