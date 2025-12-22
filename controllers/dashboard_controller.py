from fastapi import HTTPException
from db import SessionLocal
from models.dashboard import Dashboard, SharedDashboard
from typing import List, Optional
import pandas as pd
import io
from models.file_metadata import FileMetadata
from utils.azure_blob import download_file_from_azure
from sqlalchemy.orm import Session


def delete_dashboard_permanently(user_id: int, dashboard_id: int):
    db = SessionLocal()
    try:
        dashboard = (
            db.query(Dashboard)
            .filter(Dashboard.id == dashboard_id, Dashboard.user_id == user_id)
            .first()
        )
        if not dashboard:
            raise HTTPException(status_code=404, detail="Dashboard not found")
        db.delete(dashboard)
        db.commit()
        return {"detail": "Dashboard permanently deleted"}
    finally:
        db.close()


def delete_shared_dashboard_permanently(user_id: int, shared_dashboard_id: int):
    db = SessionLocal()
    try:
        shared_dashboard = (
            db.query(SharedDashboard)
            .filter(
                SharedDashboard.id == shared_dashboard_id,
                SharedDashboard.user_id == user_id,
            )
            .first()
        )
        if not shared_dashboard:
            raise HTTPException(status_code=404, detail="Shared dashboard not found")
        db.delete(shared_dashboard)
        db.commit()
        return {"detail": "Shared dashboard permanently deleted"}
    finally:
        db.close()


def create_dashboard(
    db: Session,
    user_id: int,
    dashboard_name: str,
    dashboard_json: list,
    file_ids: Optional[List[int]] = None,
):
    final_dashboard_json = dashboard_json

    if file_ids:
        try:
            # 1. Fetch file metadata
            files_meta = (
                db.query(FileMetadata)
                .filter(FileMetadata.id.in_(file_ids), FileMetadata.user_id == user_id)
                .all()
            )

            if len(files_meta) != len(file_ids):
                raise HTTPException(
                    status_code=404,
                    detail="One or more files not found or access denied.",
                )

            def _detect_file_type(meta: FileMetadata) -> str:
                """Normalize stored metadata to csv/xls/xlsx"""
                raw = (meta.file_type or "").lower()
                if any(token in raw for token in ["csv", "text/csv"]):
                    return "csv"
                if any(token in raw for token in ["xls", "xlsx", "excel"]):
                    return "excel"
                name = (meta.file_name or "").lower()
                if name.endswith(".csv"):
                    return "csv"
                if name.endswith((".xls", ".xlsx", ".xlsm", ".xlsb")):
                    return "excel"
                return "unknown"

            # 2. Download and combine dataframes
            all_dfs = []
            for meta in files_meta:
                blob_name = meta.bucket_path or meta.file_name
                if not blob_name:
                    raise HTTPException(
                        status_code=400,
                        detail=f"File {meta.id} is missing blob storage reference.",
                    )

                file_content = download_file_from_azure(blob_name)
                file_stream = io.BytesIO(file_content)

                file_type = _detect_file_type(meta)
                if file_type == "csv":
                    df = pd.read_csv(file_stream)
                elif file_type == "excel":
                    df = pd.read_excel(file_stream)
                else:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Unsupported file type for file ID {meta.id}.",
                    )

                # Add a source column to identify the origin of the data
                df["source_file"] = meta.file_name
                all_dfs.append(df)

            if not all_dfs:
                raise HTTPException(
                    status_code=400, detail="No valid files could be processed."
                )

            # 3. Combine all dataframes
            combined_df = pd.concat(all_dfs, ignore_index=True)

            def _json_safe(value):
                if value is None:
                    return None
                if isinstance(value, pd.Timestamp):
                    return value.isoformat()
                if hasattr(value, "isoformat") and callable(value.isoformat):
                    try:
                        return value.isoformat()
                    except Exception:
                        pass
                if hasattr(value, "item"):
                    try:
                        return value.item()
                    except Exception:
                        pass
                if isinstance(value, (list, tuple)):
                    return [_json_safe(v) for v in value]
                if isinstance(value, dict):
                    return {k: _json_safe(v) for k, v in value.items()}
                try:
                    if pd.isna(value):
                        return None
                except Exception:
                    pass
                return value

            # Ensure every cell is JSON serializable
            cleaned_records = []
            for record in combined_df.to_dict(orient="records"):
                cleaned_records.append(
                    {key: _json_safe(val) for key, val in record.items()}
                )

            # 4. Generate dashboard_json from the cleaned dataframe
            # This replaces any client-sent json if file_ids are used
            final_dashboard_json = cleaned_records

        except HTTPException as e:
            raise e  # Re-raise HTTP exceptions
        except Exception as e:
            # Catch-all for pandas errors, azure errors, etc.
            raise HTTPException(
                status_code=500,
                detail=f"Failed to process files for dashboard: {str(e)}",
            )

    # 5. Create and save the dashboard
    dashboard = Dashboard(
        user_id=user_id,
        dashboard_name=dashboard_name,
        dashboard_json=final_dashboard_json,
    )
    db.add(dashboard)
    db.commit()
    db.refresh(dashboard)
    return dashboard
