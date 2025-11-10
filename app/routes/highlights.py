from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import User, Article, Highlight
from app.schemas import HighlightCreate, HighlightResponse
from app.auth import get_current_user

router = APIRouter(prefix="/highlights", tags=["Highlights"])


@router.post("", response_model=HighlightResponse, status_code=status.HTTP_201_CREATED)
def create_highlight(
    highlight: HighlightCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify article belongs to user
    article = db.query(Article).filter(
        Article.id == highlight.article_id,
        Article.user_id == current_user.id
    ).first()

    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article not found"
        )

    db_highlight = Highlight(
        article_id=highlight.article_id,
        text=highlight.text,
        note=highlight.note,
        color=highlight.color
    )
    db.add(db_highlight)
    db.commit()
    db.refresh(db_highlight)

    return db_highlight


@router.get("/article/{article_id}", response_model=List[HighlightResponse])
def get_article_highlights(
    article_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify article belongs to user
    article = db.query(Article).filter(
        Article.id == article_id,
        Article.user_id == current_user.id
    ).first()

    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article not found"
        )

    highlights = db.query(Highlight).filter(Highlight.article_id == article_id).all()
    return highlights


@router.delete("/{highlight_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_highlight(
    highlight_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    highlight = db.query(Highlight).join(Article).filter(
        Highlight.id == highlight_id,
        Article.user_id == current_user.id
    ).first()

    if not highlight:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Highlight not found"
        )

    db.delete(highlight)
    db.commit()

    return None
