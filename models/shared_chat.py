import shortuuid
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from db import Base


class SharedChat(Base):
    __tablename__ = "shared_chats"

    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("chats.id"), nullable=False)
    share_code = Column(
        String,
        unique=True,
        index=True,
        default=lambda: shortuuid.ShortUUID().random(length=8),
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)

    chat = relationship("Chat")
