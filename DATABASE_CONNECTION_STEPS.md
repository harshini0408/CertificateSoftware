# MongoDB Database Connection - Step by Step Instructions

## 📍 You Are Here: Phase 1 - Database Setup Complete ✓

---

## STEP-BY-STEP MONGODB CONNECTION GUIDE

### STEP 1: MongoDB Installation & Verification (5 minutes)

#### Windows Installation

```
1. Go to: https://www.mongodb.com/try/download/community
2. Select:
   - Version: Latest (5.0+)
   - Platform: Windows
   - Package: msi
3. Click Download
4. Run the .msi installer
5. Choose "Complete" setup
6. ✓ Check "Install MongoDB as a Service"
7. Complete installation
8. MongoDB starts automatically!
```

#### Verify MongoDB is Running

```cmd
REM Open Command Prompt (as Administrator recommended)

REM Check MongoDB version
mongod --version

REM Expected output:
REM db version v5.0.0 (or higher)
REM Build info: ...
```

If you get `'mongod' is not recognized`:
- Add MongoDB to PATH (usually `C:\Program Files\MongoDB\Server\5.0\bin`)
- Or restart Command Prompt after installation

---

### STEP 2: Connect to MongoDB Shell

```cmd
REM Connect to local MongoDB
mongosh

REM You should see:
REM test>

REM Test the connection
db.version()

REM Expected: 5.0.0 (or your version)

REM Exit
exit
```

---

### STEP 3: Install Python Virtual Environment

```cmd
REM Navigate to backend directory
cd d:\Certificate-Software\backend

REM Create virtual environment
python -m venv venv

REM Activate virtual environment
venv\Scripts\activate

REM You should see: (venv) in terminal
```

---

### STEP 4: Install Dependencies

```cmd
REM With venv activated, install all packages
pip install -r requirements.txt

REM This installs:
REM - FastAPI (web framework)
REM - Motor (async MongoDB driver)
REM - Beanie (ODM - Object Document Mapper)
REM - All other dependencies

REM Installation takes 2-5 minutes...
```

---

### STEP 5: Create and Configure .env File

```cmd
REM Copy the example file
copy .env.example .env

REM Open .env in your editor (notepad, VS Code, etc.)
REM Update these values:
```

**Edit `.env` file:**

```env
# REQUIRED - Change these
APP_ENV=development
SECRET_KEY=<your-generated-key-here>
STORAGE_PATH=D:/Certificate-Software/storage

# OPTIONAL - Already set correctly
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=psgItech_certs
ALGORITHM=HS256
FRONTEND_URL=http://localhost:5173
```

**Generate SECRET_KEY:**

```cmd
REM Run this command
python -c "import secrets; print(secrets.token_urlsafe(32))"

REM Copy the output and paste in .env as SECRET_KEY value
REM Example output:
REM AbC1234567890xyz_AbC1234567890xyz_Abc
```

---

### STEP 6: Verify Database Configuration

```cmd
REM Test imports (with venv activated)
python -c "import motor; print('✓ Motor installed')"
python -c "import beanie; print('✓ Beanie installed')"
python -c "import fastapi; print('✓ FastAPI installed')"

REM All three should print ✓ messages
```

---

### STEP 7: Start the Application

```cmd
REM From backend directory with venv activated
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

REM Expected output:
REM INFO:     Uvicorn running on http://127.0.0.1:8000
REM 🚀 Starting PSG iTech Certificate Platform...
REM ✓ MongoDB connected successfully
REM ✓ Database: psgItech_certs
```

---

### STEP 8: Test Connection in Browser

#### Health Check
```
URL: http://localhost:8000/health

Expected Response:
{
  "status": "healthy",
  "environment": "development"
}
```

#### API Documentation
```
URL: http://localhost:8000/docs

You should see:
- Swagger UI interactive docs
- Health check endpoint
- Root endpoint
```

---

### STEP 9: Verify Database Created

```cmd
REM Open a new terminal (keep app running)
REM With venv activated:

mongosh

REM In MongoDB shell:
show databases

REM Should see: psgItech_certs

use psgItech_certs

show collections

REM Should see 10 collections:
REM - users
REM - clubs
REM - events
REM - templates
REM - participants
REM - certificates
REM - email_logs
REM - scan_logs
REM - credit_rules
REM - student_credits

exit
```

---

## 🎯 What Each Component Does

### MongoDB Server (mongod)
- **What:** Database server
- **Runs on:** Port 27017 (default)
- **Status:** Windows Service (auto-starts)
- **Data location:** `C:\data\db\` (Windows default)

### Motor
- **What:** Async MongoDB driver for Python
- **Why async:** Non-blocking database calls
- **Used by:** FastAPI for handling multiple requests

### Beanie ODM
- **What:** Object-Document Mapper (like ORM for MongoDB)
- **Does:** Maps Python classes to MongoDB documents
- **Handles:** Type validation, indexing, relationships

### FastAPI
- **What:** Modern web framework
- **Why:** Built-in async support, automatic API docs
- **Handles:** HTTP requests, routing, request validation

### Lifespan Events
- **On startup:** `connect_db()` - Connect to MongoDB
- **On shutdown:** `disconnect_db()` - Close connections
- **Benefit:** Clean resource management

---

## 📊 Database Schema

### Collections Created (10 Documents)

```
users
├─ email (unique index)
├─ password_hash
├─ full_name
├─ role (SUPER_ADMIN, ADMIN, COORDINATOR, STUDENT)
└─ timestamps (created_at, updated_at)

clubs
├─ name (unique index)
├─ coordinator_id (references users)
└─ timestamps

events
├─ name
├─ club_id (references clubs)
├─ event_date
└─ timestamps

