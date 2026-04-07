from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: str = "Neuropsicólogo"
    can_manage_protocols: bool = False

class UserUpdate(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    can_manage_protocols: Optional[bool] = None
    is_active: Optional[bool] = None

class UserOut(BaseModel):
    id: str
    username: str
    email: Optional[str]
    full_name: Optional[str]
    role: str
    can_manage_protocols: bool
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime]

    class Config:
        from_attributes = True
