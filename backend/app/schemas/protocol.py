from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class ProtocolTestIn(BaseModel):
    test_type: str
    order: int = 1
    default_notes: Optional[str] = None

class ProtocolTestOut(BaseModel):
    test_type: str
    order: int
    default_notes: Optional[str]

    class Config:
        from_attributes = True

class ProtocolCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    tests: List[ProtocolTestIn] = []
    is_public: bool = True
    allow_customization: bool = True

class ProtocolUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
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
