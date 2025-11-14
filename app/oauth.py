from authlib.integrations.starlette_client import OAuth
from app.config import settings

# Initialize OAuth
oauth = OAuth()

# Configure Google OAuth only if enabled
if settings.enable_google_oauth:
    oauth.register(
        name='google',
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
        client_kwargs={
            'scope': 'openid email profile'
        }
    )
