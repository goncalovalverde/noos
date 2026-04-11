from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime


class ClinicalSessionCreate(BaseModel):
    session_date: date = Field(description="Actual date of the patient visit")
    notes: Optional[str] = Field(default=None, max_length=1000)


class ClinicalSessionOut(BaseModel):
    id: str
    execution_plan_id: str
    session_number: int
    session_date: date
    notes: Optional[str] = None
    created_at: datetime
    test_count: int = 0
    test_types: List[str] = []

    class Config:
        from_attributes = True
