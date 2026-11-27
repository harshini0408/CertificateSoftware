# PSG iTech Activity Points Management & Certificate Generation Platform

Official self-hosted Activity Points Management and Certificate Generation Platform for PSG Institute of Technology and Applied Research.

This repository is Dockerized for production with:
- React + Vite frontend container
- FastAPI backend container
- MongoDB container with persistent volume
- Docker Compose orchestration
- Host-level Nginx reverse proxy compatibility

The app is prepared for deployment under a subpath:
`/project-name`

## Key Capabilities & Recent Features
- **Activity Points Management**: Track, calculate, and roll over student activity credits semester by semester.
- **Club Dashboard**: Mandatory event completion report submission before certificates can be issued; live semester and cumulative completed event counts.
- **Student Dashboard**: 1-time registration number update for students admitted with temporary IDs (e.g., `T24Z108` → 12-digit permanent ID); credit breakdown, event registration, and certificate verification submissions.
- **Tutor Dashboard**: Class credit monitoring, external certificate verification, and mapped student registration number editing (strictly up to 2 times).
- **Semester Reset / Roll-over**: Superadmin credit reset that sets the new academic semester, resets current semester totals to zero, and archives all past semester credits and certificates.
- **Multi-Role RBAC**: Super Admin, Principal, HOD, Student Affairs, Club Coordinator, Dept Coordinator, Tutor, Student, and Guest.

## 1. Local Development (Without Docker)

### Backend
1. Create and activate a Python virtual environment.
2. Install dependencies from `backend/requirements.txt`.
3. Copy `backend/.env.example` to `backend/.env` and update values.
4. Run:

```bash
cd backend
uvicorn app.main:app --reload --port 2849
```

### Frontend
1. Install dependencies.
2. Copy `frontend/.env.example` to `frontend/.env` and adjust for local dev.
3. Run:

```bash
cd frontend
npm install
npm run dev
```

## 2. Docker Development

### First-time setup
1. Copy the root env template and update values:

```
┌────────────────────────┐
│  Raw Signature Upload  │ (JPG/PNG from paper scan or camera)
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ Compute MD5 Checksum   │ ──► Cache Hit? ──► Return cached transparent PNG
└───────────┬────────────┘
            │ (New Upload)
            ▼
┌────────────────────────┐
│  Alpha Channel Check   │ ──► Already Transparent? ──► Use Original Bytes
└───────────┬────────────┘
            │ (Opaque Background)
            ▼
┌────────────────────────┐
│   rembg (U2-Net AI)    │ ──► Segments ink strokes from background paper
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│  Blank Image Fallback  │ ──► If fully transparent, fall back to safe upload
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│  Save to Assets Cache  │ ──► storage/assets/<club_slug>/sig_<md5>.png
└────────────────────────┘
```

- **Algorithm**: `rembg.remove()` uses deep learning saliency detection to isolate black/blue ink strokes from textured or off-white paper.
- **Fail-Safe Protection**: If background removal removes too much content resulting in a blank alpha bounding box, the service automatically falls back to original bytes.
- **Deduplication**: Identical uploads share cached assets, eliminating redundant CPU overhead.

---

## Activity Points & Semester Cap Enforcement

To encourage well-rounded student participation and prevent credit hoarding, the system supports configurable **Semester Caps**:
- **Super Admin Configuration**:
  - Superadmin defines points awarded per certificate type (Participation, Winner, Organizer, Volunteer, External Presentation, etc.).
  - Superadmin sets **Max Certificates / Semester** (e.g., maximum 2 technical participation certificates count towards credit per semester).
- **Graceful Rollover**:
  - Certificates earned beyond the semester cap are still issued, valid, and stored in the student's wallet, but grant **0 activity credit points**.
  - When the Superadmin initiates a **Semester Reset / Rollover**, current semester totals reset to zero, and past semester history is permanently archived into historical semester records.

---

## Student Registration Number Update Policy

To accommodate first-year students admitted with temporary IDs:
1. **Temporary ID Support**: Students entering with temporary roll numbers (e.g. `T24Z108`) can use the system normally.
2. **Student Self-Service Update**:
   - Once official 12-digit university registration numbers are issued, students can update their registration number **once** in Profile Settings.
   - After one successful update, the field is permanently locked to the student.
3. **Tutor Override Security**:
   - If a student makes an error or requires correction, only their assigned class **Tutor** can edit the mapped registration number.
   - Tutors are strictly limited to **2 updates per student** to guarantee administrative auditability.

---

## Local Development Setup

