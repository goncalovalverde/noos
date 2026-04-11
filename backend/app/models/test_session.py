import uuid
import json
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.db.base import Base

_now = lambda: datetime.now(timezone.utc)  # noqa: E731


class TestSession(Base):
    __tablename__ = "test_sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(String, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    protocol_id = Column(String, ForeignKey("protocols.id", ondelete="SET NULL"), nullable=True)
    execution_plan_id = Column(String, ForeignKey("execution_plans.id", ondelete="SET NULL"), nullable=True, index=True)
    clinical_session_id = Column(
        String, ForeignKey("clinical_sessions.id", ondelete="CASCADE"),
        nullable=True, index=True,
    )
    test_type = Column(String, nullable=False)
    date = Column(DateTime, default=_now)
    raw_data = Column(Text, nullable=True)
    calculated_scores = Column(Text, nullable=True)
    qualitative_data = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    patient = relationship("Patient", back_populates="test_sessions")
    clinical_session = relationship("ClinicalSession", back_populates="test_sessions")

    def set_raw_data(self, data: dict): self.raw_data = json.dumps(data)
    def get_raw_data(self) -> dict: return json.loads(self.raw_data) if self.raw_data else {}
    def set_calculated_scores(self, data: dict): self.calculated_scores = json.dumps(data)
    def get_calculated_scores(self) -> dict: return json.loads(self.calculated_scores) if self.calculated_scores else {}
    def set_qualitative_data(self, data: dict): self.qualitative_data = json.dumps(data)
    def get_qualitative_data(self) -> dict: return json.loads(self.qualitative_data) if self.qualitative_data else {}
