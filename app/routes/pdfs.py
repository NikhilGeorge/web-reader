from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import Response
from typing import List, Optional
from app.schemas import PDFResponse, PDFDetailResponse, HighlightCreate, HighlightResponse, HighlightUpdate
from app.auth import get_current_user
from app.storage import storage
import json

router = APIRouter(prefix="/pdfs", tags=["PDFs"])


@router.post("", response_model=PDFResponse, status_code=status.HTTP_201_CREATED)
async def upload_pdf(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    tags: Optional[str] = Form("[]"),
    current_user: dict = Depends(get_current_user)
):
    """Upload a new PDF document"""
    username = current_user["username"]

    # Validate file type
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed"
        )

    # Read file content
    pdf_content = await file.read()

    # Validate file size (max 50MB)
    if len(pdf_content) > 50 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PDF file size must be less than 50MB"
        )

    # Parse tags
    try:
        tags_list = json.loads(tags) if tags else []
    except json.JSONDecodeError:
        tags_list = []

    # Create PDF
    try:
        pdf_metadata = storage.create_pdf(
            username=username,
            pdf_file=pdf_content,
            filename=file.filename,
            metadata={"title": title, "tags": tags_list}
        )
        return pdf_metadata
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload PDF: {str(e)}"
        )


@router.get("", response_model=List[PDFResponse])
def list_pdfs(
    archived: Optional[bool] = None,
    favorite: Optional[bool] = None,
    tag: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List all PDFs for the current user"""
    username = current_user["username"]
    filters = {}
    if archived is not None:
        filters["archived"] = archived
    if favorite is not None:
        filters["favorite"] = favorite
    if tag:
        filters["tag"] = tag
    if search:
        filters["search"] = search

    pdfs = storage.list_pdfs(username, filters)
    return pdfs


@router.get("/{pdf_id}", response_model=PDFDetailResponse)
def get_pdf(
    pdf_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get PDF metadata and highlights"""
    username = current_user["username"]
    pdf = storage.get_pdf(username, pdf_id, include_file=False)

    if not pdf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF not found"
        )

    # Load highlights
    highlights = storage.get_pdf_highlights(username, pdf_id)
    pdf["highlights"] = highlights

    return pdf


@router.get("/{pdf_id}/file")
def get_pdf_file(
    pdf_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Download PDF file"""
    username = current_user["username"]
    pdf = storage.get_pdf(username, pdf_id, include_file=True)

    if not pdf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF not found"
        )

    if not pdf.get("file_content"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF file not found"
        )

    return Response(
        content=pdf["file_content"],
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{pdf["filename"]}"'
        }
    )


@router.put("/{pdf_id}", response_model=PDFResponse)
def update_pdf(
    pdf_id: str,
    title: Optional[str] = None,
    is_archived: Optional[bool] = None,
    is_favorite: Optional[bool] = None,
    reading_progress: Optional[int] = None,
    tags: Optional[List[str]] = None,
    current_user: dict = Depends(get_current_user)
):
    """Update PDF metadata"""
    username = current_user["username"]

    # Verify PDF exists
    pdf = storage.get_pdf(username, pdf_id)
    if not pdf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF not found"
        )

    # Prepare updates
    updates = {}
    if title is not None:
        updates["title"] = title
    if is_archived is not None:
        updates["is_archived"] = is_archived
    if is_favorite is not None:
        updates["is_favorite"] = is_favorite
    if reading_progress is not None:
        updates["reading_progress"] = reading_progress
    if tags is not None:
        updates["tags"] = tags

    # Update PDF
    updated_pdf = storage.update_pdf(username, pdf_id, updates)
    return updated_pdf


@router.delete("/{pdf_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pdf(
    pdf_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a PDF"""
    username = current_user["username"]

    deleted = storage.delete_pdf(username, pdf_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF not found"
        )

    return None


# PDF Highlight endpoints
@router.post("/{pdf_id}/highlights", response_model=HighlightResponse, status_code=status.HTTP_201_CREATED)
def create_pdf_highlight(
    pdf_id: str,
    highlight: HighlightCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new highlight or annotation in a PDF"""
    username = current_user["username"]

    # Verify PDF exists
    pdf = storage.get_pdf(username, pdf_id)
    if not pdf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF not found"
        )

    # Validate annotation has a note
    if highlight.type == "annotation" and not highlight.note:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Annotations must have a note"
        )

    # Create highlight
    try:
        new_highlight = storage.create_pdf_highlight(
            username=username,
            pdf_id=pdf_id,
            highlight_data=highlight.model_dump()
        )
        return new_highlight
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create highlight: {str(e)}"
        )


@router.get("/{pdf_id}/highlights", response_model=List[HighlightResponse])
def get_pdf_highlights(
    pdf_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all highlights for a PDF"""
    username = current_user["username"]

    # Verify PDF exists
    pdf = storage.get_pdf(username, pdf_id)
    if not pdf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF not found"
        )

    highlights = storage.get_pdf_highlights(username, pdf_id)
    return highlights


@router.put("/{pdf_id}/highlights/{highlight_id}", response_model=HighlightResponse)
def update_pdf_highlight(
    pdf_id: str,
    highlight_id: str,
    highlight_update: HighlightUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a PDF highlight (note, tags, or color)"""
    username = current_user["username"]

    # Verify PDF exists
    pdf = storage.get_pdf(username, pdf_id)
    if not pdf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF not found"
        )

    # Update highlight
    updated_highlight = storage.update_pdf_highlight(
        username=username,
        pdf_id=pdf_id,
        highlight_id=highlight_id,
        updates=highlight_update.model_dump(exclude_unset=True)
    )

    if not updated_highlight:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Highlight not found"
        )

    return updated_highlight


@router.delete("/{pdf_id}/highlights/{highlight_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pdf_highlight(
    pdf_id: str,
    highlight_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a PDF highlight"""
    username = current_user["username"]

    # Verify PDF exists
    pdf = storage.get_pdf(username, pdf_id)
    if not pdf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF not found"
        )

    # Delete highlight
    deleted = storage.delete_pdf_highlight(username, pdf_id, highlight_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Highlight not found"
        )

    return None
