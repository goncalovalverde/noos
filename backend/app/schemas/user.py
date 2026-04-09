from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

from app.enums import UserRole


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=12, max_length=256)
    email: Optional[str] = Field(default=None, max_length=255)
    full_name: Optional[str] = Field(default=None, max_length=100)
    role: UserRole = UserRole.NEURO
    can_manage_protocols: bool = False


class UserUpdate(BaseModel):
    email: Optional[str] = Field(default=None, max_length=255)
    full_name: Optional[str] = Field(default=None, max_length=100)
    role: Optional[UserRole] = None
    can_manage_protocols: Optional[bool] = None
    is_active: Optional[bool] = None


class ProfileUpdate(BaseModel):
    """Schema for PATCH /users/me — self-service profile and password update."""
    email: Optional[EmailStr] = Field(default=None, max_length=255)
    current_password: Optional[str] = Field(default=None, min_length=1, max_length=256)
    new_password: Optional[str] = Field(default=None, min_length=12, max_length=256)


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
