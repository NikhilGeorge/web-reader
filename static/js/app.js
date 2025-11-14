// API Base URL
const API_BASE = '/api';

// State
let currentUser = null;
let articles = [];
let pdfs = [];
let tags = [];
let currentFilter = 'all';
let currentTag = null;
let searchQuery = '';
let currentArticle = null;

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    // Setup app event listeners (always needed)
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('add-article-btn').addEventListener('click', handleAddArticle);
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    document.getElementById('close-reader').addEventListener('click', closeReader);
    document.getElementById('search-input').addEventListener('input', handleSearch);

    // Filter navigation (always needed)
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            currentFilter = item.dataset.filter;
            currentTag = null;
            loadArticles();
        });
    });

    // Load theme preference
    if (localStorage.getItem('theme') === 'dark') {
        document.documentElement.classList.add('dark');
        document.getElementById('theme-toggle').textContent = '☀️';
    }

    // Google OAuth is always enabled in this implementation
    // No need to check auth config

    // Check for token in URL (from OAuth callback)
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    const errorFromUrl = urlParams.get('error');

    if (tokenFromUrl) {
        // Store token and remove from URL
        localStorage.setItem('token', tokenFromUrl);
        window.history.replaceState({}, document.title, window.location.pathname);
        await fetchCurrentUser();
        return;
    }

    if (errorFromUrl) {
        const message = urlParams.get('message') || 'Authentication failed';
        alert(`Error: ${message}`);
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (token) {
        fetchCurrentUser();
    }

    // Google OAuth login button
    const googleLoginBtn = document.getElementById('google-login-btn');
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', () => {
            window.location.href = '/api/auth/google/login';
        });
    }
});

// Authentication
async function fetchCurrentUser() {
    try {
        const response = await apiRequest('/auth/me');
        currentUser = response;
        showApp();
        loadArticles();
        loadTags();
    } catch (error) {
        localStorage.removeItem('token');
        showAuth();
    }
}

function handleLogout() {
    localStorage.removeItem('token');
    currentUser = null;
    articles = [];
    tags = [];
    showAuth();
    showToast('Logged out successfully', 'success');
}

function showAuth() {
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('app-section').classList.add('hidden');
}

function showApp() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('app-section').classList.remove('hidden');
    document.getElementById('user-name').textContent = currentUser.username;
}

// Articles
async function loadArticles() {
    try {
        let articleUrl = '/articles?limit=100';
        let pdfUrl = '/pdfs?';

        if (currentFilter === 'favorite') {
            articleUrl += '&favorite=true';
            pdfUrl += '&favorite=true';
        } else if (currentFilter === 'archived') {
            articleUrl += '&archived=true';
            pdfUrl += '&archived=true';
        } else if (currentFilter === 'all') {
            articleUrl += '&archived=false';
            pdfUrl += '&archived=false';
        }

        if (currentTag) {
            articleUrl += `&tag=${encodeURIComponent(currentTag)}`;
            pdfUrl += `&tag=${encodeURIComponent(currentTag)}`;
        }

        if (searchQuery) {
            articleUrl += `&search=${encodeURIComponent(searchQuery)}`;
            pdfUrl += `&search=${encodeURIComponent(searchQuery)}`;
        }

        // Fetch both articles and PDFs in parallel
        const [fetchedArticles, fetchedPDFs] = await Promise.all([
            apiRequest(articleUrl),
            apiRequest(pdfUrl)
        ]);

        articles = fetchedArticles;
        pdfs = fetchedPDFs || [];

        renderArticles();
    } catch (error) {
        showToast('Failed to load content', 'error');
    }
}

