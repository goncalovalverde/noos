from pydantic import BaseModel, field_validator, Field
from typing import Optional, Literal
from datetime import datetime

VALID_LATERALITY = Literal["diestro", "zurdo", "ambidextro"]

class PatientCreate(BaseModel):
    age: int = Field(ge=1, le=119)
    education_years: int = Field(ge=0, le=30)
    laterality: VALID_LATERALITY
    initials: Optional[str] = Field(default=None, min_length=1, max_length=10)

class PatientUpdate(BaseModel):
    age: Optional[int] = Field(default=None, ge=1, le=119)
    education_years: Optional[int] = Field(default=None, ge=0, le=30)
    laterality: Optional[VALID_LATERALITY] = None
    initials: Optional[str] = Field(default=None, min_length=1, max_length=10)

class PatientOut(BaseModel):
    id: str
    age: int
    education_years: int
    laterality: str
    initials: Optional[str]
    display_id: Optional[str] = None
    created_at: datetime
    created_by_id: Optional[str] = None

    class Config:
        from_attributes = True
