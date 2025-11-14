from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from app.schemas import ArticleCreate, ArticleResponse, ArticleDetailResponse, ArticleUpdate
from app.auth import get_current_user
from app.parser import article_parser
from app.storage import storage

router = APIRouter(prefix="/articles", tags=["Articles"])


@router.post("", response_model=ArticleResponse, status_code=status.HTTP_201_CREATED)
def create_article(
    article_data: ArticleCreate,
    current_user: dict = Depends(get_current_user)
):
    username = current_user["username"]

    # Check if article already exists for this user
    if storage.article_exists_by_url(username, article_data.url):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Article already saved"
        )

    # Parse article content
    parsed_data = article_parser.parse(article_data.url)

    # Create article with parsed data and tags
    article_dict = {
        **parsed_data,
        "tags": article_data.tags or []
    }

    article = storage.create_article(username, article_dict)

    # Convert tags list to tag objects for response
    user_tags = storage.list_tags(username)
    tag_objects = []
    for tag_name in article.get("tags", []):
        tag_obj = next((t for t in user_tags if t["name"] == tag_name), None)
        if tag_obj:
            tag_objects.append(tag_obj)

    article["tags"] = tag_objects

    return article


@router.get("", response_model=List[ArticleResponse])
def get_articles(
    skip: int = 0,
    limit: int = 50,
    archived: Optional[bool] = None,
    favorite: Optional[bool] = None,
    tag: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    username = current_user["username"]

    # Build filters
    filters = {}
    if archived is not None:
        filters["archived"] = archived
    if favorite is not None:
        filters["favorite"] = favorite
    if tag:
        filters["tag"] = tag
    if search:
        filters["search"] = search

    # Get articles
    articles = storage.list_articles(username, filters=filters)

    # Apply pagination
    articles = articles[skip:skip + limit]

    # Convert tags list to tag objects for each article
    user_tags = storage.list_tags(username)
    for article in articles:
        tag_objects = []
        for tag_name in article.get("tags", []):
            tag_obj = next((t for t in user_tags if t["name"] == tag_name), None)
            if tag_obj:
                tag_objects.append(tag_obj)
        article["tags"] = tag_objects

    return articles


@router.get("/{article_id}", response_model=ArticleDetailResponse)
def get_article(
    article_id: str,
    current_user: dict = Depends(get_current_user)
):
    username = current_user["username"]

    article = storage.get_article(username, article_id, include_content=True)

    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article not found"
        )

    # Convert tags list to tag objects
    user_tags = storage.list_tags(username)
    tag_objects = []
    for tag_name in article.get("tags", []):
        tag_obj = next((t for t in user_tags if t["name"] == tag_name), None)
        if tag_obj:
            tag_objects.append(tag_obj)
    article["tags"] = tag_objects

    return article


@router.patch("/{article_id}", response_model=ArticleResponse)
def update_article(
    article_id: str,
    article_update: ArticleUpdate,
    current_user: dict = Depends(get_current_user)
):
    username = current_user["username"]

    # Check if article exists
    existing_article = storage.get_article(username, article_id)
    if not existing_article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article not found"
        )

    # Update article
    update_data = article_update.dict(exclude_unset=True)
    article = storage.update_article(username, article_id, update_data)

    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article not found"
        )

    # Convert tags list to tag objects
    user_tags = storage.list_tags(username)
    tag_objects = []
    for tag_name in article.get("tags", []):
        tag_obj = next((t for t in user_tags if t["name"] == tag_name), None)
        if tag_obj:
            tag_objects.append(tag_obj)
    article["tags"] = tag_objects

    return article


@router.delete("/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_article(
    article_id: str,
    current_user: dict = Depends(get_current_user)
):
    username = current_user["username"]

    deleted = storage.delete_article(username, article_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article not found"
        )

    return None
