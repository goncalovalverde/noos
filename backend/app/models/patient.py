import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.orm import relationship
from app.db.base import Base

class Patient(Base):
    __tablename__ = "patients"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    age = Column(Integer, nullable=False)
    education_years = Column(Integer, nullable=False)
    laterality = Column(String, nullable=False)   # diestro | zurdo | ambidextro
    initials = Column(String(10), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    encrypted_metadata = Column(String, nullable=True)

    test_sessions = relationship("TestSession", back_populates="patient", cascade="all, delete-orphan")
    protocol_assignments = relationship("PatientProtocol", back_populates="patient", cascade="all, delete-orphan")
    execution_plans = relationship("ExecutionPlan", back_populates="patient", cascade="all, delete-orphan")

    def get_display_id(self) -> str:
        masked = self.id.split('-')[-1][:4].upper()
        if self.initials:
            return f"{self.initials} ({masked})"
        return f"PKT-{masked}"
