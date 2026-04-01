# ✅ Step-by-Step Database Verification Guide

## Complete Verification Walkthrough (15 minutes)

Follow these exact steps to verify your database is working perfectly.

---

## 🎯 STEP 1: Verify MongoDB Service is Running (2 minutes)

### Command
```cmd
tasklist | find /I "mongod"
```

### Expected Result
```
mongod.exe                    5432 Services                0 125,432 K
```

### What It Means
✅ MongoDB service is running on your system

### Troubleshooting
If you see nothing (empty result):

```cmd
REM Start MongoDB service
net start MongoDB

REM Wait a few seconds, then verify again
tasklist | find /I "mongod"
```

**Expected output after starting:**
```
The MongoDB service is starting...
The MongoDB service was started successfully.
```

---

## 🎯 STEP 2: Connect to MongoDB Shell (2 minutes)

### Command
```cmd
mongosh
```

### Expected Result
```
Current Mongosh Log ID: ...
Connecting to: mongodb://localhost/
MongoShell version v..
```

You should see: `test>`

### Test Connection
```bash
# In the shell:
db.version()
```

### Expected Output
```
5.0.0
(or your MongoDB version)
```

### Exit Shell
```
exit
```

**Status:** ✅ MongoDB shell working

---

## 🎯 STEP 3: Setup Python Environment (3 minutes)

### Navigate to Backend
```cmd
cd d:\Certificate-Software\backend
```

### Create Virtual Environment (if not done)
```cmd
python -m venv venv
```

### Activate Virtual Environment
```cmd
venv\Scripts\activate
```

### Verify Activation
You should see: `(venv)` at the start of your terminal line

```cmd
(venv) d:\Certificate-Software\backend>
```

**Status:** ✅ Virtual environment activated

---

## 🎯 STEP 4: Install Dependencies (3 minutes)

### Install All Packages
```cmd
pip install -r requirements.txt
```

### Wait for Installation
You should see:
```
Installing collected packages: ...
Successfully installed fastapi-0.111.0, motor-3.4.0, beanie-1.25.0, ...
```

### Verify Key Dependencies
```cmd
REM Verify FastAPI
python -c "import fastapi; print('✓ FastAPI ok')"

REM Verify Motor
python -c "import motor; print('✓ Motor ok')"

REM Verify Beanie
python -c "import beanie; print('✓ Beanie ok')"
```

### Expected Output
```
✓ FastAPI ok
✓ Motor ok
✓ Beanie ok
```

**Status:** ✅ All dependencies installed

---

## 🎯 STEP 5: Configure Environment Variables (2 minutes)

### Copy .env Template
```cmd
copy .env.example .env
```

### Edit .env File
Open `backend/.env` in your editor (VS Code, Notepad, etc.)

### Find and Update These Lines

**Line 1: Generate SECRET_KEY**
```cmd
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Copy the output (looks like: `AbC1234567890xyz_...`)

**In .env, replace:**
```env
# From:
SECRET_KEY=replace-with-a-long-random-secret-min-32-chars

# To:
SECRET_KEY=AbC1234567890xyz_AbC1234567890xyz_AbC
```

**Other critical settings (verify these are correct):**
```env
# Should already be correct for local development:
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=psgItech_certs
APP_ENV=development

# Update storage path (adjust for your system):
STORAGE_PATH=D:/Certificate-Software/storage
```

### Save the File
Ctrl+S in your editor

**Status:** ✅ Environment configured

---

## 🎯 STEP 6: Start the Application (1 minute)

### Start FastAPI Application
```cmd
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Wait for Startup Messages
Watch the terminal carefully for:

**Message 1:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000
```

**Message 2:**
```
INFO:     Application startup complete
```

**Message 3 (Most Important):**
```
🚀 Starting PSG iTech Certificate Platform...
```

**Message 4:**
```
✓ MongoDB connected successfully
```

**Message 5:**
```
✓ Database: psgItech_certs
```

### Full Expected Output
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete
🚀 Starting PSG iTech Certificate Platform...
✓ MongoDB connected successfully
✓ Database: psgItech_certs
```

**Status:** ✅ Application started and connected to MongoDB

---

## 🎯 STEP 7: Test Health Endpoint (1 minute)

### Option A: Browser
Open URL in your browser:
```
http://localhost:8000/health
```

### Option B: Command Line (new terminal)
```cmd
curl http://localhost:8000/health
```

### Option C: PowerShell
```powershell
Invoke-WebRequest http://localhost:8000/health | ConvertTo-Json
```

### Expected Response
```json
{
  "status": "healthy",
  "environment": "development"
}
```

**Status:** ✅ Health endpoint working

---

## 🎯 STEP 8: View API Documentation (1 minute)

### Open in Browser
```
http://localhost:8000/docs
```

### What You Should See
- Swagger UI interface
- List of available endpoints
- Interactive documentation
- "Try it out" feature

**Status:** ✅ API docs accessible

---

## 🎯 STEP 9: Verify Collections in MongoDB (2 minutes)

### Open New Terminal (keep app running)
```cmd
REM Open a NEW command prompt
REM Don't close the one running the app
```

### Connect to MongoDB Shell
```cmd
mongosh
```

### Switch to Our Database
```bash
# In the shell:
use psgItech_certs
```

### List Collections
```bash
show collections
```

### Expected Output (All 10 Collections)
```
certificates
clubs
credit_rules
email_logs
events
participants
scan_logs
student_credits
templates
users
```

**Status:** ✅ All 10 collections created

---

## 🎯 STEP 10: Check Collection Structure (1 minute)

### View Users Collection Schema
```bash
# In the shell:
db.users.find()
```

