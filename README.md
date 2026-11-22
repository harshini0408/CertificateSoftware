# PSG iTech Activity Points Management & Certificate Generation Platform

Official self-hosted Activity Points Management and Certificate Generation Platform for **PSG Institute of Technology and Applied Research**.

A full-stack, enterprise-grade system that manages student co-curricular and extra-curricular activity points, automates event registration (solo and team), verifies attendance via dynamic QR codes, gates certificate issuance behind institutional report approvals, renders dynamic certificates with AI-extracted transparent signatures, and securely dispenses verifiable credentials to student wallets and emails.

---

## Table of Contents
- [System Architecture](#system-architecture)
- [User Roles & Access Levels](#user-roles--access-levels)
- [Complete Club Lifecycle to Certificate Generation](#complete-club-lifecycle-to-certificate-generation)
  - [Workflow Diagram](#workflow-diagram)
  - [Step 1: Club Setup & Signature/Logo Processing](#step-1-club-setup--signaturelogo-processing)
  - [Step 2: Event Creation & Configuration](#step-2-event-creation--configuration)
  - [Step 3: Registration & Team Formation Flow](#step-3-registration--team-formation-flow)
  - [Step 4: Live Attendance Verification (QR & Manual)](#step-4-live-attendance-verification-qr--manual)
  - [Step 5: Mandatory Event Report & Student Affairs Approval Gate](#step-5-mandatory-event-report--student-affairs-approval-gate)
  - [Step 6: Role Template Selection & Dynamic Layout Positioning](#step-6-role-template-selection--dynamic-layout-positioning)
  - [Step 7: High-Resolution Batch Certificate Generation](#step-7-high-resolution-batch-certificate-generation)
  - [Step 8: Review-First Preview & Email Dispatch](#step-8-review-first-preview--email-dispatch)
  - [Step 9: Credit Rules & Semester Cap Awarding](#step-9-credit-rules--semester-cap-awarding)
  - [Step 10: Public Verification & Digital Wallet](#step-10-public-verification--digital-wallet)
- [Signature Processing & Background Removal Pipeline](#signature-processing--background-removal-pipeline)
- [Activity Points & Semester Cap Enforcement](#activity-points--semester-cap-enforcement)
- [Student Registration Number Update Policy](#student-registration-number-update-policy)
- [Local Development Setup](#local-development-setup)
- [Docker Production Deployment](#docker-production-deployment)
- [Environment Configuration](#environment-configuration)
- [Troubleshooting & FAQs](#troubleshooting--faqs)

---

## System Architecture

The platform is designed with a modern, micro-service-ready architecture containerized via Docker Compose:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Nginx Reverse Proxy                             │
│                  (SSL Termination, Subpath Proxying)                   │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
       ┌────────────────────────┐       ┌────────────────────────┐
       │     Frontend (Vite)    │       │     Backend (FastAPI)  │
       │   React 18 + Tailwind  │       │ Python 3.10+, Beanie   │
       │   Lucide Icons, Axios  │       │ Pillow, Rembg, Motor   │
       └────────────────────────┘       └───────────┬────────────┘
                                                    │
                                                    ▼
                                        ┌────────────────────────┐
                                        │    MongoDB (Persistent)│
                                        │ Collections: Users,    │
                                        │ Events, Certificates,  │
                                        │ Credits, Logs, Teams   │
                                        └────────────────────────┘
```

- **Frontend**: React 18 SPA built with Vite, Tailwind CSS, Lucide Icons, and hash/subpath routing compatibility.
- **Backend**: FastAPI asynchronous REST API, Beanie ODM (MongoDB Motor async driver), Pydantic v2 schemas.
- **Rendering & Imaging**: Pillow (`PIL`) image composition engine, Google TTF fonts, QR code generation (`qrcode`), and `rembg` (U2-Net AI) background remover.
- **Scheduler**: APScheduler background queue processor for scheduled email rate-limiting and rollover maintenance.
- **Database**: MongoDB 6.0+ with indexed collections for certificates, events, credits, and verification logs.

---

## User Roles & Access Levels

| Role | Role Identifier | Core Responsibilities |
| :--- | :--- | :--- |
| **Super Admin** | `super_admin` | Global platform configuration, credit rule caps per semester, semester resets/rollovers, user management, global templates. |
| **Principal** | `principal` | College-wide KPI tracking, inter-departmental analytics, institutional participation metrics. |
| **HOD** | `hod` | Department-level student activity points oversight, event approval reviews, and class performance tracking. |
| **Student Affairs** | `student_affairs` | Club event governance, **mandatory event completion report review & approval/rejection gate**. |
| **Club Coordinator** | `club_coordinator` | Club asset configuration, event creation, team invite links, QR attendance, event report submission, certificate generation and email dispatch. |
| **Dept Coordinator**| `dept_coordinator` | Department-specific technical symposia, workshops, and credit awarding for departmental events. |
| **Tutor** | `tutor` | Class credit monitoring, external certificate verification, and student registration number edits (strictly up to 2 times). |
| **Student** | `student` | Activity credit summary, digital certificate wallet, QR attendance scanner, team invites/management, 1-time registration number update. |
| **Guest** | `guest` | Single-event self-service certificate generation wizard with verification links. |

---

## Complete Club Lifecycle to Certificate Generation

The core workflow of the platform ensures institutional compliance, attendance integrity, and verification rigor before any certificate or credit is released.

### Workflow Diagram

```mermaid
flowchart TD
    A([1. Club Coordinator Setup]) --> B[Upload Club Logo & Signature]
    B --> C[rembg AI Strips Signature Background]
    C --> D[2. Create Event: Solo or Team]
    D --> E{Event Mode?}
    E -- Team Event --> F[Team Leader Creates Team & Shares Invite Code/Link]
    E -- Solo Event --> G[Students Register Individually or Bulk CSV Upload]
    F --> H[3. Event Execution & Attendance]
    G --> H
    H --> I[Dynamic QR Attendance or Manual Verification]
    I --> J[Only Verified Participants Eligible]
    J --> K[4. Event Concludes: Submit Event Report]
    K --> L[Upload PDF Report with Photos, Budget & Summary]
    L --> M{Student Affairs Review Gate}
    M -- Rejected --> N[Report Rejected with Reason: Club Re-uploads]
    N --> L
    M -- Approved --> O[Report Accepted: Certificate Generation Unlocked]
    O --> P[5. Role Template Resolution]
    P --> Q[Match Preset: Winner, Volunteer, Participant, etc.]
    Q --> R[6. Batch Certificate Generation]
    R --> S[Pillow Renders High-Res PNG with Logo, Sig, QR & ID]
    S --> T[Status: GENERATED (Review-First Preview)]
    T --> U[7. Coordinator Reviews & Clicks 'Send Remaining']
    U --> V[Background Task Sends Email with Certificate Attachment]
    V --> W[Status: EMAILED]
    W --> X[8. Automatic Credit Awarding]
    X --> Y{Within Semester Cap?}
    Y -- Yes --> Z[Full Activity Points Awarded to Student Wallet]
    Y -- Exceeded Cap --> AA[0 Eligible Points Recorded: Capped for Semester]
    Z --> AB([Certificate Live on Public /verify URL])
    AA --> AB
```

---

### Step 1: Club Setup & Signature/Logo Processing
1. The Club Coordinator logs into the platform with their assigned credentials.
2. Under **Club Settings / Assets**, the coordinator uploads:
   - **Official Club Logo** (`.png`, `.jpg`).
   - **Coordinator / Faculty Advisor Signature** image.
3. **Automated Signature Background Removal**:
   - The backend runs `process_signature` via `backend/app/services/signature_service.py`.
   - Uses `rembg` (U2-Net AI) to isolate the signature ink strokes and remove white or uneven paper backgrounds into a transparent alpha channel.
   - Computes an MD5 checksum of the image bytes and caches the transparent PNG at `backend/storage/assets/<club_slug>/sig_<md5>.png`.
   - If an uploaded image is already a transparent PNG, it safely preserves the original alpha channel without re-compression.

---

### Step 2: Event Creation & Configuration
The coordinator navigates to the Events tab and clicks **Create Event**:
- **Event Metadata**: Title, description, date(s), venue, academic year, and category:
  - *Technical Event*
  - *Non-Technical Event*
  - *Technical Talk*
  - *Workshop / Hackathon*
- **Activity Mode**:
  - **Solo Event**: Registrations are handled per individual. An optional `max_participants` cap can be set.
  - **Team Event** (`is_team_event = True`): Allows students to form teams. The coordinator configures:
    - `max_teams`: Maximum number of competing teams.
    - `min_team_size`: Minimum required members (e.g., 2).
    - `max_team_size`: Maximum allowed members (e.g., 4).
- **Target Audience**: Specific eligible academic years (e.g. 1st, 2nd, 3rd, 4th Year).
- **Volunteers Needed**: Specify `volunteers_required` for event logistics.

---

### Step 3: Registration & Team Formation Flow
1. **Solo Registration**:
   - Eligible students browse the event under their **Student Dashboard** and click **Register**.
   - Alternatively, coordinators can upload a bulk Excel/CSV file (`Name`, `Registration Number`, `Email`, `Role`).
2. **Team Registration & Invite Flow**:
   - The team leader creates a new team with a unique Team Name.
   - The platform generates a unique shareable **Team Invite Code / Link**.
   - Teammates click the invite link or enter the invite code to join.
   - The team leader can finalize and lock the team once the size satisfies `min_team_size <= members <= max_team_size`.
3. **Participant Roles**:
   - Each participant record in the database (`Participant`) has a designated role or certificate type:
     - `participant` (auto-categorized as `technical_participant` or `non_technical_participant` based on event category)
     - `winner` / `first_place` / `second_place` / `third_place`
     - `student_volunteer` / `volunteer`
     - `organizer`

---

### Step 4: Live Attendance Verification (QR & Manual)
Certificates can **only** be issued to verified attendees.
1. **Dynamic QR Attendance**:
   - The coordinator displays the live event session QR code on a projector screen.
   - The QR code contains a cryptographically signed token with an expiry window.
   - Students open the attendance scanner on their mobile devices (via student portal) to mark attendance.
2. **Manual Attendance Verification**:
   - Coordinators can toggle individual attendance checkboxes or mark entire teams/volunteers as present.
   - Marking attendance sets `verified = True` on the participant document.

---

### Step 5: Mandatory Event Report & Student Affairs Approval Gate

> [!IMPORTANT]
> To maintain institutional quality and accreditation records, **no certificates can be generated until the event completion report has been submitted and formally approved by Student Affairs**.

1. **Coordinator Submits Event Report**:
   - After the event ends, the coordinator compiles an official **Event Completion Report** (PDF format containing event outcomes, speaker details, photographs, attendance summary, and expenditures).
   - The coordinator uploads the PDF via `POST /clubs/{club_id}/events/{event_id}/report`.
   - The event status transitions to `report_status = "pending_review"`.
2. **Student Affairs Review**:
   - The Office of Student Affairs accesses their oversight dashboard (`/student-affairs`) and reviews pending reports.
   - **If Approved**: Student Affairs clicks **Accept Report**. The backend sets `report_status = "accepted"`.
   - **If Rejected**: Student Affairs provides a specific feedback reason (`report_rejection_reason`). The event status changes to `report_status = "rejected"`. The club coordinator is notified to address the deficiencies and re-upload.
3. **Strict Backend Enforcement**:
   - If a coordinator attempts to click *Generate Certificates* while the report is missing, under review, or rejected, the backend halts execution with `HTTP 400 Bad Request`:
     ```json
     {
       "detail": "Event report must be submitted to Student Affairs and approved before certificates can be generated."
     }
     ```

---

### Step 6: Role Template Selection & Dynamic Layout Positioning
When certificate generation initiates, the template engine dynamically maps each attendee:
1. **Role Template Presets**:
   - The system checks `RoleTemplatePreset` documents in the database matching the participant's normalized role (`technical_participant`, `non_technical_participant`, `winner`, `volunteer`, etc.).
2. **Field Coordinate Mapping**:
   - The template defines $(X, Y)$ coordinate boxes, text alignment (center/left), font family, font size, and color for each dynamic token:
     - `{{Name}}`: Student's full registered name.
     - `{{Registration Number}}`: 12-digit university registration number or temporary ID.
     - `{{Event Name}}`: Title of the event.
     - `{{Club Name}}`: Organizing club name.
     - `{{Date}}`: Formatted event date (`DD-MM-YYYY`).
     - `{{Role}}`: "Participant", "Winner", "Student Volunteer", etc.
     - `{{Cert Number}}`: Unique credential identifier (e.g., `CODING-2026-0042`).
3. **Dynamic Asset Injection**:
   - **Club Logo**: Positioned at configured coordinate box.
   - **Processed Transparent Signature**: Injected into the coordinator/faculty signature slot.
   - **Dynamic Verification QR Code**: Renders a scannable QR code directing to the platform's public certificate verification URL.

---

### Step 7: High-Resolution Batch Certificate Generation
1. The coordinator clicks **Generate Certificates** in the Event Certificates tab.
2. The endpoint `POST /clubs/{club_id}/events/{event_id}/certificates/generate` runs:
   - Queries all participants with `verified == True`.
   - Allocates sequential, collision-free certificate numbers via `generate_cert_number(club.slug, year)`.
   - Spawns asynchronous worker tasks bounded by a CPU concurrency semaphore (`_GEN_SEMAPHORE`).
   - Uses Pillow (`PIL`) to compose the background canvas, TTF typography, logos, transparent signatures, and QR code.
   - Saves the finished high-resolution certificate to `storage/certificates/<club_slug>/<cert_number>.png`.
   - Sets the certificate status to `CertStatus.GENERATED`.

---

### Step 8: Review-First Preview & Email Dispatch
To prevent accidental misprints or incorrect role assignments, the system uses a **Review-First Architecture**:
1. **Preview Before Dispatch**:
   - Certificates are **not** immediately emailed upon generation.
   - The coordinator inspects the generated certificates grid in the dashboard, viewing high-resolution previews, certificate numbers, and student details.
   - If an error is spotted, the coordinator can correct participant data and re-generate.
2. **Batch Email Dispatch**:
   - Once satisfied, the coordinator clicks **Send Remaining / Dispatch Emails**.
   - The backend runs `_send_email_for_generated` through an email semaphore queue (`_EMAIL_SEMAPHORE = 3`) to prevent SMTP throttling.
   - Checks daily sending limits (`email_daily_limit`). If limit is reached, remaining emails are queued for the next scheduled window.
   - Sends a formatted HTML email with the certificate PNG attached and verification link included.
   - On successful delivery, the status updates to `CertStatus.EMAILED`.

---

### Step 9: Credit Rules & Semester Cap Awarding
Immediately upon successful email dispatch (`CertStatus.EMAILED`), the activity points engine executes `award_credits(cert)`:
1. **Rule Lookup**: Matches the certificate's `cert_type` against active `CreditRule` configurations (e.g., Technical Event Participant = 3 points, Winner = 5 points).
2. **Semester Cap Enforcement**:
   - Checks the maximum certificate allowance configured by the Superadmin for that category (`max_certificates` per semester).
   - If the student has already reached the maximum allowed certificates for that category in the current semester, `eligible_points` is set to `0` (recorded in credit history with capped status).
   - If within the cap, the full points are awarded and incremented on the student's cumulative record (`StudentCredit`).
3. **Audit Trail**: Every transaction is recorded in `CreditHistoryEntry` with timestamp, event reference, semester number, points awarded, and certificate ID.

---

### Step 10: Public Verification & Digital Wallet
1. **Student Digital Wallet**:
   - The certificate is immediately accessible in the student's **My Certificates** tab.
   - Students can view, download, or share high-resolution copies anytime.
2. **Public QR Verification**:
   - Any third-party employer, institution, or evaluator scanning the certificate's QR code is directed to `/verify/<cert_number>`.
   - The public verification endpoint confirms authenticity, issuing club, event name, recipient identity, issue date, and validity status.

---

## Signature Processing & Background Removal Pipeline

The signature processing engine (`backend/app/services/signature_service.py`) handles scanned or photographed faculty and coordinator signatures:

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
