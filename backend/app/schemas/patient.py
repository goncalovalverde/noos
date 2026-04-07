from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime

class PatientCreate(BaseModel):
    age: int
    education_years: int
    laterality: str   # diestro | zurdo | ambidextro
    initials: Optional[str] = None

    @field_validator("laterality")
    @classmethod
    def validate_laterality(cls, v):
        if v not in ("diestro", "zurdo", "ambidextro"):
            raise ValueError("laterality must be diestro, zurdo or ambidextro")
        return v

    @field_validator("age")
    @classmethod
    def validate_age(cls, v):
        if not 0 < v < 120:
            raise ValueError("age must be between 1 and 119")
        return v

class PatientUpdate(BaseModel):
    age: Optional[int] = None
    education_years: Optional[int] = None
    laterality: Optional[str] = None
    initials: Optional[str] = None

class PatientOut(BaseModel):
    id: str
    age: int
    education_years: int
    laterality: str
    initials: Optional[str]
    display_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
