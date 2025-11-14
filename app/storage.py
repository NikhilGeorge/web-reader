"""
File-based storage layer for Web Reader
Handles all file operations for users, articles, tags, and PDFs
"""
import json
import os
from datetime import datetime
from typing import Optional, List, Dict, Any
from pathlib import Path
import uuid
import shutil
from PyPDF2 import PdfReader


class FileStorage:
    """File-based storage manager"""

    def __init__(self, base_path: str = "./data"):
        self.base_path = Path(base_path)
        self.users_file = self.base_path / "users.json"
        self._init_storage()

    def _init_storage(self):
        """Initialize storage directories and files"""
        self.base_path.mkdir(parents=True, exist_ok=True)
        if not self.users_file.exists():
            self._write_json(self.users_file, {"users": []})

    def _read_json(self, file_path: Path) -> Dict:
        """Read JSON file"""
        if not file_path.exists():
            return {}
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _write_json(self, file_path: Path, data: Dict):
        """Write JSON file"""
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, default=str)

    def _get_user_dir(self, username: str) -> Path:
        """Get user directory path"""
        return self.base_path / "users" / username

    # User operations
    def create_user(self, email: str, username: str, hashed_password: str) -> Dict:
        """Create a new user"""
        users_data = self._read_json(self.users_file)

        # Check if user exists
        for user in users_data.get("users", []):
            if user["username"] == username or user["email"] == email:
                raise ValueError("User already exists")

        user = {
            "id": str(uuid.uuid4()),
            "email": email,
            "username": username,
            "hashed_password": hashed_password,
            "created_at": datetime.utcnow().isoformat()
        }

        users_data.setdefault("users", []).append(user)
        self._write_json(self.users_file, users_data)

        # Create user directory structure
        user_dir = self._get_user_dir(username)
        (user_dir / "articles").mkdir(parents=True, exist_ok=True)
        (user_dir / "pdfs").mkdir(parents=True, exist_ok=True)

        # Create tags file
        tags_file = user_dir / "tags.json"
        self._write_json(tags_file, {"tags": []})

        return {k: v for k, v in user.items() if k != "hashed_password"}

    def get_user_by_username(self, username: str) -> Optional[Dict]:
        """Get user by username"""
        users_data = self._read_json(self.users_file)
        for user in users_data.get("users", []):
            if user["username"] == username:
                return user
        return None

    def get_user_by_email(self, email: str) -> Optional[Dict]:
        """Get user by email"""
        users_data = self._read_json(self.users_file)
        for user in users_data.get("users", []):
            if user["email"] == email:
                return user
        return None

    # Article operations
    def create_article(self, username: str, article_data: Dict) -> Dict:
        """Create a new article"""
        user_dir = self._get_user_dir(username)
        articles_dir = user_dir / "articles"

        # Generate unique article ID
        article_id = str(uuid.uuid4())

        # Create metadata
        metadata = {
            "id": article_id,
            "url": article_data.get("url"),
            "title": article_data.get("title"),
            "excerpt": article_data.get("excerpt"),
            "author": article_data.get("author"),
            "published_date": article_data.get("published_date"),
            "site_name": article_data.get("site_name"),
            "is_archived": False,
            "is_favorite": False,
            "reading_progress": 0,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": None,
            "tags": article_data.get("tags", [])
        }

        # Save metadata
        meta_file = articles_dir / f"{article_id}.meta.json"
        self._write_json(meta_file, metadata)

        # Save content
        content_file = articles_dir / f"{article_id}.html"
        content = article_data.get("content", "")
        with open(content_file, 'w', encoding='utf-8') as f:
            f.write(content)

        return metadata

    def get_article(self, username: str, article_id: str, include_content: bool = False) -> Optional[Dict]:
        """Get article by ID"""
        user_dir = self._get_user_dir(username)
        articles_dir = user_dir / "articles"

        meta_file = articles_dir / f"{article_id}.meta.json"
        if not meta_file.exists():
            return None

        metadata = self._read_json(meta_file)

        if include_content:
            content_file = articles_dir / f"{article_id}.html"
            if content_file.exists():
                with open(content_file, 'r', encoding='utf-8') as f:
                    metadata["content"] = f.read()
            else:
                metadata["content"] = None

            # Load highlights if they exist
            highlights_file = articles_dir / f"{article_id}.highlights.json"
            if highlights_file.exists():
                highlights_data = self._read_json(highlights_file)
                metadata["highlights"] = highlights_data.get("highlights", [])
            else:
                metadata["highlights"] = []

        return metadata

    def list_articles(self, username: str, filters: Dict = None) -> List[Dict]:
        """List all articles for a user with optional filters"""
        user_dir = self._get_user_dir(username)
        articles_dir = user_dir / "articles"

        if not articles_dir.exists():
            return []

        articles = []
        for meta_file in articles_dir.glob("*.meta.json"):
            metadata = self._read_json(meta_file)

            # Apply filters
            if filters:
                if filters.get("archived") is not None and metadata.get("is_archived") != filters["archived"]:
                    continue
                if filters.get("favorite") is not None and metadata.get("is_favorite") != filters["favorite"]:
                    continue
                if filters.get("tag") and filters["tag"] not in metadata.get("tags", []):
                    continue
                if filters.get("search"):
                    search_term = filters["search"].lower()
                    if not any([
                        search_term in (metadata.get("title") or "").lower(),
                        search_term in (metadata.get("author") or "").lower(),
                        search_term in (metadata.get("excerpt") or "").lower()
                    ]):
                        continue

            articles.append(metadata)

        # Sort by created_at descending
        articles.sort(key=lambda x: x.get("created_at", ""), reverse=True)

        return articles

    def update_article(self, username: str, article_id: str, updates: Dict) -> Optional[Dict]:
        """Update article metadata"""
        user_dir = self._get_user_dir(username)
        articles_dir = user_dir / "articles"

        meta_file = articles_dir / f"{article_id}.meta.json"
        if not meta_file.exists():
            return None

        metadata = self._read_json(meta_file)

        # Update fields
        for key, value in updates.items():
            if key in ["title", "is_archived", "is_favorite", "reading_progress", "tags"]:
                metadata[key] = value

        metadata["updated_at"] = datetime.utcnow().isoformat()

        self._write_json(meta_file, metadata)
        return metadata

    def delete_article(self, username: str, article_id: str) -> bool:
        """Delete an article"""
        user_dir = self._get_user_dir(username)
        articles_dir = user_dir / "articles"

        meta_file = articles_dir / f"{article_id}.meta.json"
        content_file = articles_dir / f"{article_id}.html"
        highlights_file = articles_dir / f"{article_id}.highlights.json"

        deleted = False
        if meta_file.exists():
            meta_file.unlink()
            deleted = True
        if content_file.exists():
            content_file.unlink()
        if highlights_file.exists():
            highlights_file.unlink()

        return deleted

    def article_exists_by_url(self, username: str, url: str) -> bool:
        """Check if article with URL already exists"""
        articles = self.list_articles(username)
        return any(article.get("url") == url for article in articles)

    # Tag operations
    def create_tag(self, username: str, name: str, color: str = "#3b82f6") -> Dict:
        """Create a new tag"""
        user_dir = self._get_user_dir(username)
        tags_file = user_dir / "tags.json"

        tags_data = self._read_json(tags_file)

        # Check if tag exists
        for tag in tags_data.get("tags", []):
            if tag["name"] == name:
                raise ValueError("Tag already exists")

        tag = {
            "id": str(uuid.uuid4()),
            "name": name,
            "color": color,
            "created_at": datetime.utcnow().isoformat()
        }

        tags_data.setdefault("tags", []).append(tag)
        self._write_json(tags_file, tags_data)

        return tag

    def list_tags(self, username: str) -> List[Dict]:
        """List all tags for a user"""
        user_dir = self._get_user_dir(username)
        tags_file = user_dir / "tags.json"

        if not tags_file.exists():
            return []

        tags_data = self._read_json(tags_file)
        return tags_data.get("tags", [])

    def delete_tag(self, username: str, tag_id: str) -> bool:
        """Delete a tag"""
        user_dir = self._get_user_dir(username)
        tags_file = user_dir / "tags.json"

        if not tags_file.exists():
            return False

        tags_data = self._read_json(tags_file)
        tags = tags_data.get("tags", [])

        # Find and remove tag
        tag_name = None
        new_tags = []
        for tag in tags:
            if tag["id"] == tag_id:
                tag_name = tag["name"]
            else:
                new_tags.append(tag)

        if tag_name is None:
            return False

        tags_data["tags"] = new_tags
        self._write_json(tags_file, tags_data)

        # Remove tag from all articles
        articles = self.list_articles(username)
        for article in articles:
            if tag_name in article.get("tags", []):
                updated_tags = [t for t in article["tags"] if t != tag_name]
                self.update_article(username, article["id"], {"tags": updated_tags})

        return True

    # Highlight operations
    def create_highlight(self, username: str, article_id: str, highlight_data: Dict) -> Dict:
        """Create a new highlight for an article"""
        user_dir = self._get_user_dir(username)
        articles_dir = user_dir / "articles"
        highlights_file = articles_dir / f"{article_id}.highlights.json"

        # Load existing highlights
        if highlights_file.exists():
            highlights_data = self._read_json(highlights_file)
        else:
            highlights_data = {"highlights": []}

        # Create new highlight
        highlight = {
            "id": str(uuid.uuid4()),
            "article_id": article_id,
            "type": highlight_data.get("type"),
            "text": highlight_data.get("text"),
            "context": highlight_data.get("context"),
            "position": highlight_data.get("position"),
            "color": highlight_data.get("color", "#fbbf24"),
            "note": highlight_data.get("note"),
            "tags": highlight_data.get("tags", []),
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": None
        }

        highlights_data["highlights"].append(highlight)
        self._write_json(highlights_file, highlights_data)

        return highlight

    def get_highlights(self, username: str, article_id: str) -> List[Dict]:
        """Get all highlights for an article"""
        user_dir = self._get_user_dir(username)
        articles_dir = user_dir / "articles"
        highlights_file = articles_dir / f"{article_id}.highlights.json"

        if not highlights_file.exists():
            return []

        highlights_data = self._read_json(highlights_file)
        return highlights_data.get("highlights", [])

    def get_highlight(self, username: str, article_id: str, highlight_id: str) -> Optional[Dict]:
        """Get a specific highlight by ID"""
        highlights = self.get_highlights(username, article_id)
        for highlight in highlights:
            if highlight["id"] == highlight_id:
                return highlight
        return None

    def update_highlight(self, username: str, article_id: str, highlight_id: str, updates: Dict) -> Optional[Dict]:
        """Update a highlight"""
        user_dir = self._get_user_dir(username)
        articles_dir = user_dir / "articles"
        highlights_file = articles_dir / f"{article_id}.highlights.json"

        if not highlights_file.exists():
            return None

        highlights_data = self._read_json(highlights_file)
        highlights = highlights_data.get("highlights", [])

        # Find and update highlight
        updated_highlight = None
        for highlight in highlights:
            if highlight["id"] == highlight_id:
                # Update allowed fields
                for key, value in updates.items():
                    if key in ["note", "tags", "color"]:
                        highlight[key] = value
                highlight["updated_at"] = datetime.utcnow().isoformat()
                updated_highlight = highlight
                break

        if updated_highlight is None:
            return None

        self._write_json(highlights_file, highlights_data)
        return updated_highlight

    def delete_highlight(self, username: str, article_id: str, highlight_id: str) -> bool:
        """Delete a highlight"""
        user_dir = self._get_user_dir(username)
        articles_dir = user_dir / "articles"
        highlights_file = articles_dir / f"{article_id}.highlights.json"

        if not highlights_file.exists():
            return False

        highlights_data = self._read_json(highlights_file)
        highlights = highlights_data.get("highlights", [])

        # Filter out the highlight to delete
        new_highlights = [h for h in highlights if h["id"] != highlight_id]

        if len(new_highlights) == len(highlights):
            return False  # Highlight not found

        highlights_data["highlights"] = new_highlights
        self._write_json(highlights_file, highlights_data)

        return True

    # PDF operations
    def create_pdf(self, username: str, pdf_file: bytes, filename: str, metadata: Dict) -> Dict:
        """Create a new PDF document"""
        user_dir = self._get_user_dir(username)
        pdfs_dir = user_dir / "pdfs"

        # Generate unique PDF ID
        pdf_id = str(uuid.uuid4())

        # Save PDF file
        pdf_path = pdfs_dir / f"{pdf_id}.pdf"
        with open(pdf_path, 'wb') as f:
            f.write(pdf_file)

        # Extract page count
        try:
            pdf_reader = PdfReader(pdf_path)
            page_count = len(pdf_reader.pages)
        except Exception:
            page_count = None

        # Create metadata
        pdf_meta = {
            "id": pdf_id,
            "filename": filename,
            "title": metadata.get("title") or filename,
            "file_size": len(pdf_file),
            "page_count": page_count,
            "is_archived": False,
            "is_favorite": False,
            "reading_progress": 0,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": None,
            "tags": metadata.get("tags", [])
        }

        # Save metadata
        meta_file = pdfs_dir / f"{pdf_id}.meta.json"
        self._write_json(meta_file, pdf_meta)

        return pdf_meta

    def get_pdf(self, username: str, pdf_id: str, include_file: bool = False) -> Optional[Dict]:
        """Get PDF by ID"""
        user_dir = self._get_user_dir(username)
        pdfs_dir = user_dir / "pdfs"

        meta_file = pdfs_dir / f"{pdf_id}.meta.json"
        if not meta_file.exists():
            return None

        metadata = self._read_json(meta_file)

        if include_file:
            pdf_path = pdfs_dir / f"{pdf_id}.pdf"
            if pdf_path.exists():
                with open(pdf_path, 'rb') as f:
                    metadata["file_content"] = f.read()
            else:
                metadata["file_content"] = None

            # Load highlights if they exist
            highlights_file = pdfs_dir / f"{pdf_id}.highlights.json"
            if highlights_file.exists():
                highlights_data = self._read_json(highlights_file)
                metadata["highlights"] = highlights_data.get("highlights", [])
            else:
                metadata["highlights"] = []

        return metadata

    def list_pdfs(self, username: str, filters: Dict = None) -> List[Dict]:
        """List all PDFs for a user with optional filters"""
        user_dir = self._get_user_dir(username)
        pdfs_dir = user_dir / "pdfs"

        if not pdfs_dir.exists():
            return []

        pdfs = []
        for meta_file in pdfs_dir.glob("*.meta.json"):
            metadata = self._read_json(meta_file)

            # Apply filters
            if filters:
                if filters.get("archived") is not None and metadata.get("is_archived") != filters["archived"]:
                    continue
                if filters.get("favorite") is not None and metadata.get("is_favorite") != filters["favorite"]:
                    continue
                if filters.get("tag") and filters["tag"] not in metadata.get("tags", []):
                    continue
                if filters.get("search"):
                    search_term = filters["search"].lower()
                    if not any([
                        search_term in (metadata.get("title") or "").lower(),
                        search_term in (metadata.get("filename") or "").lower()
                    ]):
                        continue

            pdfs.append(metadata)

        # Sort by created_at descending
        pdfs.sort(key=lambda x: x.get("created_at", ""), reverse=True)

        return pdfs

    def update_pdf(self, username: str, pdf_id: str, updates: Dict) -> Optional[Dict]:
        """Update PDF metadata"""
        user_dir = self._get_user_dir(username)
        pdfs_dir = user_dir / "pdfs"

        meta_file = pdfs_dir / f"{pdf_id}.meta.json"
        if not meta_file.exists():
            return None

        metadata = self._read_json(meta_file)

        # Update fields
        for key, value in updates.items():
            if key in ["title", "is_archived", "is_favorite", "reading_progress", "tags"]:
                metadata[key] = value

        metadata["updated_at"] = datetime.utcnow().isoformat()

        self._write_json(meta_file, metadata)
        return metadata

    def delete_pdf(self, username: str, pdf_id: str) -> bool:
        """Delete a PDF"""
        user_dir = self._get_user_dir(username)
        pdfs_dir = user_dir / "pdfs"

        meta_file = pdfs_dir / f"{pdf_id}.meta.json"
        pdf_file = pdfs_dir / f"{pdf_id}.pdf"
        highlights_file = pdfs_dir / f"{pdf_id}.highlights.json"

        deleted = False
        if meta_file.exists():
            meta_file.unlink()
            deleted = True
        if pdf_file.exists():
            pdf_file.unlink()
        if highlights_file.exists():
            highlights_file.unlink()

        return deleted

    # PDF Highlight operations (reuse article highlight logic with PDF directory)
    def create_pdf_highlight(self, username: str, pdf_id: str, highlight_data: Dict) -> Dict:
        """Create a new highlight for a PDF"""
        user_dir = self._get_user_dir(username)
        pdfs_dir = user_dir / "pdfs"
        highlights_file = pdfs_dir / f"{pdf_id}.highlights.json"

        # Load existing highlights
        if highlights_file.exists():
            highlights_data = self._read_json(highlights_file)
        else:
            highlights_data = {"highlights": []}

        # Create new highlight
        highlight = {
            "id": str(uuid.uuid4()),
            "article_id": pdf_id,  # Reuse article_id field for PDF ID
            "type": highlight_data.get("type"),
            "text": highlight_data.get("text"),
            "context": highlight_data.get("context"),
            "position": highlight_data.get("position"),
            "color": highlight_data.get("color", "#fbbf24"),
            "note": highlight_data.get("note"),
            "tags": highlight_data.get("tags", []),
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": None
        }

        highlights_data["highlights"].append(highlight)
        self._write_json(highlights_file, highlights_data)

        return highlight

    def get_pdf_highlights(self, username: str, pdf_id: str) -> List[Dict]:
        """Get all highlights for a PDF"""
        user_dir = self._get_user_dir(username)
        pdfs_dir = user_dir / "pdfs"
        highlights_file = pdfs_dir / f"{pdf_id}.highlights.json"

        if not highlights_file.exists():
            return []

        highlights_data = self._read_json(highlights_file)
        return highlights_data.get("highlights", [])

    def get_pdf_highlight(self, username: str, pdf_id: str, highlight_id: str) -> Optional[Dict]:
        """Get a specific PDF highlight by ID"""
        highlights = self.get_pdf_highlights(username, pdf_id)
        for highlight in highlights:
            if highlight["id"] == highlight_id:
                return highlight
        return None

    def update_pdf_highlight(self, username: str, pdf_id: str, highlight_id: str, updates: Dict) -> Optional[Dict]:
        """Update a PDF highlight"""
        user_dir = self._get_user_dir(username)
        pdfs_dir = user_dir / "pdfs"
        highlights_file = pdfs_dir / f"{pdf_id}.highlights.json"

        if not highlights_file.exists():
            return None

        highlights_data = self._read_json(highlights_file)
        highlights = highlights_data.get("highlights", [])

        # Find and update highlight
        updated_highlight = None
        for highlight in highlights:
            if highlight["id"] == highlight_id:
                # Update allowed fields
                for key, value in updates.items():
                    if key in ["note", "tags", "color"]:
                        highlight[key] = value
                highlight["updated_at"] = datetime.utcnow().isoformat()
                updated_highlight = highlight
                break

        if updated_highlight is None:
            return None

        self._write_json(highlights_file, highlights_data)
        return updated_highlight

    def delete_pdf_highlight(self, username: str, pdf_id: str, highlight_id: str) -> bool:
        """Delete a PDF highlight"""
        user_dir = self._get_user_dir(username)
        pdfs_dir = user_dir / "pdfs"
        highlights_file = pdfs_dir / f"{pdf_id}.highlights.json"

        if not highlights_file.exists():
            return False

        highlights_data = self._read_json(highlights_file)
        highlights = highlights_data.get("highlights", [])

        # Filter out the highlight to delete
        new_highlights = [h for h in highlights if h["id"] != highlight_id]

        if len(new_highlights) == len(highlights):
            return False  # Highlight not found

        highlights_data["highlights"] = new_highlights
        self._write_json(highlights_file, highlights_data)

        return True


# Singleton instance
storage = FileStorage()
