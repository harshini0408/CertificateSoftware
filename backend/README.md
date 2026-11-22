# PSG iTech Activity Points Management Software — Backend

Self-hosted college activity points management and certificate generation backend system for **PSG Institute of Technology and Applied Research**.

Built on **FastAPI**, **Beanie ODM / MongoDB**, **Pillow**, **Rembg**, and **APScheduler**.

---

## Quick Start

### Prerequisites
- Python 3.10+
- MongoDB 6.0+ (running locally on port 27017 or via Docker)

### Setup

```bash
# 1. Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux/Mac

# 2. Install dependencies
pip install -r requirements.txt

# 3. Copy environment config
copy .env.example .env       # Windows
# cp .env.example .env       # Linux/Mac
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
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

---

## Architecture

```
app/
├── main.py              # FastAPI app, lifespan, CORS, global routers
├── config.py            # pydantic-settings from .env
├── database.py          # Motor + Beanie ODM init
├── scheduler.py         # APScheduler daily email queue
├── models/              # Beanie Document models (User, Event, Certificate, StudentCredit, EventTeam, etc.)
├── schemas/             # Pydantic request/response schemas
├── domains/             # Domain modules (club, student, tutor, dept, hod, principal, student_affairs, superadmin)
├── routers/             # Core routers (auth, events, participants, certificates, verify, attendance)
├── services/            # Business logic (png_generator, credit_service, signature_service, email_service, etc.)
├── core/                # Security (JWT/bcrypt) + role dependencies
└── static/
    ├── certificate_templates/ # PNG certificate templates
    └── fonts/                 # Google Fonts TTF files
```

---

## User Roles

| Role | Access |
|------|--------|
| `super_admin` | Full platform control, semester resets, user management, credit rules & semester caps |
| `principal` | College-wide KPI and analytics oversight |
| `hod` | Department-level activity points, events, and student analytics |
| `student_affairs` | Club event oversight and **mandatory event completion report review/approval** |
| `club_coordinator` | Club events (solo/team), attendance QR codes, participant upload, certificate generation & dispatch |
| `dept_coordinator` | Department event certificates and student credit management |
| `tutor` | Class credit monitoring, external certificate verification, student reg number editing (max 2 times) |
| `student` | Activity credit summary, certificate wallet, QR attendance, team invites/management, 1-time reg number update |
| `guest` | Single-event self-service certificate generation wizard |

---

## Detailed Club Lifecycle to Certificate Generation

```
[Club Setup] ──► [Upload Logo & Signature (rembg AI)]
      │
      ▼
[Create Event] ──► [Solo / Team Event (Invite Codes/Links)]
      │
      ▼
[Participant Attendance] ──► [Live QR Scan / Coordinator Verification]
      │
      ▼
[Event Completion Report] ──► [Submit PDF Report]
      │
      ▼
[Student Affairs Gate] ──► [Review: Must be ACCEPTED before generation]
      │
      ▼
[Certificate Generation] ──► [Pillow Render: TTF Fonts + Transparent Sig + QR Code]
      │
      ▼
[Review Preview] ──► [Coordinator Checks High-Res Preview in UI]
      │
      ▼
[Email Dispatch] ──► [SMTP Queue: Attachment & Links Sent]
      │
      ▼
[Auto Credit Awarding] ──► [Enforces Semester Caps; Excess = 0 Points; Adds to Wallet]
```

1. **Asset Preparation**: Coordinator uploads Club Logo and Faculty Signature. The backend removes background using `rembg` (U2-Net AI) and caches the transparent PNG by MD5 hash (`signature_service.py`).
2. **Event Configuration**: Supports solo and team events with min/max team size, max teams, target academic years, and volunteer quotas.
3. **Registration & Teams**: Team leaders invite members via unique shareable links/codes.
4. **Attendance Verification**: Enforced via live dynamic session QR codes or manual coordinator verification. Only verified attendees (`verified == True`) can receive certificates.
5. **Mandatory Event Report Approval Gate**: Coordinator uploads a comprehensive completion report (PDF). **Student Affairs** must review and mark `report_status = "accepted"`. Any attempt to generate certificates prior to approval is blocked by the backend (`HTTP 400`).
6. **Dynamic Rendering**: Bounded asynchronous workers generate certificates using Pillow (`PIL`), embedding dynamic text, transparent signatures, club logos, and verifiable QR codes.
7. **Review-First Dispatch**: Generated certificates are held in `GENERATED` status for visual inspection before batch emailing (`send-remaining`).
8. **Automated Credit Engine**: Upon email dispatch, `award_credits()` checks student's semester certificate cap and awards points or marks as semester-capped.
9. **Public Verification**: Certificates can be instantly verified by anyone at `/verify/{cert_number}`.

---

## Production Deployment
See root [README.md](../README.md) and `docker-compose.yml` for complete container and reverse proxy orchestration instructions.
