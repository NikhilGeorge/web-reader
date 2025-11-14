from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from app.schemas import TagCreate, TagResponse
from app.auth import get_current_user
from app.storage import storage

router = APIRouter(prefix="/tags", tags=["Tags"])


@router.post("", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
def create_tag(
    tag: TagCreate,
    current_user: dict = Depends(get_current_user)
):
    username = current_user["username"]

    try:
        new_tag = storage.create_tag(username, tag.name, tag.color)
        return new_tag
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("", response_model=List[TagResponse])
def get_tags(
    current_user: dict = Depends(get_current_user)
):
    username = current_user["username"]
    tags = storage.list_tags(username)
    return tags


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tag(
    tag_id: str,
    current_user: dict = Depends(get_current_user)
):
    username = current_user["username"]

    deleted = storage.delete_tag(username, tag_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found"
        )

    return None
