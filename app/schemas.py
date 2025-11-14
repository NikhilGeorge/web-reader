from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    username: str


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


# Tag Schemas
class TagBase(BaseModel):
    name: str
    color: Optional[str] = "#3b82f6"


class TagCreate(TagBase):
    pass


class TagResponse(TagBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True


# Highlight Schemas
class HighlightPosition(BaseModel):
    start: int
    end: int


class HighlightBase(BaseModel):
    type: str = Field(..., pattern="^(highlight|annotation)$")  # Either highlight or annotation
    text: str  # Selected text snippet
    context: Optional[str] = None  # Surrounding text for matching
    position: HighlightPosition  # Character offsets
    color: str = "#fbbf24"  # Default yellow
    note: Optional[str] = None  # Annotation text (required for type=annotation)
    tags: List[str] = []  # Tags for categorization


class HighlightCreate(HighlightBase):
    article_id: str


class HighlightUpdate(BaseModel):
    note: Optional[str] = None
    tags: Optional[List[str]] = None
    color: Optional[str] = None


class HighlightResponse(HighlightBase):
    id: str
    article_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Article Schemas
class ArticleBase(BaseModel):
    url: str


class ArticleCreate(ArticleBase):
    tags: Optional[List[str]] = []


class ArticleUpdate(BaseModel):
    title: Optional[str] = None
    is_archived: Optional[bool] = None
    is_favorite: Optional[bool] = None
    reading_progress: Optional[int] = None
    tags: Optional[List[str]] = None


class ArticleResponse(BaseModel):
    id: str
    url: str
    title: Optional[str] = None
    excerpt: Optional[str] = None
    author: Optional[str] = None
    published_date: Optional[datetime] = None
    site_name: Optional[str] = None
    is_archived: bool
    is_favorite: bool
    reading_progress: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    tags: List[TagResponse] = []

    class Config:
        from_attributes = True


class ArticleDetailResponse(ArticleResponse):
    content: Optional[str] = None
    highlights: List[HighlightResponse] = []