function renderArticles() {
    const container = document.getElementById('article-list');
    container.innerHTML = '';

    const totalItems = articles.length + pdfs.length;

    if (totalItems === 0) {
        container.innerHTML = '<div class="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">No content found. Add articles or upload PDFs to get started!</div>';
        return;
    }

    // Combine and sort all items by date
    const allItems = [
        ...articles.map(a => ({ ...a, type: 'article' })),
        ...pdfs.map(p => ({ ...p, type: 'pdf' }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    allItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 hover:shadow-lg dark:hover:shadow-gray-900/50 transition cursor-pointer';

        if (item.type === 'article') {
            card.onclick = () => openArticle(item.id);
        } else {
            card.onclick = () => openPDF(item.id);
        }

        const tagsHtml = item.tags.map(tag =>
            `<span class="inline-block px-2 py-1 text-xs font-medium rounded" style="background: ${tag.color}20; color: ${tag.color}">${tag.name}</span>`
        ).join('');

        const date = new Date(item.created_at).toLocaleDateString();
        const favoriteIcon = item.is_favorite ? '⭐' : '';
        const archiveIcon = item.is_archived ? '📦' : '';
        const typeIcon = item.type === 'pdf' ? '📄' : '📰';

        if (item.type === 'article') {
            card.innerHTML = `
                <div class="flex justify-between items-start mb-3">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="text-xl">${typeIcon}</span>
                            <h3 class="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2">${item.title || 'Untitled'}</h3>
                        </div>
                        <div class="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            ${item.site_name ? `<span>${item.site_name}</span>` : ''}
                            ${item.author ? `<span class="before:content-['•'] before:mx-2">by ${item.author}</span>` : ''}
                            <span class="before:content-['•'] before:mx-2">${date}</span>
                        </div>
                    </div>
                    <div class="flex gap-1 text-lg">
                        ${favoriteIcon} ${archiveIcon}
                    </div>
                </div>
                ${item.excerpt ? `<p class="text-gray-600 dark:text-gray-300 text-sm line-clamp-3 mb-3">${item.excerpt}</p>` : ''}
                <div class="flex flex-wrap gap-2 mt-3">
                    ${tagsHtml}
                </div>
            `;
        } else {
            // PDF card
            const pageInfo = item.page_count ? `${item.page_count} pages` : '';
            const sizeInfo = item.file_size ? `${(item.file_size / 1024 / 1024).toFixed(1)} MB` : '';

            card.innerHTML = `
                <div class="flex justify-between items-start mb-3">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="text-xl">${typeIcon}</span>
                            <h3 class="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2">${item.title || item.filename}</h3>
                        </div>
                        <div class="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            ${pageInfo ? `<span>${pageInfo}</span>` : ''}
                            ${sizeInfo ? `<span class="before:content-['•'] before:mx-2">${sizeInfo}</span>` : ''}
                            <span class="before:content-['•'] before:mx-2">${date}</span>
                        </div>
                    </div>
                    <div class="flex gap-1 text-lg">
                        ${favoriteIcon} ${archiveIcon}
                    </div>
                </div>
                <div class="flex flex-wrap gap-2 mt-3">
                    ${tagsHtml}
                </div>
            `;
        }

        container.appendChild(card);
    });
}

async function handleAddArticle() {
    const url = document.getElementById('new-article-url').value.trim();

    if (!url) {
        showToast('Please enter a URL', 'error');
        return;
    }

    try {
        showToast('Saving article...', 'success');
        await apiRequest('/articles', {
            method: 'POST',
            body: JSON.stringify({ url, tags: [] })
        });

        document.getElementById('new-article-url').value = '';
        loadArticles();
        showToast('Article saved successfully!', 'success');
    } catch (error) {
        console.error('Failed to save article:', error);
        showToast(`Failed to save article: ${error.message}`, 'error');
    }
}

async function openArticle(articleId) {
    try {
        currentArticle = await apiRequest(`/articles/${articleId}`);
        renderArticleReader();
        // Hide sidebar and article list, show reader
        document.getElementById('sidebar').classList.add('hidden');
        document.getElementById('article-list-container').classList.add('hidden');
        document.getElementById('article-reader').classList.remove('hidden');
    } catch (error) {
        showToast('Failed to load article', 'error');
    }
}

function closeReader() {
    // Show sidebar and article list, hide reader
    document.getElementById('sidebar').classList.remove('hidden');
    document.getElementById('article-list-container').classList.remove('hidden');
    document.getElementById('article-reader').classList.add('hidden');

    // Hide highlight popup and annotation modal
    hideHighlightPopup();
    const annotationModal = document.getElementById('annotation-modal');
    if (annotationModal) {
        annotationModal.classList.add('hidden');
        annotationModal.innerHTML = '';
    }

    currentArticle = null;
    currentSelection = null;
    currentHighlights = [];
    loadArticles();
}

function renderArticleReader() {
    document.getElementById('reader-title').textContent = currentArticle.title || 'Untitled';

    const metaParts = [];
    if (currentArticle.author) metaParts.push(currentArticle.author);
    if (currentArticle.published_date) {
        metaParts.push(new Date(currentArticle.published_date).toLocaleDateString());
    }
    if (currentArticle.site_name) metaParts.push(currentArticle.site_name);

    document.getElementById('reader-author').textContent = metaParts.join(' • ');

    const tagsHtml = currentArticle.tags.map(tag =>
        `<span class="inline-block px-3 py-1 text-sm font-medium rounded-full" style="background: ${tag.color}20; color: ${tag.color}">${tag.name}</span>`
    ).join('');
    document.getElementById('reader-tags').innerHTML = tagsHtml;

    const content = currentArticle.content || '<p class="text-gray-600 dark:text-gray-400">No content available</p>';
    document.getElementById('reader-body').innerHTML = content;

    // Initialize highlight system and load highlights after content is rendered
    initializeHighlightSystem();
    loadHighlights(currentArticle.id);

    // Set up action buttons
    const favoriteBtn = document.getElementById('favorite-btn');
    favoriteBtn.textContent = currentArticle.is_favorite ? '⭐' : '☆';
    favoriteBtn.onclick = () => toggleFavorite();

    const archiveBtn = document.getElementById('archive-btn');
    archiveBtn.textContent = currentArticle.is_archived ? '📂' : '📦';
    archiveBtn.onclick = () => toggleArchive();

    document.getElementById('delete-article-btn').onclick = () => deleteArticle();
}

async function toggleFavorite() {
    try {
        await apiRequest(`/articles/${currentArticle.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ is_favorite: !currentArticle.is_favorite })
        });
        currentArticle.is_favorite = !currentArticle.is_favorite;
        renderArticleReader();
        showToast(currentArticle.is_favorite ? 'Added to favorites' : 'Removed from favorites', 'success');
    } catch (error) {
        showToast('Failed to update article', 'error');
    }
}

async function toggleArchive() {
    try {
        await apiRequest(`/articles/${currentArticle.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ is_archived: !currentArticle.is_archived })
        });
        currentArticle.is_archived = !currentArticle.is_archived;
        renderArticleReader();
        showToast(currentArticle.is_archived ? 'Archived' : 'Unarchived', 'success');
    } catch (error) {
        showToast('Failed to update article', 'error');
    }
}

