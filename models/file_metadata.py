from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from db import Base

from sqlalchemy import JSON

class FileMetadata(Base):
    __tablename__ = "file_metadata"
    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("chats.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    file_name = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    file_type = Column(String, nullable=False)
    table_names = Column(JSON, nullable=True)      # For Excel: list of sheet names
    columns = Column(JSON, nullable=True)          # [{name, type, sample_values, ...}]
    num_rows = Column(Integer, nullable=True)
    num_columns = Column(Integer, nullable=True)
    summary_stats = Column(JSON, nullable=True)    # Optional: summary statistics
    bucket_path = Column(String, nullable=True)    # Path in S3/GCS/etc.
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)