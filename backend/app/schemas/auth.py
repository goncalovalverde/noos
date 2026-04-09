from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

from app.schemas.user import UserOut  # canonical — avoid duplication


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    # max_length prevents bcrypt DoS: hashing a multi-MB payload is expensive
    password: str = Field(min_length=1, max_length=256)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=12, max_length=256)


class RefreshRequest(BaseModel):
    refresh_token: str