async function deleteArticle() {
    if (!confirm('Are you sure you want to delete this article?')) {
        return;
    }

    try {
        await apiRequest(`/articles/${currentArticle.id}`, {
            method: 'DELETE'
        });
        showToast('Article deleted', 'success');
        closeReader();
    } catch (error) {
        showToast('Failed to delete article', 'error');
    }
}

// Tags
async function loadTags() {
    try {
        tags = await apiRequest('/tags');
        renderTags();
    } catch (error) {
        showToast('Failed to load tags', 'error');
    }
}

function renderTags() {
    const container = document.getElementById('tags-list');
    container.innerHTML = '';

    tags.forEach(tag => {
        const tagEl = document.createElement('div');
        tagEl.className = 'tag-item';
        tagEl.onclick = () => filterByTag(tag.name);

        tagEl.innerHTML = `
            <div class="tag-name">
                <span class="tag-color" style="background: ${tag.color}"></span>
                <span>${tag.name}</span>
            </div>
        `;

        container.appendChild(tagEl);
    });
}

function filterByTag(tagName) {
    currentTag = tagName;
    currentFilter = 'all';
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    loadArticles();
}

document.getElementById('add-tag-btn').addEventListener('click', async () => {
    const name = prompt('Enter tag name:');
    if (!name) return;

    try {
        await apiRequest('/tags', {
            method: 'POST',
            body: JSON.stringify({ name })
        });
        loadTags();
        showToast('Tag created', 'success');
    } catch (error) {
        showToast('Failed to create tag', 'error');
    }
});

// Search
function handleSearch(e) {
    searchQuery = e.target.value;
    // Debounce search
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(() => {
        loadArticles();
    }, 300);
}

// Theme
function toggleTheme() {
    const isDark = document.documentElement.classList.contains('dark');

    if (isDark) {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
        document.getElementById('theme-toggle').textContent = '🌙';
    } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
        document.getElementById('theme-toggle').textContent = '☀️';
    }
}

