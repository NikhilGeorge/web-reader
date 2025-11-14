from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Application
    app_name: str = "Web Reader"
    app_version: str = "1.0.0"
    debug: bool = False

    # Security
    secret_key: str = "your-secret-key-change-this-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days
    disable_auth: bool = False  # Set to True to disable authentication

    # Storage
    data_path: str = "./data"
    default_user: str = "demo"  # Default user when auth is disabled

    # CORS
    cors_origins: list = ["*"]

    class Config:
        env_file = ".env"


settings = Settings()
