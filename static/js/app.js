// API Base URL
const API_BASE = '/api';

// State
let currentUser = null;
let articles = [];
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

    // Check auth configuration first
    try {
        const authConfig = await fetch('/api/auth/config').then(r => r.json());

        if (!authConfig.auth_enabled) {
            // Auth is disabled, auto-login
            const response = await fetch('/api/auth/auto-login');
            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('token', data.access_token);
                await fetchCurrentUser();
                return; // Skip setting up login form listeners
            }
        }
    } catch (error) {
        console.log('Auth config check failed, proceeding with normal auth');
    }

    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (token) {
        fetchCurrentUser();
    }

    // Auth event listeners (only needed if showing login form)
    document.getElementById('show-register').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.remove('hidden');
    });

    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('register-form').classList.add('hidden');
        document.getElementById('login-form').classList.remove('hidden');
    });

    document.getElementById('login-form-element').addEventListener('submit', handleLogin);
    document.getElementById('register-form-element').addEventListener('submit', handleRegister);
});

// Authentication
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);

        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error('Login failed');
        }

        const data = await response.json();
        localStorage.setItem('token', data.access_token);
        await fetchCurrentUser();
        showToast('Login successful!', 'success');
    } catch (error) {
        showToast('Login failed. Please check your credentials.', 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById('register-email').value;
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;

    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, username, password })
        });

        if (!response.ok) {
            throw new Error('Registration failed');
        }

        showToast('Registration successful! Please login.', 'success');
        document.getElementById('show-login').click();
    } catch (error) {
        showToast('Registration failed. Username or email may already exist.', 'error');
    }
}

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
        let url = '/articles?limit=100';

        if (currentFilter === 'favorite') {
            url += '&favorite=true';
        } else if (currentFilter === 'archived') {
            url += '&archived=true';
        } else if (currentFilter === 'all') {
            url += '&archived=false';
        }

        if (currentTag) {
            url += `&tag=${encodeURIComponent(currentTag)}`;
        }

        if (searchQuery) {
            url += `&search=${encodeURIComponent(searchQuery)}`;
        }

        articles = await apiRequest(url);
        renderArticles();
    } catch (error) {
        showToast('Failed to load articles', 'error');
    }
}

function renderArticles() {
    const container = document.getElementById('article-list');
    container.innerHTML = '';

    if (articles.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">No articles found. Add one to get started!</div>';
        return;
    }

    articles.forEach(article => {
        const card = document.createElement('div');
        card.className = 'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 hover:shadow-lg dark:hover:shadow-gray-900/50 transition cursor-pointer';
        card.onclick = () => openArticle(article.id);

        const tagsHtml = article.tags.map(tag =>
            `<span class="inline-block px-2 py-1 text-xs font-medium rounded" style="background: ${tag.color}20; color: ${tag.color}">${tag.name}</span>`
        ).join('');

        const date = new Date(article.created_at).toLocaleDateString();
        const favoriteIcon = article.is_favorite ? '⭐' : '';
        const archiveIcon = article.is_archived ? '📦' : '';

        card.innerHTML = `
            <div class="flex justify-between items-start mb-3">
                <div class="flex-1">
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">${article.title || 'Untitled'}</h3>
                    <div class="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        ${article.site_name ? `<span>${article.site_name}</span>` : ''}
                        ${article.author ? `<span class="before:content-['•'] before:mx-2">by ${article.author}</span>` : ''}
                        <span class="before:content-['•'] before:mx-2">${date}</span>
                    </div>
                </div>
                <div class="flex gap-1 text-lg">
                    ${favoriteIcon} ${archiveIcon}
                </div>
            </div>
            ${article.excerpt ? `<p class="text-gray-600 dark:text-gray-300 text-sm line-clamp-3 mb-3">${article.excerpt}</p>` : ''}
            <div class="flex flex-wrap gap-2 mt-3">
                ${tagsHtml}
            </div>
        `;

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
    document.getElementById('highlight-btn').addEventListener('click', () => {
        createHighlight('highlight');
        hideHighlightPopup();
    });

    document.getElementById('annotate-btn').addEventListener('click', () => {
        showAnnotationModal();
    });

    // Hide popup when clicking elsewhere
    document.addEventListener('mousedown', (e) => {
        if (!popup.contains(e.target) && !e.target.closest('#annotation-modal')) {
            hideHighlightPopup();
        }
    });

    highlightSystemInitialized = true;
    console.log('Highlight system initialized');
}

function handleTextSelection(e) {
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
    document.getElementById('highlight-popup').classList.add('hidden');
}

async function createHighlight(type, note = null) {
    if (!currentSelection || !currentArticle) return;

    try {
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

        // Create highlight via API
        const highlightData = {
            article_id: currentArticle.id,
            type: type,
            text: currentSelection.text,
            context: context,
            position: { start, end },
            color: '#fbbf24',
            note: note,
            tags: []
        };

        const newHighlight = await apiRequest('/highlights', {
            method: 'POST',
            body: JSON.stringify(highlightData)
        });

        // Add to current highlights
        currentHighlights.push(newHighlight);

        // Apply highlight to DOM
        applyHighlightToDOM(newHighlight);

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
                <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                    ${existingHighlight ? 'Edit Annotation' : 'Add Annotation'}
                </h3>
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

    // Handle buttons
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
