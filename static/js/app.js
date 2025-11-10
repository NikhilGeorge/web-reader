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
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (token) {
        fetchCurrentUser();
    }

    // Auth event listeners
    document.getElementById('show-register').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('register-form').style.display = 'block';
    });

    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('register-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'block';
    });

    document.getElementById('login-form-element').addEventListener('submit', handleLogin);
    document.getElementById('register-form-element').addEventListener('submit', handleRegister);

    // App event listeners
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('add-article-btn').addEventListener('click', handleAddArticle);
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    document.getElementById('close-reader').addEventListener('click', closeReader);
    document.getElementById('search-input').addEventListener('input', handleSearch);

    // Filter navigation
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
        document.documentElement.setAttribute('data-theme', 'dark');
        document.getElementById('theme-toggle').textContent = '☀️';
    }
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
    document.getElementById('auth-section').style.display = 'flex';
    document.getElementById('app-section').style.display = 'none';
}

function showApp() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('app-section').style.display = 'block';
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
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No articles found. Add one to get started!</p>';
        return;
    }

    articles.forEach(article => {
        const card = document.createElement('div');
        card.className = 'article-card';
        card.onclick = () => openArticle(article.id);

        const tagsHtml = article.tags.map(tag =>
            `<span class="tag-badge" style="background: ${tag.color}20; color: ${tag.color}">${tag.name}</span>`
        ).join('');

        const date = new Date(article.created_at).toLocaleDateString();
        const favoriteIcon = article.is_favorite ? '⭐' : '';
        const archiveIcon = article.is_archived ? '📦' : '';

        card.innerHTML = `
            <div class="article-header">
                <div>
                    <h3 class="article-title">${article.title || 'Untitled'}</h3>
                    <div class="article-meta">
                        ${article.site_name ? `<span>${article.site_name}</span>` : ''}
                        ${article.author ? `<span>by ${article.author}</span>` : ''}
                        <span>${date}</span>
                    </div>
                </div>
                <div class="article-icons">
                    ${favoriteIcon} ${archiveIcon}
                </div>
            </div>
            ${article.excerpt ? `<p class="article-excerpt">${article.excerpt}</p>` : ''}
            <div class="article-footer">
                <div class="article-tags">${tagsHtml}</div>
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
        showToast('Failed to save article', 'error');
    }
}

async function openArticle(articleId) {
    try {
        currentArticle = await apiRequest(`/articles/${articleId}`);
        renderArticleReader();
        document.getElementById('article-list').style.display = 'none';
        document.getElementById('article-reader').style.display = 'block';
    } catch (error) {
        showToast('Failed to load article', 'error');
    }
}

function closeReader() {
    document.getElementById('article-reader').style.display = 'none';
    document.getElementById('article-list').style.display = 'block';
    currentArticle = null;
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
        `<span class="tag-badge" style="background: ${tag.color}20; color: ${tag.color}">${tag.name}</span>`
    ).join('');
    document.getElementById('reader-tags').innerHTML = tagsHtml;

    const content = currentArticle.content || 'No content available';
    document.getElementById('reader-body').innerHTML = content.split('\n').map(p => `<p>${p}</p>`).join('');

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
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    document.getElementById('theme-toggle').textContent = newTheme === 'dark' ? '☀️' : '🌙';
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
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}
