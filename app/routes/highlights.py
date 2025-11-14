from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from app.schemas import HighlightCreate, HighlightResponse, HighlightUpdate
from app.auth import get_current_user
from app.storage import storage

router = APIRouter(prefix="/highlights", tags=["Highlights"])


@router.post("", response_model=HighlightResponse, status_code=status.HTTP_201_CREATED)
def create_highlight(
    highlight: HighlightCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new highlight or annotation"""
    username = current_user["username"]
    article_id = highlight.article_id

    # Verify article exists
    article = storage.get_article(username, article_id)
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article not found"
        )

    # Validate annotation has a note
    if highlight.type == "annotation" and not highlight.note:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Annotations must have a note"
        )

    # Create highlight
    try:
        new_highlight = storage.create_highlight(
            username=username,
            article_id=article_id,
            highlight_data=highlight.model_dump()
        )
        return new_highlight
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create highlight: {str(e)}"
        )


@router.get("/article/{article_id}", response_model=List[HighlightResponse])
def get_article_highlights(
    article_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all highlights for an article"""
    username = current_user["username"]

    # Verify article exists
    article = storage.get_article(username, article_id)
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article not found"
        )

    highlights = storage.get_highlights(username, article_id)
    return highlights


@router.get("/{highlight_id}", response_model=HighlightResponse)
def get_highlight(
    highlight_id: str,
    article_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific highlight by ID"""
    username = current_user["username"]

    highlight = storage.get_highlight(username, article_id, highlight_id)
    if not highlight:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Highlight not found"
        )

    return highlight


@router.put("/{highlight_id}", response_model=HighlightResponse)
def update_highlight(
    highlight_id: str,
    article_id: str,
    highlight_update: HighlightUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a highlight (note, tags, or color)"""
    username = current_user["username"]

    # Verify article exists
    article = storage.get_article(username, article_id)
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article not found"
        )

    # Update highlight
    updated_highlight = storage.update_highlight(
        username=username,
        article_id=article_id,
        highlight_id=highlight_id,
        updates=highlight_update.model_dump(exclude_unset=True)
    )

    if not updated_highlight:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Highlight not found"
        )

    return updated_highlight


@router.delete("/{highlight_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_highlight(
    highlight_id: str,
    article_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a highlight"""
    username = current_user["username"]

    # Verify article exists
    article = storage.get_article(username, article_id)
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article not found"
        )

    # Delete highlight
    deleted = storage.delete_highlight(username, article_id, highlight_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Highlight not found"
        )

    return None
