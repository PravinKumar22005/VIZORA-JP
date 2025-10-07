from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from db import Base


class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    is_active = Column(Integer, default=1, nullable=False)  # 1 = active, 0 = deleted
    chat_id = Column(Integer, ForeignKey("chats.id"), nullable=False)
    sender = Column(String(10), nullable=False)  # 'user' or 'bot'
    text = Column(String, nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
