# PSG iTech Activity Points Management Software — Backend

Self-hosted college activity points management and certificate generation system for PSG Institute of Technology and Applied Research.

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
1. Connect to MongoDB and initialize Beanie ODM collections
2. Seed the **super-admin** account (credentials from `.env`)
3. Seed default **credit rules** and **certificate image templates**
4. Start the APScheduler email queue processor

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
├── main.py              # FastAPI app, lifespan, global routers
├── config.py            # pydantic-settings from .env
├── database.py          # Motor + Beanie ODM init
├── scheduler.py         # APScheduler daily email queue
├── models/              # Beanie Document models (User, Event, Certificate, StudentCredit, etc.)
├── schemas/             # Pydantic request/response schemas
├── domains/             # Domain modules (club, student, tutor, dept, hod, principal, student_affairs, superadmin)
├── routers/             # Core routers (auth, events, participants, certificates, verify, attendance)
├── services/            # Business logic (cert gen, credit awarding, email, storage, etc.)
├── core/                # Security (JWT/bcrypt) + role dependencies
└── static/
    ├── certificate_templates/ # PNG certificate templates
    └── fonts/                 # Google Fonts TTF files
```

## User Roles
| Role | Access |
|------|--------|
| `super_admin` | Full platform control, semester resets, user management, global templates |
| `principal` | College-wide KPI and analytics oversight |
| `hod` | Department-level activity points, events, and student analytics |
| `student_affairs` | Club event oversight and event report review/approval |
| `club_coordinator` | Club events, attendance QR codes, participant upload, certificate generation |
| `dept_coordinator` | Department event certificates and student credit management |
| `tutor` | Class credit monitoring, external certificate verification, student reg number editing (max 2 times) |
| `student` | Activity credit summary, certificate wallet, QR attendance, verification requests, 1-time reg number update |
| `guest` | Single-event self-service certificate generation wizard |

## Key Features & Workflows
1. **Club Event Reports**: Mandatory event report submission before certificates can be generated or issued.
2. **Activity Points & Credit Rules**: Configurable credit points auto-awarded upon certificate generation/emailing, plus manual verification workflow via tutors.
3. **Student Registration Number Policy**:
   - Students starting with temporary IDs (e.g. `T24Z108`) can update to their official 12-digit university registration number **once** in Settings.
   - Assigned tutors can edit a mapped student's registration number up to **2 times**.
4. **Semester Rollover / Reset**: Superadmin can trigger a semester reset with admin password confirmation, archiving previous semester credits into history and resetting active semester totals to zero.
5. **QR Code Attendance**: Dynamic QR codes generated per event session for seamless participant attendance marking.

## Production Deployment
See `nginx.conf` and root `docker-compose.yml` for production reverse proxy and container configuration.
