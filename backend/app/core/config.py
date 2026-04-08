from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./noos.db"
    SECRET_KEY: str = "changeme"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ENVIRONMENT: str = "development"
    REPORTS_DIR: str = "../reports"
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]
    ADMIN_PASSWORD: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
