from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from db import Base


class Chat(Base):
    __tablename__ = "chats"
    id = Column(Integer, primary_key=True, index=True)
    is_active = Column(Integer, default=1, nullable=False)  # 1 = active, 0 = deleted
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
