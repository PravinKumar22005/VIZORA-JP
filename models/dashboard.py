from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, func
from db import Base

class Dashboard(Base):
    __tablename__ = "dashboards"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    dashboard_name = Column(String(255), nullable=False)
    dashboard_json = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class SharedDashboard(Base):
    __tablename__ = "shared_dashboards"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    code = Column(String(10), unique=True, nullable=False, index=True)
    dashboard_json = Column(JSON, nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ActivityLog(Base):
    __tablename__ = "activity_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String, nullable=False)
    details = Column(String, nullable=True)
    timestamp = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
