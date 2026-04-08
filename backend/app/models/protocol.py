import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.db.base import Base

_now = lambda: datetime.now(timezone.utc)  # noqa: E731

class Protocol(Base):
    __tablename__ = "protocols"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, unique=True, nullable=False)
    description = Column(String, nullable=True)
    category = Column(String, nullable=True)
    is_public = Column(Boolean, default=True, nullable=False, server_default='1')
    allow_customization = Column(Boolean, default=True, nullable=False, server_default='1')
    created_by_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    tests = relationship("ProtocolTest", back_populates="protocol", cascade="all, delete-orphan", order_by="ProtocolTest.order")
    patient_assignments = relationship("PatientProtocol", back_populates="protocol")
    execution_plans = relationship("ExecutionPlan", back_populates="protocol")
    created_by = relationship("User", foreign_keys=[created_by_id])


class ProtocolTest(Base):
    __tablename__ = "protocol_test_mapping"

    protocol_id = Column(String, ForeignKey("protocols.id", ondelete="CASCADE"), primary_key=True)
    test_type = Column(String, primary_key=True)
    order = Column(Integer, default=1)
    default_notes = Column(String, nullable=True)

    protocol = relationship("Protocol", back_populates="tests")


class PatientProtocol(Base):
    __tablename__ = "patient_protocol_assignments"

    patient_id = Column(String, ForeignKey("patients.id", ondelete="CASCADE"), primary_key=True)
    protocol_id = Column(String, ForeignKey("protocols.id", ondelete="CASCADE"), primary_key=True)
    assigned_date = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    assigned_by = Column(String, nullable=True)
    status = Column(String, default="pending")   # pending | in_progress | completed
    notes = Column(String, nullable=True)

    patient = relationship("Patient", back_populates="protocol_assignments")
    protocol = relationship("Protocol", back_populates="patient_assignments")
