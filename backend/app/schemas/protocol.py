from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class ProtocolTestIn(BaseModel):
    test_type: str = Field(min_length=1, max_length=50)
    order: int = Field(default=1, ge=1, le=100)
    default_notes: Optional[str] = Field(default=None, max_length=500)

class ProtocolTestOut(BaseModel):
    test_type: str
    order: int
    default_notes: Optional[str]

    class Config:
        from_attributes = True

class ProtocolCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=1000)
    category: Optional[str] = Field(default=None, max_length=50)
    tests: List[ProtocolTestIn] = []
    is_public: bool = True
    allow_customization: bool = True

class ProtocolUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=1000)
    category: Optional[str] = Field(default=None, max_length=50)
    tests: Optional[List[ProtocolTestIn]] = None
    is_public: Optional[bool] = None
    allow_customization: Optional[bool] = None

class ProtocolOut(BaseModel):
    id: str
    name: str
    description: Optional[str]
    category: Optional[str]
    is_public: bool = True
    allow_customization: bool = True
    tests: List[ProtocolTestOut] = []
    created_at: datetime
    updated_at: datetime
    active_plans_count: int = 0

    class Config:
        from_attributes = True