// Utilities
async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: { ...headers, ...options.headers }
    });

    if (!response.ok) {
        if (response.status === 401) {
            handleLogout();
        }
        throw new Error(`API request failed: ${response.statusText}`);
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');

    const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
    toast.className = `${bgColor} text-white px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 opacity-0 translate-y-2`;
    toast.textContent = message;

    container.appendChild(toast);

    // Trigger animation
    setTimeout(() => {
        toast.classList.remove('opacity-0', 'translate-y-2');
    }, 10);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Highlights and Annotations
let currentSelection = null;
let currentHighlights = [];
let highlightSystemInitialized = false;
let isClosingPopup = false;  // Flag to prevent popup from re-showing after explicit close

function initializeHighlightSystem() {
    if (highlightSystemInitialized) return;

    const readerBody = document.getElementById('reader-body');
    const popup = document.getElementById('highlight-popup');

    if (!readerBody || !popup) {
        console.error('Reader body or popup not found');
        return;
    }

    // Handle text selection
    readerBody.addEventListener('mouseup', handleTextSelection);

    // Handle highlight popup buttons
    const highlightBtn = document.getElementById('highlight-btn');
    const annotateBtn = document.getElementById('annotate-btn');
    const closePopupBtn = document.getElementById('close-highlight-popup');

    if (highlightBtn) {
        highlightBtn.addEventListener('click', () => {
            createHighlight('highlight');
            hideHighlightPopup();
        });
    }

    if (annotateBtn) {
        annotateBtn.addEventListener('click', () => {
            showAnnotationModal();
        });
    }

    if (closePopupBtn) {
        // Use mousedown instead of click to fire before mouseup/text selection
        closePopupBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            isClosingPopup = true;  // Set flag to prevent re-showing
            hideHighlightPopup();
            // Reset flag after a short delay
            setTimeout(() => {
                isClosingPopup = false;
            }, 150);
        });
    } else {
        console.error('Close highlight popup button not found');
    }

    // Hide popup when clicking elsewhere
    document.addEventListener('mousedown', (e) => {
        // Check if we're already in the process of closing
        if (isClosingPopup) {
            return;
        }

        // Only hide if popup is currently visible
        if (popup.classList.contains('hidden')) {
            return;
        }

        // Don't hide if clicking on the popup itself or the close button
        if (!popup.contains(e.target) && !e.target.closest('#annotation-modal')) {
            isClosingPopup = true;  // Set flag when closing via click outside
            hideHighlightPopup();
            setTimeout(() => {
                isClosingPopup = false;
            }, 150);
        }
    });

    // Hide popup and modal on ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Esc') {
            // Close annotation modal if open
            const modalContainer = document.getElementById('annotation-modal');
            if (modalContainer && !modalContainer.classList.contains('hidden')) {
                modalContainer.classList.add('hidden');
                isClosingPopup = true;
                hideHighlightPopup();
                setTimeout(() => {
                    isClosingPopup = false;
                }, 100);
                e.preventDefault();
                return;
            }

            // Close highlight popup if visible
            if (popup && !popup.classList.contains('hidden')) {
                isClosingPopup = true;
                hideHighlightPopup();
                setTimeout(() => {
                    isClosingPopup = false;
                }, 100);
                e.preventDefault();
            }
        }
    });

    highlightSystemInitialized = true;
}

function handleTextSelection(e) {
    // Don't show popup if we're in the process of closing it
    if (isClosingPopup) {
        return;
    }

    // Don't show popup if clicking on the popup itself
    const popup = document.getElementById('highlight-popup');
    if (popup && popup.contains(e.target)) {
        return;
    }

    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    // Only show popup if text is selected and within reader body
    if (selectedText && selectedText.length > 0) {
        const range = selection.getRangeAt(0);
        const readerBody = document.getElementById('reader-body');

        // Check if selection is within reader body
        if (!readerBody.contains(range.commonAncestorContainer)) {
            return;
        }

        // Store selection data
        currentSelection = {
            text: selectedText,
            range: range.cloneRange()
        };

        showHighlightPopup(e.clientX, e.clientY);
    } else {
        hideHighlightPopup();
    }
}

function showHighlightPopup(x, y) {
    const popup = document.getElementById('highlight-popup');
    popup.classList.remove('hidden');
    popup.style.display = 'flex';  // Force show with inline style

    // Account for page scroll
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;

    // Position popup near cursor, but keep it on screen
    const popupRect = popup.getBoundingClientRect();
    let left = x - (popupRect.width / 2);
    let top = y + scrollY - popupRect.height - 10;

    // Keep popup on screen horizontally
    if (left < scrollX + 10) left = scrollX + 10;
    if (left + popupRect.width > scrollX + window.innerWidth - 10) {
        left = scrollX + window.innerWidth - popupRect.width - 10;
    }

    // If not enough space above, show below cursor
    if (y - popupRect.height - 10 < 0) {
        top = y + scrollY + 20;
    }

    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
}

function hideHighlightPopup() {
    const popup = document.getElementById('highlight-popup');
    if (popup) {
        popup.classList.add('hidden');
        popup.style.display = 'none';  // Force hide with inline style
        // Clear selection when hiding popup
        window.getSelection().removeAllRanges();
        currentSelection = null;
    }
}

function handlePDFTextSelection(e) {
    // Don't show popup if we're in the process of closing it
    if (isClosingPopup) {
        return;
    }

    // Don't show popup if clicking on the popup itself
    const popup = document.getElementById('highlight-popup');
    if (popup && popup.contains(e.target)) {
        return;
    }

    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    // Only show popup if text is selected within PDF text layer
    if (selectedText && selectedText.length > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Store selection info for creating highlights
        currentSelection = {
            text: selectedText,
            range: range,
            rect: rect
        };

        // Show popup near selection
        showHighlightPopup(rect.right, rect.top);
    } else {
        hideHighlightPopup();
    }
}

