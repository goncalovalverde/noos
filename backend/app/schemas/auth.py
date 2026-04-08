from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserOut"

class UserOut(BaseModel):
    id: str
    username: str
    email: Optional[str]
    full_name: Optional[str]
    role: str
    can_manage_protocols: bool
    is_active: bool
    last_login: Optional[datetime]

    class Config:
        from_attributes = True

TokenResponse.model_rebuild()

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class RefreshRequest(BaseModel):
    refresh_token: str