participants
├─ event_id (references events)
├─ user_id (references users - optional)
├─ name
├─ email
└─ position (for winners)

certificates
├─ certificate_number (unique index)
├─ verification_token (unique index)
├─ participant_id (references participants)
├─ event_id (references events)
├─ template_id (references templates)
├─ file_path
├─ qr_code_path
├─ is_sent
└─ timestamps

templates
├─ name (unique index)
├─ template_type (participation, winner_1st, etc.)
├─ html_content
├─ background_image_url
└─ fonts_used

email_logs
├─ certificate_id (references certificates)
├─ recipient_email
├─ status (PENDING, SENT, FAILED)
├─ retry_count
└─ timestamps

scan_logs
├─ certificate_id (references certificates)
├─ scanned_by_ip
├─ is_valid
└─ scanned_at

credit_rules
├─ role (unique index)
├─ credits_per_event
├─ max_credits_per_year
└─ is_active

student_credits
├─ user_id (indexed)
├─ event_id (references events)
├─ credits_earned
├─ role
└─ created_at
```

---

## 🔧 Quick Reference Commands

### Start/Stop Services
```cmd
REM Start MongoDB (if not running)
net start MongoDB

REM Stop MongoDB
net stop MongoDB

REM Check status
tasklist | find /I "mongod"
```

### Virtual Environment
```cmd
REM Activate
venv\Scripts\activate

REM Deactivate
deactivate
```

### Database Operations
```cmd
REM Connect to MongoDB
mongosh

REM Connect to specific database
mongosh --db psgItech_certs

REM Run commands in shell
show databases
use psgItech_certs
show collections
db.users.find()
```

### Application
```cmd
REM Start with auto-reload (development)
python -m uvicorn app.main:app --reload

REM Start without reload (production)
python -m uvicorn app.main:app

REM Stop: Press Ctrl+C
```

---

## ✅ Success Checklist

- [ ] MongoDB installed and running (`mongod --version` works)
- [ ] Can connect to MongoDB shell (`mongosh` connects)
- [ ] Virtual environment created and activated
- [ ] All dependencies installed (`pip install -r requirements.txt`)
- [ ] `.env` file created with correct paths
- [ ] `SECRET_KEY` generated and set
- [ ] Application starts without errors
- [ ] Health endpoint responds (http://localhost:8000/health)
- [ ] API docs load (http://localhost:8000/docs)
- [ ] MongoDB has 10 collections (`show collections`)
- [ ] No connection errors in terminal output

---

## 🚨 Common Issues & Solutions

### Issue: MongoDB won't start
```cmd
REM Solution 1: Check if service exists
sc query MongoDB

REM Solution 2: Start service manually
net start MongoDB

REM Solution 3: Reinstall
C:\Program Files\MongoDB\Server\5.0\bin\mongod.exe --install
```

### Issue: Python can't find dependencies
```cmd
REM Solution: Reinstall in clean environment
pip cache purge
pip install -r requirements.txt --force-reinstall --no-cache-dir
```

### Issue: Port 27017 already in use
```cmd
REM Solution: Find and kill process using port
netstat -ano | findstr :27017
taskkill /PID <PID> /F
```

### Issue: `.env` file not loading
```cmd
REM Solution: Ensure file is in correct location
REM Should be: d:\Certificate-Software\backend\.env
REM Not: d:\Certificate-Software\backend\.env.txt
```

### Issue: "Database not connected" error
```
Solution: Add 5 second delay before first request:
REM Ensure MongoDB is fully started
REM Check MONGODB_URL in .env is correct
REM Restart application
```

---

## 📚 File Structure

```
backend/
├── requirements.txt          ← All Python packages
├── .env                      ← Your configuration (NOT in git)
├── .env.example             ← Template for .env
├── .gitignore               ← What to ignore in git
│
├── app/
│   ├── config.py            ← Settings from .env
│   ├── database.py          ← MongoDB connection logic ← YOU ARE HERE
│   ├── main.py              ← FastAPI app initialization
│   ├── scheduler.py         ← Task scheduler (phase 2)
│   │
│   ├── models/              ← MongoDB document definitions
│   │   ├── user.py
│   │   ├── club.py
│   │   ├── event.py
│   │   ├── participant.py
│   │   ├── certificate.py
│   │   ├── template.py
│   │   ├── email_log.py
│   │   ├── scan_log.py
│   │   ├── credit_rule.py
│   │   └── student_credit.py
│   │
│   ├── schemas/             ← Pydantic validation schemas (phase 2)
│   ├── routers/             ← API endpoints (phase 2)
│   ├── services/            ← Business logic (phase 2)
│   ├── core/                ← Security, dependencies (phase 2)
│   └── static/              ← HTML templates, fonts
│
└── storage/
    ├── certs/              ← Generated certificate files
    └── assets/             ← Uploaded images, signatures
```

---

## 🎓 Learning Path

### Current Phase (Phase 1) - COMPLETED ✓
1. Project structure created
2. Models defined (10 documents)
3. Database connection configured
4. Application initialization complete

### Next Phase (Phase 2)
1. Authentication & Authorization
2. User Management (registration, login)
3. Club & Event Management APIs
4. Participant Management
5. Certificate Generation Logic
6. Email Service Integration
7. QR Code Verification

---

## 🎉 You're Ready!

Your database connection is complete. The application is ready to:
- ✓ Connect to MongoDB
- ✓ Create collections automatically
- ✓ Validate data with Beanie
- ✓ Handle async operations

Next step: Start building Phase 2 features!

---

**Generated:** March 30, 2026  
**Database:** MongoDB Local (No Docker, No Cloud)  
**Driver:** Motor 3.4.0 (Async)  
**ODM:** Beanie 1.25.0