async function createHighlight(type, note = null) {
    if (!currentSelection) return;
    if (!currentArticle && !currentPDF) return;

    try {
        let highlightData;
        let apiEndpoint;

        // Check if we're highlighting in a PDF or article
        if (currentPDF) {
            // PDF highlighting
            const textLayerDiv = document.getElementById('pdf-text-layer');
            const fullText = textLayerDiv.textContent;
            const range = currentSelection.range;

            // Calculate character offsets within the current page
            const preRange = document.createRange();
            preRange.selectNodeContents(textLayerDiv);
            preRange.setEnd(range.startContainer, range.startOffset);
            const start = preRange.toString().length;
            const end = start + currentSelection.text.length;

            // Get context (50 chars before and after)
            const contextStart = Math.max(0, start - 50);
            const contextEnd = Math.min(fullText.length, end + 50);
            const context = fullText.substring(contextStart, contextEnd);

            highlightData = {
                article_id: currentPDF.id,  // Required by schema (represents PDF ID)
                type: type,
                text: currentSelection.text,
                context: context,
                position: {
                    start,
                    end,
                    page: currentPage  // Include current PDF page number
                },
                color: '#fbbf24',
                note: note,
                tags: []
            };

            apiEndpoint = `/pdfs/${currentPDF.id}/highlights`;
        } else {
            // Article highlighting
            const readerBody = document.getElementById('reader-body');
            const fullText = readerBody.textContent;
            const range = currentSelection.range;

            // Calculate character offsets
            const preRange = document.createRange();
            preRange.selectNodeContents(readerBody);
            preRange.setEnd(range.startContainer, range.startOffset);
            const start = preRange.toString().length;
            const end = start + currentSelection.text.length;

            // Get context (50 chars before and after)
            const contextStart = Math.max(0, start - 50);
            const contextEnd = Math.min(fullText.length, end + 50);
            const context = fullText.substring(contextStart, contextEnd);

            highlightData = {
                article_id: currentArticle.id,
                type: type,
                text: currentSelection.text,
                context: context,
                position: { start, end },
                color: '#fbbf24',
                note: note,
                tags: []
            };

            apiEndpoint = '/highlights';
        }

        const newHighlight = await apiRequest(apiEndpoint, {
            method: 'POST',
            body: JSON.stringify(highlightData)
        });

        // Add to current highlights
        currentHighlights.push(newHighlight);

        // Apply highlight to DOM
        if (currentArticle) {
            applyHighlightToDOM(newHighlight);
        } else if (currentPDF) {
            // Re-apply all highlights to the current PDF page
            applyPDFHighlights(currentPage);
        }

        // Clear selection
        window.getSelection().removeAllRanges();
        currentSelection = null;

        showToast(type === 'highlight' ? 'Highlighted' : 'Annotation added', 'success');
    } catch (error) {
        console.error('Failed to create highlight:', error);
        showToast('Failed to create ' + type, 'error');
    }
}

function applyHighlightToDOM(highlight) {
    const readerBody = document.getElementById('reader-body');
    const walker = document.createTreeWalker(
        readerBody,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );

    let charCount = 0;
    const nodesToHighlight = [];

    // Find text nodes that contain the highlight
    while (walker.nextNode()) {
        const node = walker.currentNode;
        const nodeLength = node.textContent.length;
        const nodeStart = charCount;
        const nodeEnd = charCount + nodeLength;

        // Check if this node overlaps with the highlight
        if (nodeEnd > highlight.position.start && nodeStart < highlight.position.end) {
            const highlightStart = Math.max(0, highlight.position.start - nodeStart);
            const highlightEnd = Math.min(nodeLength, highlight.position.end - nodeStart);

            nodesToHighlight.push({
                node: node,
                start: highlightStart,
                end: highlightEnd
            });
        }

        charCount += nodeLength;

        if (charCount >= highlight.position.end) break;
    }

    // Apply highlight spans
    nodesToHighlight.reverse().forEach(item => {
        const node = item.node;
        const range = document.createRange();
        range.setStart(node, item.start);
        range.setEnd(node, item.end);

        const span = document.createElement('span');
        span.className = 'highlight';
        span.dataset.highlightId = highlight.id;
        span.dataset.type = highlight.type;
        if (highlight.note) {
            span.dataset.note = highlight.note;
        }

        // Add click handler for editing
        span.addEventListener('click', () => handleHighlightClick(highlight));

        range.surroundContents(span);
    });
}

function handleHighlightClick(highlight) {
    if (highlight.type === 'annotation') {
        // Show annotation in modal
        showAnnotationModal(highlight);
    }
}

