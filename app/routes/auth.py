from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta
from app.schemas import UserCreate, UserResponse, Token
from app.auth import get_password_hash, verify_password, create_access_token, get_current_user
from app.config import settings
from app.storage import storage

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get("/config")
def get_auth_config():
    """Return authentication configuration"""
    return {
        "auth_enabled": not settings.disable_auth,
        "default_user": settings.default_user if settings.disable_auth else None
    }


@router.get("/auto-login", response_model=Token)
def auto_login():
    """Auto-login when authentication is disabled"""
    if not settings.disable_auth:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Auto-login is only available when authentication is disabled"
        )

    # Ensure default user exists
    user = storage.get_user_by_username(settings.default_user)
    if not user:
        user = storage.create_user(
            email=f"{settings.default_user}@example.com",
            username=settings.default_user,
            hashed_password=get_password_hash("password")
        )

    # Create access token
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user["username"]}, expires_delta=access_token_expires
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user: UserCreate):
    # Check if user already exists
    existing_user = storage.get_user_by_email(user.email) or storage.get_user_by_username(user.username)

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email or username already registered"
        )

    # Create new user
    hashed_password = get_password_hash(user.password)
    try:
        new_user = storage.create_user(
            email=user.email,
            username=user.username,
            hashed_password=hashed_password
        )
        return new_user
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    # Authenticate user
    user = storage.get_user_by_username(form_data.username)

    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create access token
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user["username"]}, expires_delta=access_token_expires
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: dict = Depends(get_current_user)):
    return current_user
