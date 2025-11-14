from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from datetime import timedelta
from app.schemas import UserResponse
from app.auth import get_password_hash, create_access_token, get_current_user
from app.config import settings
from app.storage import storage
from app.oauth import oauth

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: dict = Depends(get_current_user)):
    return current_user


# Google OAuth routes
@router.get("/google/login")
async def google_login(request: Request):
    """Initiate Google OAuth login flow"""
    if not settings.enable_google_oauth:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Google OAuth is not enabled"
        )

    redirect_uri = settings.google_redirect_uri or str(request.url_for('google_callback'))
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/google/callback", name="google_callback")
async def google_callback(request: Request):
    """Handle Google OAuth callback"""
    if not settings.enable_google_oauth:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Google OAuth is not enabled"
        )

    try:
        # Get OAuth token from Google
        token = await oauth.google.authorize_access_token(request)

        # Get user info from Google
        user_info = token.get('userinfo')
        if not user_info:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to get user information from Google"
            )

        email = user_info.get('email')
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email not provided by Google"
            )

        # Check if email is in allowed list
        allowed_emails_list = [e.strip() for e in settings.allowed_emails.split(',') if e.strip()]
        if allowed_emails_list and email not in allowed_emails_list:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your email is not authorized to access this application"
            )

        # Get or create user
        user = storage.get_user_by_email(email)
        if not user:
            # Create username from email
            username = email.split('@')[0]
            # Ensure username is unique
            existing = storage.get_user_by_username(username)
            counter = 1
            while existing:
                username = f"{email.split('@')[0]}{counter}"
                existing = storage.get_user_by_username(username)
                counter += 1

            # Create user with random password (not used for OAuth)
            import secrets
            random_password = secrets.token_urlsafe(32)
            user = storage.create_user(
                email=email,
                username=username,
                hashed_password=get_password_hash(random_password)
            )

        # Create access token
        access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
        access_token = create_access_token(
            data={"sub": user["username"]}, expires_delta=access_token_expires
        )

        # Redirect to frontend with token
        return RedirectResponse(url=f"/?token={access_token}")

    except Exception as e:
        # Log the error and redirect to login with error
        import traceback
        traceback.print_exc()
        return RedirectResponse(url=f"/?error=auth_failed&message={str(e)}")
