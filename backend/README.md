# PSG iTech Certificate Platform — Backend

Self-hosted college certificate generation and management system.

## Quick Start

### Prerequisites
- Python 3.10+
- MongoDB (running locally on port 27017)
- wkhtmltoimage (required by imgkit for HTML → PNG)

### Setup

```bash
# 1. Create virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Linux/Mac

# 2. Install dependencies
pip install -r requirements.txt

# 3. Copy environment config
copy .env.example .env        # Windows
# cp .env.example .env        # Linux/Mac
# Then edit .env with your values

# 4. Download fonts for certificate rendering
python download_fonts.py

# 5. Start the server
uvicorn app.main:app --reload --port 8000
```

### First Run
On first startup the server will:
1. Connect to MongoDB and create all collections
2. Seed the **super-admin** account (credentials from `.env`)
3. Start the APScheduler email queue processor

Login at `POST /auth/login` with:
```json
{ "username": "superadmin", "password": "Admin@123456" }
```

### API Documentation
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Architecture

```
app/
├── main.py              # FastAPI app, lifespan, router registration
├── config.py            # pydantic-settings from .env
├── database.py          # Motor + Beanie ODM init
├── scheduler.py         # APScheduler daily email queue
├── models/              # 12 Beanie Document models
├── schemas/             # Pydantic request/response schemas
├── routers/             # 11 FastAPI routers (auth, admin, clubs, etc.)
├── services/            # Business logic (cert gen, email, QR, etc.)
├── core/                # Security (JWT/bcrypt) + dependencies
└── static/
    ├── templates/       # 6 Jinja2 HTML certificate templates
    └── fonts/           # Google Fonts TTF files
```

## User Roles
| Role | Access |
|------|--------|
| `super_admin` | Full platform access |
| `club_coordinator` | Full access within own club |
| `dept_coordinator` | Read-only credit dashboard for department |
| `student` | View own credits and event history |
| `guest` | Single-event access only |

## Certificate Flow
1. Club coordinator creates event + maps templates
2. Upload participants via Excel or QR registration
3. Trigger bulk generation → BackgroundTasks render HTML → PNG
4. Certificates emailed with Gmail API (500/day cap)
5. Overflow queued → scheduler resumes at 00:05 daily
6. Credits auto-awarded on successful email delivery

## Production Deployment
See `nginx.conf` for reverse proxy configuration.
