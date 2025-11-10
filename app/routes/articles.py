from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import User, Article, Tag
from app.schemas import ArticleCreate, ArticleResponse, ArticleDetailResponse, ArticleUpdate
from app.auth import get_current_user
from app.parser import article_parser

router = APIRouter(prefix="/articles", tags=["Articles"])


@router.post("", response_model=ArticleResponse, status_code=status.HTTP_201_CREATED)
def create_article(
    article_data: ArticleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check if article already exists for this user
    existing = db.query(Article).filter(
        Article.user_id == current_user.id,
        Article.url == article_data.url
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Article already saved"
        )

    # Parse article content
    parsed_data = article_parser.parse(article_data.url)

    # Create article
    article = Article(
        user_id=current_user.id,
        url=article_data.url,
        title=parsed_data.get('title'),
        content=parsed_data.get('content'),
        excerpt=parsed_data.get('excerpt'),
        author=parsed_data.get('author'),
        published_date=parsed_data.get('published_date'),
        site_name=parsed_data.get('site_name')
    )

    # Add tags
    if article_data.tags:
        for tag_name in article_data.tags:
            tag = db.query(Tag).filter(
                Tag.user_id == current_user.id,
                Tag.name == tag_name
            ).first()

            if not tag:
                tag = Tag(user_id=current_user.id, name=tag_name)
                db.add(tag)

            article.tags.append(tag)

    db.add(article)
    db.commit()
    db.refresh(article)

    return article


@router.get("", response_model=List[ArticleResponse])
def get_articles(
    skip: int = 0,
    limit: int = 50,
    archived: Optional[bool] = None,
    favorite: Optional[bool] = None,
    tag: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Article).filter(Article.user_id == current_user.id)

    if archived is not None:
        query = query.filter(Article.is_archived == archived)

    if favorite is not None:
        query = query.filter(Article.is_favorite == favorite)

    if tag:
        query = query.join(Article.tags).filter(Tag.name == tag)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Article.title.ilike(search_term)) |
            (Article.content.ilike(search_term)) |
            (Article.author.ilike(search_term))
        )

    articles = query.order_by(Article.created_at.desc()).offset(skip).limit(limit).all()
    return articles


@router.get("/{article_id}", response_model=ArticleDetailResponse)
def get_article(
    article_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    article = db.query(Article).filter(
        Article.id == article_id,
        Article.user_id == current_user.id
    ).first()

    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article not found"
        )

    return article


@router.patch("/{article_id}", response_model=ArticleResponse)
def update_article(
    article_id: int,
    article_update: ArticleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    article = db.query(Article).filter(
        Article.id == article_id,
        Article.user_id == current_user.id
    ).first()

    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article not found"
        )

    # Update fields
    update_data = article_update.dict(exclude_unset=True)

    if 'tags' in update_data:
        tag_names = update_data.pop('tags')
        article.tags.clear()

        for tag_name in tag_names:
            tag = db.query(Tag).filter(
                Tag.user_id == current_user.id,
                Tag.name == tag_name
            ).first()

            if not tag:
                tag = Tag(user_id=current_user.id, name=tag_name)
                db.add(tag)

            article.tags.append(tag)

    for field, value in update_data.items():
        setattr(article, field, value)

    db.commit()
    db.refresh(article)

    return article


@router.delete("/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_article(
    article_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    article = db.query(Article).filter(
        Article.id == article_id,
        Article.user_id == current_user.id
    ).first()

    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article not found"
        )

    db.delete(article)
    db.commit()

    return None