function showAnnotationModal(existingHighlight = null) {
    const modalContainer = document.getElementById('annotation-modal');

    const modalHTML = `
        <div class="modal-overlay">
            <div class="modal-content">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
                        ${existingHighlight ? 'Edit Annotation' : 'Add Annotation'}
                    </h3>
                    <button id="close-modal" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none transition" title="Close">×</button>
                </div>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    "${currentSelection ? currentSelection.text : (existingHighlight ? existingHighlight.text : '')}"
                </p>
                <textarea id="annotation-text" rows="4" placeholder="Enter your note..."
                    class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition resize-none mb-4">${existingHighlight && existingHighlight.note ? existingHighlight.note : ''}</textarea>
                <div class="flex justify-end gap-3">
                    <button id="cancel-annotation" class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition font-medium">
                        Cancel
                    </button>
                    ${existingHighlight ? `
                    <button id="delete-annotation" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition font-medium">
                        Delete
                    </button>` : ''}
                    <button id="save-annotation" class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition font-medium">
                        ${existingHighlight ? 'Update' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    `;

    modalContainer.innerHTML = modalHTML;
    modalContainer.classList.remove('hidden');

    // Focus textarea
    setTimeout(() => document.getElementById('annotation-text').focus(), 100);

    // Close modal when clicking outside (on the overlay)
    document.querySelector('.modal-overlay').addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            modalContainer.classList.add('hidden');
            hideHighlightPopup();
        }
    });

    // Handle close button (X)
    document.getElementById('close-modal').addEventListener('click', (e) => {
        e.stopPropagation();
        modalContainer.classList.add('hidden');
        hideHighlightPopup();
    });

    // Handle cancel button
    document.getElementById('cancel-annotation').addEventListener('click', () => {
        modalContainer.classList.add('hidden');
        hideHighlightPopup();
    });

    document.getElementById('save-annotation').addEventListener('click', async () => {
        const note = document.getElementById('annotation-text').value.trim();
        if (!note) {
            showToast('Please enter a note', 'error');
            return;
        }

        if (existingHighlight) {
            // Update existing
            await updateAnnotation(existingHighlight.id, note);
        } else {
            // Create new
            await createHighlight('annotation', note);
        }

        modalContainer.classList.add('hidden');
        hideHighlightPopup();
    });

    if (existingHighlight) {
        document.getElementById('delete-annotation').addEventListener('click', async () => {
            if (confirm('Delete this annotation?')) {
                await deleteHighlight(existingHighlight.id);
                modalContainer.classList.add('hidden');
            }
        });
    }
}

async function updateAnnotation(highlightId, note) {
    try {
        await apiRequest(`/highlights/${highlightId}?article_id=${currentArticle.id}`, {
            method: 'PUT',
            body: JSON.stringify({ note })
        });

        // Update local data
        const highlight = currentHighlights.find(h => h.id === highlightId);
        if (highlight) {
            highlight.note = note;
            // Update DOM
            const span = document.querySelector(`[data-highlight-id="${highlightId}"]`);
            if (span) {
                span.dataset.note = note;
            }
        }

        showToast('Annotation updated', 'success');
    } catch (error) {
        showToast('Failed to update annotation', 'error');
    }
}

async function deleteHighlight(highlightId) {
    try {
        await apiRequest(`/highlights/${highlightId}?article_id=${currentArticle.id}`, {
            method: 'DELETE'
        });

        // Remove from local data
        currentHighlights = currentHighlights.filter(h => h.id !== highlightId);

        // Remove from DOM
        const spans = document.querySelectorAll(`[data-highlight-id="${highlightId}"]`);
        spans.forEach(span => {
            const parent = span.parentNode;
            while (span.firstChild) {
                parent.insertBefore(span.firstChild, span);
            }
            parent.removeChild(span);
        });

        showToast('Highlight deleted', 'success');
    } catch (error) {
        showToast('Failed to delete highlight', 'error');
    }
}

async function loadHighlights(articleId) {
    try {
        currentHighlights = currentArticle.highlights || [];

        // Apply all highlights to DOM
        currentHighlights.forEach(highlight => {
            applyHighlightToDOM(highlight);
        });
    } catch (error) {
        console.error('Failed to load highlights:', error);
    }
}

// ==================== PDF FUNCTIONALITY ====================

let currentPDF = null;
let pdfDocument = null;
let currentPage = 1;
let totalPages = 0;
let pdfScale = 1.5;

// PDF Upload Handler
document.getElementById('upload-pdf-btn').addEventListener('click', () => {
    document.getElementById('pdf-file-input').click();
});

document.getElementById('pdf-file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
        showToast('Please select a PDF file', 'error');
        return;
    }

    if (file.size > 50 * 1024 * 1024) {
        showToast('PDF file size must be less than 50MB', 'error');
        return;
    }

    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', file.name.replace('.pdf', ''));
        formData.append('tags', JSON.stringify([]));

        const token = localStorage.getItem('token');
        const response = await fetch('/api/pdfs', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (!response.ok) throw new Error('Upload failed');

        const pdf = await response.json();
        showToast('PDF uploaded successfully', 'success');

        // Refresh the list
        await loadArticles();

        // Reset file input
        e.target.value = '';
    } catch (error) {
        showToast('Failed to upload PDF', 'error');
        console.error(error);
    }
});

