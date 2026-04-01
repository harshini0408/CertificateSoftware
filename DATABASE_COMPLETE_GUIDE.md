# 🗄️ Complete Database Connection Guide & Verification

## Part 1: What Was Done with the Database

### 📊 Database Architecture Created

Your application uses **MongoDB** as the database with the following setup:

```
┌─────────────────────────────────────────────────┐
│         YOUR FASTAPI APPLICATION                │
│       (backend/app/main.py)                     │
│                                                  │
│  When app starts:                               │
│  1. Loads settings from .env                    │
│  2. Calls connect_db()                          │
│  3. Motor connects to MongoDB                   │
│  4. Beanie initializes all 10 models            │
│  5. Collections auto-created                    │
└─────────────────────────────────────────────────┘
                      ↕
              Motor AsyncClient
         (Async MongoDB Driver)
                      ↕
┌─────────────────────────────────────────────────┐
│         MONGODB DATABASE                        │
│                                                  │
│  Location: localhost:27017 (local machine)      │
│  Database Name: psgItech_certs                  │
│                                                  │
│  Collections (10):                              │
│  1. users          - All users with roles       │
│  2. clubs          - Student clubs              │
│  3. events         - Club events                │
│  4. participants   - Event participants         │
│  5. certificates   - Generated certificates    │
│  6. templates      - HTML certificate designs  │
│  7. email_logs     - Email sending history      │
│  8. scan_logs      - QR code verification logs  │
│  9. credit_rules   - Credit point rules         │
│  10. student_credits - Student credit points    │
└─────────────────────────────────────────────────┘
```

### 🔧 Key Components Created

#### 1. **database.py** - Database Connection Logic

Located at: `backend/app/database.py`

```python
# This file handles:
1. connect_db()
   - Creates Motor AsyncClient
   - Connects to MongoDB on localhost:27017
   - Initializes Beanie with all 10 models
   - Creates collections automatically
   - Creates indexes for unique fields

2. disconnect_db()
   - Closes MongoDB connection gracefully
   - Called on application shutdown

3. get_db()
   - Returns the database instance
   - Used by routers and services

4. get_client()
   - Returns the Motor client
   - Used for advanced operations
```

#### 2. **config.py** - Configuration Management

Located at: `backend/app/config.py`

Reads from `.env` file:
```env
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=psgItech_certs
```

#### 3. **Models** - 10 Beanie Documents

Located at: `backend/app/models/`

Each model defines a MongoDB collection:

```python
# Example: User Model (backend/app/models/user.py)
class User(Document):
    email: str = Indexed(unique=True)  # ← Create unique index
    password_hash: str
    full_name: str
    role: UserRole                      # ← SUPER_ADMIN, ADMIN, etc.
    is_active: bool = True
    created_at: datetime = datetime.utcnow()
    
    class Settings:
        name = "users"  # ← MongoDB collection name
```

**The 10 Models:**
1. **User** - Stores user accounts with roles
2. **Club** - Stores club information
3. **Event** - Stores events created by clubs
4. **Participant** - Stores people attending events
5. **Certificate** - Stores generated certificate records
6. **Template** - Stores HTML certificate templates
7. **EmailLog** - Logs all email sending attempts
8. **ScanLog** - Logs QR code scans
9. **CreditRule** - Stores credit point rules
10. **StudentCredit** - Tracks student credit points

#### 4. **main.py** - Application Initialization

Located at: `backend/app/main.py`

