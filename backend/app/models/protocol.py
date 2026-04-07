import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base

class Protocol(Base):
    __tablename__ = "protocols"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, unique=True, nullable=False)
    description = Column(String, nullable=True)
    category = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tests = relationship("ProtocolTest", back_populates="protocol", cascade="all, delete-orphan", order_by="ProtocolTest.order")
    patient_assignments = relationship("PatientProtocol", back_populates="protocol")
    execution_plans = relationship("ExecutionPlan", back_populates="protocol")


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
    assigned_date = Column(DateTime, default=datetime.utcnow)
    assigned_by = Column(String, nullable=True)
    status = Column(String, default="pending")   # pending | in_progress | completed
    notes = Column(String, nullable=True)

    patient = relationship("Patient", back_populates="protocol_assignments")
    protocol = relationship("Protocol", back_populates="patient_assignments")
