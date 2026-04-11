import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Date, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base

_now = lambda: datetime.now(timezone.utc)  # noqa: E731


class ClinicalSession(Base):
    """A single patient visit during which one or more tests were administered on paper."""
    __tablename__ = "clinical_sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    execution_plan_id = Column(
        String, ForeignKey("execution_plans.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    session_number = Column(Integer, nullable=False)   # sequential 1, 2, 3 …
    session_date = Column(Date, nullable=False)         # actual visit date (not entry date)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_now)

    execution_plan = relationship("ExecutionPlan", back_populates="clinical_sessions")
    test_sessions = relationship(
        "TestSession", back_populates="clinical_session",
        cascade="all, delete-orphan",
    )
