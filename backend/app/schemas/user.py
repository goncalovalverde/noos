from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Literal
from datetime import datetime

VALID_ROLES = Literal["Administrador", "Neuropsicólogo", "Observador"]

class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=12, max_length=256)
    email: Optional[str] = Field(default=None, max_length=255)
    full_name: Optional[str] = Field(default=None, max_length=100)
    role: VALID_ROLES = "Neuropsicólogo"
    can_manage_protocols: bool = False

class UserUpdate(BaseModel):
    email: Optional[str] = Field(default=None, max_length=255)
    full_name: Optional[str] = Field(default=None, max_length=100)
    role: Optional[VALID_ROLES] = None
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
