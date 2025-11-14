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

    # Google OAuth
    google_client_id: Optional[str] = None
    google_client_secret: Optional[str] = None
    google_redirect_uri: Optional[str] = None  # e.g., https://your-app.run.app/api/auth/google/callback
    allowed_emails: str = ""  # Comma-separated list of allowed email addresses
    enable_google_oauth: bool = False  # Set to True to enable Google OAuth

    # Storage
    data_path: str = "./data"
    default_user: str = "demo"  # Default user when auth is disabled

    # CORS
    cors_origins: list = ["*"]

    class Config:
        env_file = ".env"


settings = Settings()
