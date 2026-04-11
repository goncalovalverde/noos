import json
from pydantic import BaseModel, field_validator, Field
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime

VALID_MODES = Literal["live", "paper"]
VALID_STATUSES = Literal["draft", "active", "completed", "abandoned"]

class TestCustomization(BaseModel):
    test_type: str = Field(min_length=1, max_length=50)
    order: int = Field(default=1, ge=1, le=100)
    skip: bool = False
    added: bool = False
    repeat_later: bool = False
    notes: str = Field(default="", max_length=500)

class ExecutionPlanCreate(BaseModel):
    patient_id: str = Field(min_length=36, max_length=36)
    protocol_id: str = Field(min_length=36, max_length=36)
    mode: VALID_MODES = "paper"
    performed_at: Optional[datetime] = None

class ExecutionPlanUpdate(BaseModel):
    status: Optional[VALID_STATUSES] = None
    mode: Optional[VALID_MODES] = None
    test_customizations: Optional[List[Dict[str, Any]]] = None
    variant_name: Optional[str] = Field(default=None, max_length=100)
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
    allow_customization: bool = True

    @field_validator('test_customizations', mode='before')
    @classmethod
    def parse_customizations(cls, v):
        if isinstance(v, str):
            return json.loads(v) if v else []
        return v

    class Config:
        from_attributes = True
