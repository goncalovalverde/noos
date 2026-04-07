from pydantic import BaseModel
from typing import Optional, Any, Dict
from datetime import datetime

class TestSessionCreate(BaseModel):
    patient_id: str
    test_type: str
    protocol_id: Optional[str] = None
    execution_plan_id: Optional[str] = None
    raw_data: Dict[str, Any] = {}
    qualitative_data: Optional[Dict[str, Any]] = None

class TestSessionUpdate(BaseModel):
    raw_data: Dict[str, Any]
    qualitative_data: Optional[Dict[str, Any]] = None

class TestSessionOut(BaseModel):
    id: str
    patient_id: str
    protocol_id: Optional[str]
    execution_plan_id: Optional[str]
    test_type: str
    date: datetime
    raw_data: Dict[str, Any] = {}
    calculated_scores: Optional[Dict[str, Any]] = None
    qualitative_data: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True