Uses **Lifespan Events** to manage database:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Runs when app starts:
    """
    print("🚀 Starting PSG iTech Certificate Platform...")
    await connect_db()  # ← Connect to MongoDB
    yield              # ← App runs here
    print("🛑 Shutting down...")
    await disconnect_db()  # ← Close connection
```

---

## Part 2: How to Connect the Database

### Step-by-Step Connection Process

#### Step 1: Ensure MongoDB is Running

```cmd
REM Check if MongoDB service is running
tasklist | find /I "mongod"

REM If not running, start it
net start MongoDB

REM Expected output:
REM The MongoDB service is starting...
REM The MongoDB service was started successfully.
```

#### Step 2: Verify MongoDB Connection

```cmd
REM Open MongoDB shell
mongosh

REM You should see:
REM test>

REM Test connection
db.version()

REM Should output version like: 5.0.0

REM Exit shell
exit
```

#### Step 3: Setup Python Environment

```cmd
REM Navigate to backend
cd d:\Certificate-Software\backend

REM Create virtual environment
python -m venv venv

REM Activate it
venv\Scripts\activate

REM You should see: (venv) in terminal
```

#### Step 4: Install Dependencies

```cmd
REM With venv activated
pip install -r requirements.txt

REM This installs:
REM - FastAPI 0.111.0
REM - Motor 3.4.0 (async MongoDB driver)
REM - Beanie 1.25.0 (MongoDB ODM)
REM - And 18 other packages
```

#### Step 5: Create .env File

```cmd
REM Copy template
copy .env.example .env

REM Edit .env in your editor (VS Code, Notepad, etc.)
REM Required changes:
```

**Edit `backend/.env`:**

```env
# REQUIRED - Generate a secure key
SECRET_KEY=<paste output from: python -c "import secrets; print(secrets.token_urlsafe(32))">

# OPTIONAL - Already correct for local development
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=psgItech_certs
APP_ENV=development

# Other settings (fine as-is)
STORAGE_PATH=D:/Certificate-Software/storage
```

#### Step 6: Generate SECRET_KEY

```cmd
REM Run this command to generate secure key
python -c "import secrets; print(secrets.token_urlsafe(32))"

REM Example output:
REM AbC1234567890xyz_AbC1234567890xyz_AbC1234567890

REM Copy the output and paste into .env as SECRET_KEY value
```

#### Step 7: Start the Application

```cmd
REM From backend directory with venv activated
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

REM Expected output (look for these lines):
```

```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete
🚀 Starting PSG iTech Certificate Platform...
✓ MongoDB connected successfully
✓ Database: psgItech_certs
```

**If you see the 3 messages above, your database is connected!** ✅

---

## Part 3: How to Verify the Database is Working

### Verification Method 1: Check Application Startup

```cmd
REM When you run the application:
python -m uvicorn app.main:app --reload

REM Look for these messages:
1. "🚀 Starting PSG iTech Certificate Platform..."
2. "✓ MongoDB connected successfully"
3. "✓ Database: psgItech_certs"
```

If all 3 messages appear, connection is successful! ✅

### Verification Method 2: Test Health Check Endpoint

**While application is running:**

Open browser or use curl:

```bash
# Option 1: Browser
http://localhost:8000/health

# Option 2: Command line
curl http://localhost:8000/health

# Option 3: PowerShell
Invoke-WebRequest http://localhost:8000/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "environment": "development"
}
```

If you get this response, the database is working! ✅

### Verification Method 3: Access API Documentation

While application is running:

```
http://localhost:8000/docs
```

You should see:
- Swagger UI interactive documentation
- List of available endpoints
- Try-it-out features

If this loads, API and database are connected! ✅

### Verification Method 4: Check MongoDB Collections

Open a new terminal (keep app running):

```cmd
REM Connect to MongoDB shell
mongosh

REM You should see: test>

REM Switch to our database
use psgItech_certs

REM List all collections (should see 10)
show collections

REM Expected output:
REM certificates
REM clubs
REM credit_rules
REM email_logs
REM events
REM participants
REM scan_logs
REM student_credits
REM templates
REM users

REM View a collection (should be empty initially)
db.users.find()

REM Exit
exit
```

If you see all 10 collections, database is working! ✅

### Verification Method 5: Check Indexes

```cmd
REM Connect to MongoDB
mongosh

REM Switch database
use psgItech_certs

REM View indexes on users collection
db.users.getIndexes()

REM Expected output includes:
REM - _id_ (default)
REM - email_1 (unique index we created)
```

---

## Part 4: How to View Database in MongoDB Atlas

### What is MongoDB Atlas?

MongoDB Atlas is a **cloud-hosted MongoDB service**. It allows you to:
- View your database visually
- Manage data through a web interface
- Monitor performance
- Backup data

### Two Options:

#### Option A: Local Database (Current Setup)
You're using **local MongoDB** (localhost:27017)
- ✅ No cloud, all data on your computer
- ✅ Faster for development
- ✅ No internet needed
- ✅ Best for learning

**View with: MongoDB Compass (GUI Tool)**

#### Option B: Cloud Database (MongoDB Atlas)
Move data to the cloud
- ✅ Access from anywhere
- ✅ Automatic backups
- ✅ Professional monitoring
- ✅ Easy to share with team

---

## Viewing Local Database with MongoDB Compass

### What is MongoDB Compass?

MongoDB Compass is a **free GUI tool** to view your local MongoDB database visually.

### Installation

1. **Download MongoDB Compass:**
   - Go to: https://www.mongodb.com/products/tools/compass
   - Click "Download"
   - Choose Windows installer

2. **Install:**
   - Run the installer
   - Follow default options
   - Launch Compass

### Using MongoDB Compass

**Step 1: Connect**

```
1. Open MongoDB Compass
2. Connection string: mongodb://localhost:27017
3. Click "Connect"
```

**Step 2: View Database**

```
Left panel should show:
├── admin
├── config
└── psgItech_certs  ← Click here
    ├── users
    ├── clubs
    ├── events
    ├── participants
    ├── certificates
    ├── templates
    ├── email_logs
    ├── scan_logs
    ├── credit_rules
    └── student_credits
```

**Step 3: View Collections**

Click on any collection to see:
- Documents (records) - currently empty
- Schema (structure)
- Indexes
- Validation rules

**Step 4: Insert Test Data**

```
1. Click on "users" collection
2. Click "Add Data"
3. Insert JSON:
{
  "email": "test@example.com",
  "password_hash": "$2b$12$...",
  "full_name": "Test User",
  "role": "student",
  "is_active": true
}
```

---

## Moving to MongoDB Atlas (Cloud)

### Why Use Atlas?

```
Local Development:          Production/Cloud:
├─ Your Computer           ├─ MongoDB Atlas
├─ localhost:27017         ├─ Cloud hosted
├─ Fast                    ├─ Accessible anywhere
└─ Learning                └─ Professional
```

### Steps to Use MongoDB Atlas

#### Step 1: Create Free Account

1. Go to: https://www.mongodb.com/cloud/atlas
2. Click "Start Free"
3. Sign up with email
4. Verify email

#### Step 2: Create Cluster

1. Click "Create a Deployment"
2. Select "Shared" (Free)
3. Choose region (AWS, closest to you)
4. Click "Create"
5. Wait 2-3 minutes

#### Step 3: Create Database User

1. Go to "Database Access"
2. Click "Add New Database User"
3. Username: `admin`
4. Password: Generate secure password
5. Click "Add User"

#### Step 4: Allow Network Access

1. Go to "Network Access"
2. Click "Add IP Address"
3. Select "Allow Access from Anywhere"
4. Click "Confirm"

#### Step 5: Get Connection String

1. Go to "Databases"
2. Click "Connect"
3. Choose "Connect your application"
4. Copy connection string:

```
mongodb+srv://admin:<password>@cluster0.xxxxx.mongodb.net/psgItech_certs?retryWrites=true&w=majority
```

#### Step 6: Update .env

```env
# Replace:
MONGODB_URL=mongodb://localhost:27017

# With:
MONGODB_URL=mongodb+srv://admin:your-password@cluster0.xxxxx.mongodb.net/psgItech_certs?retryWrites=true&w=majority
```

#### Step 7: Restart Application

```cmd
REM Stop current application (Ctrl+C)
REM Restart
python -m uvicorn app.main:app --reload
```

#### Step 8: View in Atlas

1. Go to MongoDB Atlas dashboard
2. Click "Databases"
3. Click "Browse Collections"
4. View your data in real-time!

---

## Complete Connection Workflow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  USER (Your Code)                                            │
│      ↓                                                        │
│  FastAPI Application (app.main:app)                          │
│      ↓                                                        │
│  Lifespan Event: connect_db()                                │
│      ↓                                                        │
│  database.py: Creates Motor AsyncClient                      │
│      ↓                                                        │
│  Motor connects to MongoDB Server                            │
│      ↓                                                        │
│  Beanie initializes 10 models                                │
│      ↓                                                        │
│  Collections auto-created in MongoDB                         │
│      ↓                                                        │
│  ✅ CONNECTED! Ready for operations                          │
│                                                              │
│  Operations flow:                                            │
│  Your Code → Routers → Services → Models → Motor → MongoDB   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Verification Checklist

Use this checklist to verify everything is working:

```
SETUP PHASE:
☐ MongoDB installed (mongod --version works)
☐ MongoDB service running (tasklist | find "mongod")
☐ Virtual environment created (venv\Scripts\activate)
☐ Dependencies installed (pip list shows motor, beanie)
☐ .env file created with MONGODB_URL and SECRET_KEY
☐ .env file in correct location (backend/.env)

STARTUP PHASE:
☐ Application starts without errors
☐ See "🚀 Starting PSG iTech Certificate Platform..."
☐ See "✓ MongoDB connected successfully"
☐ See "✓ Database: psgItech_certs"

VERIFICATION PHASE:
☐ http://localhost:8000/health returns JSON
☐ http://localhost:8000/docs loads Swagger UI
☐ mongosh connects and shows version
☐ mongosh → use psgItech_certs → show collections shows 10 items

OPTIONAL:
☐ MongoDB Compass connects to localhost:27017
☐ Can see psgItech_certs database with 10 collections
```

---

## Troubleshooting Connection Issues

### Issue 1: MongoDB Won't Connect

```
Error: Could not connect to server
```

**Solution:**
```cmd
REM Check if MongoDB is running
tasklist | find "mongod"

REM If not, start it
net start MongoDB

REM Verify connection
mongosh
```

### Issue 2: "Database not connected" Error

```
Error: RuntimeError: Database not connected
```

**Solution:**
```
1. Ensure MongoDB service is running (net start MongoDB)
2. Ensure MONGODB_URL in .env is correct
3. Ensure .env file is in backend/ directory (not backend/.env.txt)
4. Restart the application
```

### Issue 3: Port 27017 Already in Use

```
Error: Address already in use
```

**Solution:**
```cmd
REM Find process using port 27017
netstat -ano | findstr :27017

REM Kill the process (replace PID)
taskkill /PID 5432 /F
```

### Issue 4: Collections Not Created

```
Collections don't appear in mongosh
```

**Solution:**
```
1. Ensure app is running when checking
2. Collections auto-create on first connect
3. Check app startup messages for errors
4. Verify all models imported in database.py
```

---

## File Reference

### Key Files for Database Connection

| File | Purpose | Location |
|------|---------|----------|
| database.py | Connection logic | `backend/app/database.py` |
| main.py | App initialization | `backend/app/main.py` |
| config.py | Settings loader | `backend/app/config.py` |
| .env | Environment variables | `backend/.env` |
| User model | Example model | `backend/app/models/user.py` |
| requirements.txt | Dependencies | `backend/requirements.txt` |

---

## Summary

### What You Have:
✅ Local MongoDB database on your computer
✅ 10 auto-created collections
✅ Motor async driver connected
✅ Beanie ODM for type-safe operations
✅ FastAPI integrated with database

### How It Works:
1. Application starts
2. connect_db() runs
3. Motor connects to MongoDB
4. Beanie initializes models
5. Collections auto-created
6. App ready for requests

### How to Verify:
1. ✅ Check startup messages
2. ✅ Test /health endpoint
3. ✅ Use mongosh to view collections
4. ✅ Use MongoDB Compass GUI

### Next Steps:
1. Read SETUP_GUIDE.md for detailed setup
2. Review DATABASE_CONNECTION_STEPS.md for step-by-step
3. Start Phase 2: Building endpoints
4. Create authentication system
5. Build user management APIs

---

**Status:** Database Connection Complete ✓  
**Next:** Phase 2 Development  
**Questions?** Review SETUP_GUIDE.md or DATABASE_CONNECTION_STEPS.md