// PDF Reader Controls
document.getElementById('close-pdf-reader').addEventListener('click', closePDFReader);
document.getElementById('pdf-prev-page').addEventListener('click', () => changePDFPage(-1));
document.getElementById('pdf-next-page').addEventListener('click', () => changePDFPage(1));
document.getElementById('pdf-zoom-in').addEventListener('click', () => changePDFZoom(0.1));
document.getElementById('pdf-zoom-out').addEventListener('click', () => changePDFZoom(-0.1));
document.getElementById('pdf-favorite-btn').addEventListener('click', togglePDFFavorite);
document.getElementById('pdf-archive-btn').addEventListener('click', togglePDFArchive);
document.getElementById('delete-pdf-btn').addEventListener('click', deletePDF);

async function openPDF(pdfId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/pdfs/${pdfId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to load PDF');

        currentPDF = await response.json();
        currentHighlights = currentPDF.highlights || [];

        // Update UI
        document.getElementById('pdf-title').textContent = currentPDF.title;
        document.getElementById('pdf-favorite-btn').textContent = currentPDF.is_favorite ? '⭐' : '☆';
        document.getElementById('pdf-archive-btn').textContent = currentPDF.is_archived ? '📦' : '📋';

        // Hide article sections, show PDF reader
        document.getElementById('article-list-container').classList.add('hidden');
        document.getElementById('article-reader').classList.add('hidden');
        document.getElementById('pdf-reader').classList.remove('hidden');

        // Initialize highlight system for PDF (if not already initialized)
        initializeHighlightSystem();

        // Initialize auto-hide controls
        initPDFControlsAutoHide();

        // Load the PDF file
        await loadPDFFile(pdfId);
    } catch (error) {
        showToast('Failed to open PDF', 'error');
        console.error(error);
    }
}

