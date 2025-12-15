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
import numpy as np
from datetime import datetime
import warnings

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

    def add_time_derivatives(df: pd.DataFrame) -> pd.DataFrame:
        candidates = [
            "Date",
            "date",
            "Invoice Date",
            "Sale Date",
            "Purchase Date",
            "Transaction Date",
        ]
        date_col = next((c for c in candidates if c in df.columns), None)
        if date_col:
            dts = None
            # Try explicit common formats first to avoid per-element parsing warnings
            common_formats = [
                "%Y-%m-%d",
                "%d-%m-%Y",
                "%m/%d/%Y",
                "%d/%m/%Y",
                "%Y/%m/%d",
                "%b %d, %Y",
                "%d %b %Y",
            ]
            for fmt in common_formats:
                try:
                    candidate = pd.to_datetime(
                        df[date_col], format=fmt, errors="coerce"
                    )
                    if candidate.notna().sum() >= max(1, int(0.2 * len(df))):
                        dts = candidate
                        break
                except Exception:
                    continue
            if dts is None or dts.notna().sum() == 0:
                # Fallback to dateutil with dayfirst variations
                try:
                    dts = pd.to_datetime(df[date_col], errors="coerce", dayfirst=False)
                except Exception:
                    try:
                        dts = pd.to_datetime(
                            df[date_col], errors="coerce", dayfirst=True
                        )
                    except Exception:
                        dts = None
            if dts is not None and dts.notna().sum() > 0:
                df["Year"] = dts.dt.year
                df["Month"] = dts.dt.month
                qnum = dts.dt.quarter
                df["Quarter"] = qnum
                year_str = dts.dt.year.astype("Int64").astype(str)
                q_str = qnum.astype("Int64").astype(str)
                df["QuarterFmt"] = (year_str + "-Q" + q_str).where(dts.notna(), None)
        return df

    def add_normalized_keys(df: pd.DataFrame) -> pd.DataFrame:
        # Normalize common product/customer/vendor columns for robust joins
        def norm_series(s):
            return (
                s.astype(str)
                .str.strip()
                .str.replace(r"\s+", " ", regex=True)
                .str.casefold()
            )

        product_candidates = ["Product", "Product Name", "Item", "ITEM"]
        prod_col = next((c for c in product_candidates if c in df.columns), None)
        if prod_col:
            try:
                df["Product_norm"] = norm_series(df[prod_col])
            except Exception:
                pass

        customer_candidates = ["Customer", "Consignee", "Buyer", "Client"]
        cust_col = next((c for c in customer_candidates if c in df.columns), None)
        if cust_col:
            try:
                df["Customer_norm"] = norm_series(df[cust_col])
            except Exception:
                pass

        vendor_candidates = ["Vendor", "Supplier", "Consignor"]
        vend_col = next((c for c in vendor_candidates if c in df.columns), None)
        if vend_col:
            try:
                df["Vendor_norm"] = norm_series(df[vend_col])
            except Exception:
                pass
        return df

    for idx, fid in enumerate(file_ids):
        file_meta = (
            db.query(FileMetadata)
            .filter(FileMetadata.id == fid, FileMetadata.user_id == user.id)
            .first()
        )
        if not file_meta:
            db.close()
            raise HTTPException(status_code=404, detail=f"File {fid} not found")
        else:
            db.close()
            raise HTTPException(status_code=400, detail="Unsupported file type")
        # Add robust helpers for date grouping and joins
        df = add_time_derivatives(df)
        df = add_normalized_keys(df)
        # Add numeric-safe columns for common amount fields
        amount_candidates = [
            "SalesAmount",
            "Sale Amount",
            "Sales Amount",
            "Amount",
            "Net Amount",
            "Total",
            "PurchaseAmount",
            "Purchase Amount",
        ]
        for col in amount_candidates:
            if col in df.columns:
                try:
                    cleaned = (
                        df[col]
                        .astype(str)
                        .str.replace(r"[\$,\s]", "", regex=True)
                        .str.replace(r"\(([^)]*)\)", r"-\1", regex=True)
                    )
                    df[col + "_num"] = pd.to_numeric(cleaned, errors="coerce")
                except Exception:
                    # Best effort; skip if conversion fails
                    pass
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
        # Defensive: replace common alias placeholders
        safe_sql = req.sql
        safe_sql = safe_sql.replace("your_table", "df")
        # Provide Month/Quarter/Year derived columns availability hint by not renaming existing columns
        result = pandasql.sqldf(safe_sql, dfs)
    except Exception as e:
        # Provide available columns to help users correct SQL
        cols_summary = {k: list(v.columns)[:50] for k, v in dfs.items()}
        raise HTTPException(
            status_code=400,
            detail=f"SQL error: {str(e)} | Available columns: {cols_summary}",
        )

    # Limit to 100 rows for safety
    result = result.head(100)
    return {"columns": list(result.columns), "rows": result.to_dict(orient="records")}
