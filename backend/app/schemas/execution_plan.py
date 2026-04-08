import json
from pydantic import BaseModel, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime

class TestCustomization(BaseModel):
    test_type: str
    order: int = 1
    skip: bool = False
    added: bool = False
    repeat_later: bool = False
    notes: str = ""

class ExecutionPlanCreate(BaseModel):
    patient_id: str
    protocol_id: str
    mode: str = "live"   # live | paper
    performed_at: Optional[datetime] = None  # if paper/deferred, date evaluation was done

class ExecutionPlanUpdate(BaseModel):
    status: Optional[str] = None
    mode: Optional[str] = None
    test_customizations: Optional[List[Dict[str, Any]]] = None
    variant_name: Optional[str] = None
    is_saved_variant: Optional[bool] = None
    performed_at: Optional[datetime] = None

class ExecutionPlanOut(BaseModel):
    id: str
    patient_id: str
    protocol_id: Optional[str]
    status: str
    mode: str
    test_customizations: Optional[List[Dict[str, Any]]] = None
    is_saved_variant: bool
    variant_name: Optional[str]
    performed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    @field_validator('test_customizations', mode='before')
    @classmethod
    def parse_customizations(cls, v):
        if isinstance(v, str):
            return json.loads(v) if v else []
        return v

    class Config:
        from_attributes = True