async function loadPDFFile(pdfId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/pdfs/${pdfId}/file`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to load PDF file');

        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();

        // Load PDF with PDF.js
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        pdfDocument = await loadingTask.promise;
        totalPages = pdfDocument.numPages;

        currentPage = 1;
        await renderPDFPage(currentPage);

        updatePDFControls();
    } catch (error) {
        showToast('Failed to load PDF file', 'error');
        console.error(error);
    }
}

async function renderPDFPage(pageNum) {
    if (!pdfDocument) return;

    try {
        const page = await pdfDocument.getPage(pageNum);
        const canvas = document.getElementById('pdf-canvas');
        const context = canvas.getContext('2d');

        const viewport = page.getViewport({ scale: pdfScale });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Render PDF page
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };

        await page.render(renderContext).promise;

        // Render text layer for selection
        await renderPDFTextLayer(page, viewport);

    } catch (error) {
        console.error('Failed to render PDF page:', error);
    }
}

async function renderPDFTextLayer(page, viewport) {
    const textLayerDiv = document.getElementById('pdf-text-layer');
    textLayerDiv.innerHTML = '';

    // Position text layer correctly
    textLayerDiv.style.width = viewport.width + 'px';
    textLayerDiv.style.height = viewport.height + 'px';

    try {
        const textContent = await page.getTextContent();

        // Render each text item
        textContent.items.forEach(item => {
            const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
            const fontSize = Math.sqrt((tx[2] * tx[2]) + (tx[3] * tx[3]));

            const span = document.createElement('span');
            span.textContent = item.str;
            span.style.left = tx[4] + 'px';
            span.style.top = (tx[5] - fontSize) + 'px';
            span.style.fontSize = fontSize + 'px';
            span.style.fontFamily = item.fontName;

            textLayerDiv.appendChild(span);
        });

        // Add text selection handler for PDF highlighting
        textLayerDiv.removeEventListener('mouseup', handlePDFTextSelection);
        textLayerDiv.addEventListener('mouseup', handlePDFTextSelection);

        // Apply existing highlights for this page
        applyPDFHighlights(pageNum);
    } catch (error) {
        console.error('Failed to render text layer:', error);
    }
}

function applyPDFHighlights(pageNum) {
    if (!currentHighlights || currentHighlights.length === 0) return;

    const textLayerDiv = document.getElementById('pdf-text-layer');
    const fullText = textLayerDiv.textContent;

    // Filter highlights for current page
    const pageHighlights = currentHighlights.filter(h => h.position.page === pageNum);

    pageHighlights.forEach(highlight => {
        const { start, end } = highlight.position;

        // Find the spans that contain the highlighted text
        const spans = Array.from(textLayerDiv.querySelectorAll('span'));
        let charCount = 0;

        spans.forEach(span => {
            const spanStart = charCount;
            const spanEnd = charCount + span.textContent.length;

            // Check if this span overlaps with the highlight range
            if (spanEnd > start && spanStart < end) {
                // Add highlight class based on type
                if (highlight.type === 'annotation') {
                    span.classList.add('annotated');
                } else {
                    span.classList.add('highlighted');
                }

                // Add click handler to show annotation
                if (highlight.note) {
                    span.style.cursor = 'pointer';
                    span.title = highlight.note;
                }
            }

            charCount += span.textContent.length;
        });
    });
}

function changePDFPage(delta) {
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderPDFPage(currentPage);
        updatePDFControls();
    }
}

function changePDFZoom(delta) {
    pdfScale = Math.max(0.5, Math.min(3.0, pdfScale + delta));
    renderPDFPage(currentPage);
    updatePDFControls();
}

function updatePDFControls() {
    document.getElementById('pdf-page-info').textContent = `Page ${currentPage} of ${totalPages}`;
    document.getElementById('pdf-zoom-level').textContent = `${Math.round(pdfScale * 100)}%`;

    document.getElementById('pdf-prev-page').disabled = currentPage === 1;
    document.getElementById('pdf-next-page').disabled = currentPage === totalPages;
}

function closePDFReader() {
    document.getElementById('pdf-reader').classList.add('hidden');
    document.getElementById('article-list-container').classList.remove('hidden');

    // Cleanup PDF controls auto-hide
    clearPDFControlsTimeout();
    document.removeEventListener('mousemove', handlePDFMouseMove);
    document.removeEventListener('mousedown', handlePDFMouseMove);

    // Cleanup PDF document
    if (pdfDocument) {
        pdfDocument.destroy();
        pdfDocument = null;
    }
    currentPDF = null;
    currentPage = 1;
    totalPages = 0;
    pdfScale = 1.5;
}

// Auto-hide PDF controls
let pdfControlsTimeout = null;
let pdfControlsVisible = true;

function showPDFControls() {
    document.getElementById('pdf-header').classList.remove('hidden-controls');
    document.getElementById('pdf-controls').classList.remove('hidden-controls');
    pdfControlsVisible = true;
}

function hidePDFControls() {
    document.getElementById('pdf-header').classList.add('hidden-controls');
    document.getElementById('pdf-controls').classList.add('hidden-controls');
    pdfControlsVisible = false;
}

function resetPDFControlsTimeout() {
    clearPDFControlsTimeout();
    showPDFControls();
    pdfControlsTimeout = setTimeout(() => {
        hidePDFControls();
    }, 3000); // Hide after 3 seconds of inactivity
}

function clearPDFControlsTimeout() {
    if (pdfControlsTimeout) {
        clearTimeout(pdfControlsTimeout);
        pdfControlsTimeout = null;
    }
}

function handlePDFMouseMove() {
    resetPDFControlsTimeout();
}

function initPDFControlsAutoHide() {
    // Show controls on mouse movement or interaction
    document.addEventListener('mousemove', handlePDFMouseMove);
    document.addEventListener('mousedown', handlePDFMouseMove);

    // Keep controls visible when hovering over them
    const pdfHeader = document.getElementById('pdf-header');
    const pdfControls = document.getElementById('pdf-controls');

    pdfHeader.addEventListener('mouseenter', () => {
        clearPDFControlsTimeout();
        showPDFControls();
    });

    pdfControls.addEventListener('mouseenter', () => {
        clearPDFControlsTimeout();
        showPDFControls();
    });

    pdfHeader.addEventListener('mouseleave', resetPDFControlsTimeout);
    pdfControls.addEventListener('mouseleave', resetPDFControlsTimeout);

    // Start the auto-hide timer
    resetPDFControlsTimeout();
}

async function togglePDFFavorite() {
    if (!currentPDF) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/pdfs/${currentPDF.id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                is_favorite: !currentPDF.is_favorite
            })
        });

        if (!response.ok) throw new Error('Failed to update PDF');

        currentPDF.is_favorite = !currentPDF.is_favorite;
        document.getElementById('pdf-favorite-btn').textContent = currentPDF.is_favorite ? '⭐' : '☆';
        showToast(currentPDF.is_favorite ? 'Added to favorites' : 'Removed from favorites', 'success');
    } catch (error) {
        showToast('Failed to update favorite status', 'error');
    }
}

async function togglePDFArchive() {
    if (!currentPDF) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/pdfs/${currentPDF.id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                is_archived: !currentPDF.is_archived
            })
        });

        if (!response.ok) throw new Error('Failed to update PDF');

        currentPDF.is_archived = !currentPDF.is_archived;
        document.getElementById('pdf-archive-btn').textContent = currentPDF.is_archived ? '📦' : '📋';
        showToast(currentPDF.is_archived ? 'Archived' : 'Unarchived', 'success');
    } catch (error) {
        showToast('Failed to update archive status', 'error');
    }
}

async function deletePDF() {
    if (!currentPDF) return;

    if (!confirm('Are you sure you want to delete this PDF? This action cannot be undone.')) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/pdfs/${currentPDF.id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to delete PDF');

        showToast('PDF deleted', 'success');
        closePDFReader();
        await loadArticles();
    } catch (error) {
        showToast('Failed to delete PDF', 'error');
    }
}