### Prerequisites
- Python 3.10 or higher
- Node.js 18+ and npm
- MongoDB 6.0+ (running locally on port 27017)

### 1. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # On Windows
# source venv/bin/activate   # On Linux/macOS

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy .env.example .env       # On Windows
# cp .env.example .env       # On Linux/macOS

# Download required TTF fonts for certificate rendering
python download_fonts.py

# Start the FastAPI server
uvicorn app.main:app --reload --port 8000
```
- API Documentation: `http://localhost:8000/docs`
- Alternative ReDoc: `http://localhost:8000/redoc`

### 2. Frontend Setup
```bash
# Navigate to frontend directory
cd frontend

# Install npm dependencies
npm install

# Start Vite development server
npm run dev
```
- Frontend Web App: `http://localhost:2848` (or port configured in `vite.config.js`)

---

## Docker Production Deployment

The entire stack is production-ready via Docker Compose with volume persistence and health checks.

### 1. Configuration
```bash
# Copy root environment template
copy .env.example .env       # Windows PowerShell
# cp .env.example .env       # Linux

# Edit .env with secure production values:
# - SECRET_KEY
# - SUPERADMIN_PASSWORD
# - SMTP configuration
# - ALLOWED_ORIGINS & FRONTEND_URL
```

### 2. Build and Launch
```bash
# Build and start all containers in detached mode
docker compose up -d --build

# View container status
docker compose ps

# View live application logs
docker compose logs -f backend
```

### 3. Production Nginx Reverse Proxy
Deploy under subpath (e.g. `/project-name`) using host Nginx configuration from `deploy/nginx.project-name.conf`:
```bash
sudo cp deploy/nginx.project-name.conf /etc/nginx/sites-available/certificate-software
sudo ln -s /etc/nginx/sites-available/certificate-software /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Environment Configuration

Key environment variables in `.env`:

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `MONGODB_URL` | MongoDB connection connection string | `mongodb://mongodb:27017` or `mongodb://localhost:27017` |
| `DATABASE_NAME` | Database name | `certificate_software` |
| `SECRET_KEY` | Cryptographic secret for JWT access tokens | *High-entropy random 64-char string* |
| `ALGORITHM` | JWT signing algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Session token lifetime | `1440` (24 hours) |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowed origins | `http://localhost:2848,http://localhost:8000` |
| `STORAGE_ROOT` | File storage path for templates, certs, and assets | `./storage` |
| `SMTP_HOST` | Outgoing email SMTP server | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USERNAME` | SMTP account email | `notifications@psgitech.ac.in` |
| `SMTP_PASSWORD` | SMTP app password | *App-specific password* |
| `EMAIL_DAILY_LIMIT` | Max emails sent per 24-hour cycle | `500` |
| `SUPERADMIN_EMAIL` | Initial seed superadmin email | `admin@psgitech.ac.in` |
| `SUPERADMIN_PASSWORD` | Initial seed superadmin password | `Admin@123456` |

---

## Troubleshooting & FAQs

### 1. "Event report must be submitted to Student Affairs and approved before certificates can be generated"
- **Cause**: The event completion report has not been uploaded, is still `pending_review`, or was `rejected` by Student Affairs.
- **Resolution**: Have the Club Coordinator upload the event completion report under the event's Report tab. Then, log in with a `student_affairs` account to review and click **Accept Report**.

### 2. "Signature background still appears white or discolored"
- **Cause**: Scanned image has high noise or compressed artifacts.
- **Resolution**: Ensure `rembg` and its underlying dependencies are installed in your Python environment (`pip install rembg`). Alternatively, coordinators can upload a transparent PNG signature directly, which the system preserves as-is.

### 3. "CORS Error: Disallowed CORS origin"
- **Cause**: Frontend origin does not match `ALLOWED_ORIGINS` in `.env` or another background service occupies port 8000.
- **Resolution**: Check `netstat -ano | findstr :8000` to verify only the certificate backend uvicorn process is listening. Update `ALLOWED_ORIGINS` in `backend/.env` with your frontend's exact origin (e.g. `http://localhost:2848`).

### 4. "Email sending limit reached"
- **Cause**: Outgoing email quota exceeded `EMAIL_DAILY_LIMIT`.
- **Resolution**: Certificates remain securely generated in status `GENERATED`. Once the next day's limit resets, click **Send Remaining** in the event certificates tab to dispatch the queued certificates.

---

## License & Credits

Developed for **PSG Institute of Technology and Applied Research (PSG iTech)**.  
All rights reserved © 2026.
