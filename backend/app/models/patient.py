import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base

class Patient(Base):
    __tablename__ = "patients"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    age = Column(Integer, nullable=False)
    education_years = Column(Integer, nullable=False)
    laterality = Column(String, nullable=False)   # diestro | zurdo | ambidextro
    initials = Column(String(10), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    encrypted_metadata = Column(String, nullable=True)
    created_by_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_by = relationship("User", foreign_keys=[created_by_id])
    access_grants = relationship("PatientAccess", back_populates="patient", cascade="all, delete-orphan")

    test_sessions = relationship("TestSession", back_populates="patient", cascade="all, delete-orphan")
    protocol_assignments = relationship("PatientProtocol", back_populates="patient", cascade="all, delete-orphan")
    execution_plans = relationship("ExecutionPlan", back_populates="patient", cascade="all, delete-orphan")

    def get_display_id(self) -> str:
        masked = self.id.split('-')[-1][:4].upper()
        if self.initials:
            return f"{self.initials} ({masked})"
        return f"PKT-{masked}"