### Expected Output
```
(empty initially - no documents yet)
```

### Check Indexes on Users
```bash
db.users.getIndexes()
```

### Expected Output
Shows indexes:
```
[
  { v: 2, key: { _id: 1 }, name: '_id_' },
  { v: 2, key: { email: 1 }, name: 'email_1', unique: true }
]
```

This shows:
- ✅ Default _id index
- ✅ Unique email index we created

### View Other Collections
```bash
REM View clubs
db.clubs.find()

REM View events  
db.events.find()

REM View certificates
db.certificates.find()
```

**Status:** ✅ Collections have correct structure

---

## 🎯 STEP 11: Optional - Use MongoDB Compass (GUI)

### Download MongoDB Compass
1. Go to: https://www.mongodb.com/products/tools/compass
2. Download for Windows
3. Install (next, next, finish)

### Launch Compass
1. Open MongoDB Compass
2. Connection string: `mongodb://localhost:27017`
3. Click "Connect"

### View Collections
Left panel shows:
```
admin
config
psgItech_certs  ← Click here
  ├─ users
  ├─ clubs
  ├─ events
  ├─ participants
  ├─ certificates
  ├─ templates
  ├─ email_logs
  ├─ scan_logs
  ├─ credit_rules
  └─ student_credits
```

**Status:** ✅ Visual database browser working

---

## ✅ Final Verification Checklist

Go through this checklist:

```
MONGODB SERVICE:
☐ mongod process running (tasklist shows mongod.exe)
☐ mongosh connects successfully
☐ db.version() returns version number

PYTHON ENVIRONMENT:
☐ Virtual environment activated ((venv) in terminal)
☐ All dependencies installed (pip list shows fastapi, motor, beanie)
☐ .env file exists in backend/ directory
☐ SECRET_KEY is set in .env

APPLICATION:
☐ Application starts without errors
☐ See "🚀 Starting PSG iTech Certificate Platform..."
☐ See "✓ MongoDB connected successfully"
☐ See "✓ Database: psgItech_certs"

API:
☐ http://localhost:8000/health responds with JSON
☐ http://localhost:8000/docs loads Swagger UI
☐ http://localhost:8000/ shows welcome message

MONGODB:
☐ mongosh connects and shows version
☐ use psgItech_certs works
☐ show collections shows 10 items
☐ All 10 collections visible:
  ☐ users
  ☐ clubs
  ☐ events
  ☐ participants
  ☐ certificates
  ☐ templates
  ☐ email_logs
  ☐ scan_logs
  ☐ credit_rules
  ☐ student_credits

INDEXES:
☐ db.users.getIndexes() shows email unique index
☐ db.clubs.getIndexes() shows name unique index
☐ db.certificates.getIndexes() shows certificate_number unique index
```

**If ALL are checked:** ✅ **DATABASE IS FULLY VERIFIED AND WORKING!**

---

## 🎉 Success! Database is Fully Working

When all steps are complete, you have:

✅ MongoDB running locally  
✅ FastAPI application connected  
✅ All 10 collections created  
✅ Indexes configured  
✅ API endpoints working  
✅ Health check passing  
✅ Documentation accessible  

---

## 📞 If Something Goes Wrong

### Most Common Issues and Fixes

#### Issue: "MongoDB service not running"
```cmd
net start MongoDB
REM Wait 5 seconds
tasklist | find "mongod"
```

#### Issue: "Can't connect to port 27017"
```cmd
REM Find what's using the port
netstat -ano | findstr :27017

REM Kill the process (replace PID)
taskkill /PID 5432 /F

REM Start MongoDB again
net start MongoDB
```

#### Issue: ".env not loading"
```
Check:
1. File is named ".env" (not ".env.txt")
2. File is in "backend/" directory
3. Restart application
```

#### Issue: "Dependencies not installing"
```cmd
pip cache purge
pip install -r requirements.txt --force-reinstall --no-cache-dir
```

#### Issue: "Application won't connect to database"
```
Check:
1. MongoDB service running (net start MongoDB)
2. MONGODB_URL correct in .env
3. Database name correct (psgItech_certs)
4. Restart application
5. Check terminal for error messages
```

---

## 🔄 Quick Restart Process

If you close the application and want to restart:

```cmd
REM 1. Open terminal
REM 2. Navigate to backend
cd d:\Certificate-Software\backend

REM 3. Activate venv (if not already)
venv\Scripts\activate

REM 4. Ensure MongoDB is running
net start MongoDB

REM 5. Start application
python -m uvicorn app.main:app --reload

REM 6. Check for success messages:
REM    ✓ MongoDB connected successfully
REM    ✓ Database: psgItech_certs

REM 7. Test in browser: http://localhost:8000/health
```

---

## 📚 Where to Find Help

| Issue | Documentation |
|-------|---|
| Setup help | SETUP_GUIDE.md |
| Connection steps | DATABASE_CONNECTION_STEPS.md |
| System overview | ARCHITECTURE.md |
| Visual diagrams | DATABASE_VISUAL_DIAGRAMS.md |
| Quick commands | QUICK_REFERENCE.md |
| Database details | DATABASE_COMPLETE_GUIDE.md |

---

## 🎯 Next Steps After Verification

Once verification is complete:

1. ✅ Keep application running
2. ✅ Keep MongoDB running
3. ✅ Start Phase 2 development:
   - Build authentication system
   - Create user APIs
   - Build club management
   - Create event management
   - Implement certificate generation

---

**Verification Complete!** 🎉

Your database is now fully set up, connected, and verified.

Ready to build Phase 2 features!

---

**Last Updated:** March 31, 2026  
**Status:** Database Connection Verified ✅  
**Next:** Phase 2 Development
