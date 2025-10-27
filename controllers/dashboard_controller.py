from fastapi import HTTPException
from db import SessionLocal
from models.dashboard import Dashboard, SharedDashboard


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
