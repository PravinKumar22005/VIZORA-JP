# --- Imports ---
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Body
from sqlalchemy.orm import Session
from db import get_db
from models.user import User
from utils.jwt import get_current_user
from typing import List
from pydantic import BaseModel
import random, string
from models.dashboard import SharedDashboard, Dashboard
from datetime import datetime
import io
import pandas as pd
import requests
from utils.azure_blob import upload_file_to_azure
from models.file_metadata import FileMetadata


class IngestLinkRequest(BaseModel):
    url: str
    file_name: str = None  # Optional, fallback to URL basename


class IngestLinkResponse(BaseModel):
    file_name: str
    bucket_path: str
    file_size: int
    detail: str


# --- Ingest file from link (Google Drive/direct) ---


router = APIRouter(prefix="/dashboard", tags=["dashboard"])
# --- File Upload Endpoint ---


class DashboardCreate(BaseModel):
    dashboard_json: list
    dashboard_name: str


class ShareDashboardRequest(BaseModel):
    dashboard_json: list


class ShareDashboardResponse(BaseModel):
    code: str
    dashboard_json: list
    created_at: datetime

    class Config:
        from_attributes = True


class DashboardResponse(BaseModel):
    id: int
    user_id: int
    dashboard_name: str
    dashboard_json: list
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

@router.post("/ingest-link", response_model=IngestLinkResponse)
def ingest_file_from_link(
    payload: IngestLinkRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    url = payload.url
    file_name = payload.file_name or url.split("/")[-1].split("?")[0]
    try:
        resp = requests.get(url, stream=True, timeout=60)
        resp.raise_for_status()
        file_bytes = resp.content
        file_size = len(file_bytes)
        # Upload to Azure Blob
        bucket_path = upload_file_to_azure(io.BytesIO(file_bytes), file_name)

        # Try to extract metadata (columns, rows, etc.)
        columns = []
        num_rows = 0
        num_columns = 0
        summary_stats = None
        table_names = None
        file_type = "unknown"
        try:
            if file_name.lower().endswith(".csv"):
                df = pd.read_csv(io.BytesIO(file_bytes))
                file_type = "csv"
            elif file_name.lower().endswith((".xls", ".xlsx")):
                df = pd.read_excel(io.BytesIO(file_bytes))
                file_type = "excel"
            else:
                df = None
            if df is not None:
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
                summary_stats = df.describe(include="all").to_dict() if not df.empty else None
        except Exception:
            pass  # Metadata extraction is best-effort

        # Save metadata in file_metadata table
        file_meta = FileMetadata(
            user_id=user.id,
            chat_id=None,  # Not associated with a chat
            file_name=file_name,
            file_size=file_size,
            file_type=file_type,
            columns=columns,
            num_rows=num_rows,
            num_columns=num_columns,
            summary_stats=summary_stats,
            bucket_path=bucket_path,
            table_names=table_names,
        )
        db.add(file_meta)
        db.commit()
        db.refresh(file_meta)

        return IngestLinkResponse(
            file_name=file_name,
            bucket_path=bucket_path,
            file_size=file_size,
            detail="File ingested, uploaded to Azure Blob Storage, and metadata saved.",
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to ingest file: {str(e)}")


@router.get("/shared/{code}")
def get_shared_dashboard(code: str, db: Session = Depends(get_db)):
    shared = db.query(SharedDashboard).filter(SharedDashboard.code == code).first()
    if not shared:
        raise HTTPException(status_code=404, detail="Shared dashboard not found")
    # Return a structure compatible with frontend expectations
    return {
        "cleanedData": shared.dashboard_json,
        "dashboardName": f"Shared Dashboard {code}",
        "created_at": shared.created_at.isoformat() if shared.created_at else None,
    }


# --- File Upload Endpoint ---
@router.post("/upload", response_model=DashboardResponse)
async def upload_dashboard_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    contents = await file.read()
    # Try to parse as CSV first
    try:
        df = pd.read_csv(io.BytesIO(contents))
    except Exception:
        # Try Excel
        try:
            df = pd.read_excel(io.BytesIO(contents))
        except Exception:
            raise HTTPException(
                status_code=400,
                detail="Unsupported file format. Please upload a valid CSV or Excel file.",
            )
    dashboard_json = df.to_dict(orient="records")
    dashboard = Dashboard(
        user_id=user.id, dashboard_name=file.filename, dashboard_json=dashboard_json
    )
    db.add(dashboard)
    db.commit()
    db.refresh(dashboard)
    return dashboard


@router.post("/share", response_model=ShareDashboardResponse)
def share_dashboard(
    payload: ShareDashboardRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Generate a unique 6-character code
    code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    while db.query(SharedDashboard).filter(SharedDashboard.code == code).first():
        code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    shared_dashboard = SharedDashboard(
        user_id=user.id,
        code=code,
        dashboard_json=payload.dashboard_json,
    )
    db.add(shared_dashboard)
    db.commit()
    db.refresh(shared_dashboard)
    return shared_dashboard


# --- Dashboard CRUD Endpoints ---
@router.post("", response_model=DashboardResponse)
def create_dashboard(
    payload: DashboardCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    dashboard = Dashboard(
        user_id=user.id,
        dashboard_name=payload.dashboard_name,
        dashboard_json=payload.dashboard_json,
    )
    db.add(dashboard)
    db.commit()
    db.refresh(dashboard)
    return dashboard


@router.get("", response_model=List[DashboardResponse])
def get_my_dashboards(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    dashboards = (
        db.query(Dashboard)
        .filter(Dashboard.user_id == user.id)
        .order_by(Dashboard.created_at.desc())
        .all()
    )
    return dashboards


@router.get("/{dashboard_id}", response_model=DashboardResponse)
def get_dashboard(
    dashboard_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    dashboard = (
        db.query(Dashboard)
        .filter(Dashboard.id == dashboard_id, Dashboard.user_id == user.id)
        .first()
    )
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return dashboard


@router.put("/{dashboard_id}", response_model=DashboardResponse)
def update_dashboard(
    dashboard_id: int,
    payload: DashboardCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    dashboard = (
        db.query(Dashboard)
        .filter(Dashboard.id == dashboard_id, Dashboard.user_id == user.id)
        .first()
    )
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    dashboard.dashboard_name = payload.dashboard_name
    dashboard.dashboard_json = payload.dashboard_json
    db.commit()
    db.refresh(dashboard)
    return dashboard


@router.delete("/{dashboard_id}")
def delete_dashboard(
    dashboard_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    dashboard = (
        db.query(Dashboard)
        .filter(Dashboard.id == dashboard_id, Dashboard.user_id == user.id)
        .first()
    )
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    db.delete(dashboard)
    db.commit()
    return {"detail": "Deleted"}
