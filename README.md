# 📚 Web Reader

A self-hosted, open-source read-it-later application - a privacy-focused alternative to Readwise Reader, Pocket, and Instapaper. Save articles, parse content, organize with tags, and enjoy a distraction-free reading experience.

## ✨ Features

- **📖 Save & Read**: Save articles from any URL with automatic content extraction
- **🔍 Smart Parsing**: Automatically extracts article title, author, content, and metadata
- **🏷️ Organization**: Tag and categorize your articles
- **⭐ Favorites**: Mark important articles for quick access
- **📦 Archive**: Archive articles you've finished reading
- **🔎 Search**: Full-text search across all your saved articles
- **🌙 Dark Mode**: Easy on the eyes with built-in dark mode
- **🔐 Privacy First**: Self-hosted, your data stays with you
- **🐳 Easy Deploy**: Single Docker container deployment
- **📱 Responsive**: Works on desktop, tablet, and mobile

## 🚀 Quick Start

### Using Docker Compose (Recommended)

1. Clone the repository:
```bash
git clone https://github.com/yourusername/web-reader.git
cd web-reader
```

2. Create environment file:
```bash
cp .env.example .env
# Edit .env and change SECRET_KEY to a secure random string
```

3. Start the application:
```bash
docker-compose up -d
```

4. Open your browser and navigate to:
```
http://localhost:8000
```

5. Register a new account and start saving articles!

### Using Docker

```bash
# Build the image
docker build -t web-reader .

# Run the container
docker run -d \
  -p 8000:8000 \
  -v web-reader-data:/app/data \
  -e SECRET_KEY=your-secret-key-here \
  --name web-reader \
  web-reader
```

## 📋 Requirements

- Docker & Docker Compose (recommended)
- Or Python 3.11+ (for manual installation)

## 🛠️ Manual Installation

If you prefer not to use Docker:

1. Clone the repository:
```bash
git clone https://github.com/yourusername/web-reader.git
cd web-reader
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create environment file:
```bash
cp .env.example .env
# Edit .env and configure your settings
```

5. Run the application:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

6. Open http://localhost:8000 in your browser

## ⚙️ Configuration

Edit your `.env` file or set environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `SECRET_KEY` | Secret key for JWT tokens (CHANGE IN PRODUCTION!) | `your-secret-key-change-this-in-production` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT token expiration time | `10080` (7 days) |
| `DATABASE_URL` | Database connection string | `sqlite:///./data/webreader.db` |
| `CORS_ORIGINS` | Allowed CORS origins | `["*"]` |
| `DEBUG` | Enable debug mode | `false` |

**⚠️ IMPORTANT**: Always change the `SECRET_KEY` in production!

## 🎯 Usage

### Saving Articles

1. **Via Web UI**: Paste any article URL in the top input field and click "Save"
2. **Browser Extension** (coming soon): One-click save from any webpage

### Organizing

- **Tags**: Create tags and organize your articles
- **Favorites**: Star important articles
- **Archive**: Move read articles to archive
- **Search**: Search by title, content, or author

### Reading

- Click any article to open the distraction-free reader
- Automatic content extraction removes ads and clutter
- Adjustable reading settings (coming soon)

## 📡 API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Key Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

#### Articles
- `POST /api/articles` - Save new article
- `GET /api/articles` - List articles (supports filtering)
- `GET /api/articles/{id}` - Get article details
- `PATCH /api/articles/{id}` - Update article
- `DELETE /api/articles/{id}` - Delete article

#### Tags
- `POST /api/tags` - Create tag
- `GET /api/tags` - List tags
- `DELETE /api/tags/{id}` - Delete tag

#### Highlights
- `POST /api/highlights` - Create highlight
- `GET /api/highlights/article/{id}` - Get article highlights
- `DELETE /api/highlights/{id}` - Delete highlight

## 🗂️ Project Structure

```
web-reader/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application
│   ├── config.py            # Configuration
│   ├── database.py          # Database setup
│   ├── models.py            # SQLAlchemy models
│   ├── schemas.py           # Pydantic schemas
│   ├── auth.py              # Authentication utilities
│   ├── parser.py            # Article parsing
│   └── routes/
│       ├── auth.py          # Auth endpoints
│       ├── articles.py      # Article endpoints
│       ├── tags.py          # Tag endpoints
│       └── highlights.py    # Highlight endpoints
├── static/
│   ├── index.html           # Frontend HTML
│   ├── css/
│   │   └── styles.css       # Styles
│   └── js/
│       └── app.js           # Frontend JavaScript
├── data/                    # SQLite database (created on first run)
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── README.md
```

## 🔒 Security

- Passwords are hashed using bcrypt
- JWT tokens for authentication
- CORS protection
- SQL injection prevention via SQLAlchemy ORM
- Input validation with Pydantic

**Production Recommendations:**
1. Change `SECRET_KEY` to a strong random string
2. Use HTTPS (reverse proxy with nginx/Traefik)
3. Restrict `CORS_ORIGINS` to your domain
4. Regular backups of the `data` directory
5. Keep dependencies updated

## 🎨 Screenshots

### Library View
All your saved articles in one place with search and filtering.

### Reading View
Distraction-free reading experience with clean typography.

### Dark Mode
Easy on the eyes for night-time reading.

## 🗄️ Database

By default, Web Reader uses SQLite for simplicity. The database file is stored in `data/webreader.db`.

### Backup

```bash
# Docker
docker cp web-reader:/app/data/webreader.db ./backup.db

# Manual
cp data/webreader.db backup.db
```

### Using PostgreSQL (Optional)

You can use PostgreSQL instead of SQLite:

1. Update `DATABASE_URL` in `.env`:
```
DATABASE_URL=postgresql://user:password@localhost/webreader
```

2. Install PostgreSQL driver:
```bash
pip install psycopg2-binary
```

## 🚧 Roadmap

- [ ] Browser extension (Chrome, Firefox)
- [ ] Mobile app (iOS, Android)
- [ ] RSS feed support
- [ ] Email newsletter integration
- [ ] PDF and ePub export
- [ ] Highlights and annotations
- [ ] Reading statistics
- [ ] Public sharing links
- [ ] Multi-user support improvements
- [ ] Automatic tagging with AI
- [ ] Text-to-speech
- [ ] Reading progress sync across devices

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

- Built with [FastAPI](https://fastapi.tiangolo.com/)
- Article parsing powered by [newspaper3k](https://newspaper.readthedocs.io/) and [readability-lxml](https://github.com/buriy/python-readability)
- Inspired by Readwise Reader, Pocket, and Instapaper

## 💬 Support

- 🐛 [Report a bug](https://github.com/yourusername/web-reader/issues)
- 💡 [Request a feature](https://github.com/yourusername/web-reader/issues)
- 📖 [Documentation](https://github.com/yourusername/web-reader/wiki)

## 🌟 Star History

If you find this project useful, please consider giving it a star! ⭐

---

Made with ❤️ by the community
