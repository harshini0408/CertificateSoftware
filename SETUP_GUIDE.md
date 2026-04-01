# PSG iTech Certificate Platform - Setup Guide

## Phase 1: Database Connection Setup

This guide walks you through setting up MongoDB and connecting it to the FastAPI application using Beanie ODM.

---

## 📋 Prerequisites

- Python 3.10 or higher
- MongoDB Community Edition (Windows)
- Git

---

## Step 1️⃣: Install MongoDB on Windows

### Option A: Using MongoDB Community Edition (Recommended)

1. **Download MongoDB:**
   - Visit: https://www.mongodb.com/try/download/community
   - Select "Windows" and "msi" format
   - Download the latest version (5.0+)

2. **Install MongoDB:**
   - Run the `.msi` installer
   - Choose "Complete" installation
   - **During setup, check "Install MongoDB as a Service"**
   - This will start MongoDB automatically on system boot

3. **Verify Installation:**
   ```cmd
   mongod --version
   mongo --version
   ```

### Option B: Using Chocolatey (If installed)

```cmd
choco install mongodb-community
```

---

## Step 2️⃣: Verify MongoDB is Running

MongoDB runs as a Windows Service by default after installation.

```cmd
# Check if MongoDB service is running
tasklist | find /I "mongod"

# If not running, start it manually
net start MongoDB

# To stop (if needed)
net stop MongoDB
```

### Check Connection

```cmd
# Connect to MongoDB shell
mongosh

# In the shell, test connection
db.version()

# Exit
exit
```

Expected output: MongoDB version number and "true"

---

## Step 3️⃣: Install Python Dependencies

Navigate to the backend folder and install all required packages:

```cmd
cd d:\Certificate-Software\backend

# Create virtual environment (recommended)
python -m venv venv

# Activate virtual environment
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Verify Installation

```cmd
python -c "import motor; import beanie; import fastapi; print('✓ All dependencies installed')"
```

---

## Step 4️⃣: Configure Environment Variables

1. **Copy the example file:**
   ```cmd
   copy .env.example .env
   ```

2. **Edit `.env` file with your settings:**
   ```env
   # App Settings
   APP_ENV=development
   SECRET_KEY=your-very-long-random-secret-key-at-least-32-chars
   ALGORITHM=HS256
   FRONTEND_URL=http://localhost:5173
   DOMAIN=localhost

   # MongoDB (Already configured for local connection)
   MONGODB_URL=mongodb://localhost:27017
   DATABASE_NAME=psgItech_certs

   # JWT Tokens
   ACCESS_TOKEN_EXPIRE_MINUTES=30
   REFRESH_TOKEN_EXPIRE_DAYS=7

   # Storage (Update path for your system)
   STORAGE_PATH=D:/Certificate-Software/storage

   # Gmail OAuth2 (Configure later in Phase 2)
   GMAIL_CLIENT_ID=your-client-id
   GMAIL_CLIENT_SECRET=your-client-secret
   GMAIL_REFRESH_TOKEN=your-refresh-token
   GMAIL_SENDER_EMAIL=certificates@psgitech.ac.in
   GMAIL_SENDER_NAME=PSG iTech Certificates
   GMAIL_DAILY_LIMIT=500

   # Super Admin (Change on first login!)
   SUPER_ADMIN_EMAIL=admin@psgitech.ac.in
   SUPER_ADMIN_PASSWORD=change-on-first-login
   SUPER_ADMIN_NAME=Platform Admin
   ```

### Generate SECRET_KEY

```cmd
# Run this command to generate a secure random key
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Copy the output and paste it as `SECRET_KEY` in `.env`

---

## Step 5️⃣: Understand the Database Architecture

### Models Created (10 Documents)

1. **User** - Platform users with roles
2. **Club** - Student clubs/organizations
3. **Event** - Club events
4. **Participant** - Event participants
5. **Certificate** - Generated certificates
6. **Template** - Certificate HTML templates
7. **EmailLog** - Email sending history
8. **ScanLog** - QR code scan verification logs
9. **CreditRule** - Credit rules per role
10. **StudentCredit** - Student credit tracking

### Database Diagram

```
User (1) ──┬── Many Clubs (as coordinator)
           └── Many StudentCredits

Club (1) ──── Many Events (1) ──── Many Participants (1) ──── Many Certificates
              |                                              |
              └─────────────────────────────────────────────┘
              (Uses Template)
              
Template (1) ──── Many Certificates

Certificate (1) ┬──── Many EmailLogs
                └──── Many ScanLogs

CreditRule (1) ──── Many StudentCredits
```

---

## Step 6️⃣: Database Connection Flow

### How it Works

```
1. Application Starts
   ↓
2. FastAPI loads config from .env
   ↓
3. Lifespan event triggers on startup
   ↓
4. connect_db() is called
   ↓
5. Motor AsyncClient connects to MongoDB
   ↓
6. Beanie ODM initializes with all document models
   ↓
7. Database is ready for operations
   ↓
8. Application serves requests
   ↓
9. On shutdown, disconnect_db() closes connections
```

### Code Flow in `database.py`

```python
# When app starts:
app = FastAPI(lifespan=lifespan)

# lifespan context manager runs:
@asynccontextmanager
async def lifespan(app):
    await connect_db()  # ← Initialize database
    yield              # ← App is running
    await disconnect_db() # ← Cleanup on shutdown

# connect_db() does:
1. Create Motor AsyncClient(mongodb://localhost:27017)
2. Select database (psgItech_certs)
3. Call init_beanie() with all 10 models
4. Creates indexes for unique fields
5. Print success message
```

---

## Step 7️⃣: Test the Connection

### Run the Application

```cmd
# From backend directory with venv activated
cd d:\Certificate-Software\backend

# Start the application
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Expected Output

```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
🚀 Starting PSG iTech Certificate Platform...
✓ MongoDB connected successfully
✓ Database: psgItech_certs
```

### Verify in Browser

Open browser and test:

- **Health Check:** http://localhost:8000/health
  - Expected response:
  ```json
  {
    "status": "healthy",
    "environment": "development"
  }
  ```

- **API Docs:** http://localhost:8000/docs
  - Swagger UI should load

- **ReDoc:** http://localhost:8000/redoc
  - Alternative API documentation

---

## Step 8️⃣: Verify MongoDB Data

### Using MongoDB Shell

```cmd
# Connect to MongoDB
mongosh

# List databases
show databases

# Use the certificate database
use psgItech_certs

# Show collections (should be empty initially)
show collections

# Check indexes
db.users.getIndexes()

# Exit
exit
```

### Using MongoDB Compass (GUI Tool - Recommended)

1. Download: https://www.mongodb.com/products/tools/compass
2. Install and launch
3. Connection string: `mongodb://localhost:27017`
4. Should see `psgItech_certs` database and 10 collections

---

## Step 9️⃣: Models and Schema Explanation

### Example: User Model

```python
class User(Document):
    email: str = Indexed(unique=True)      # Unique email
    password_hash: str                     # Hashed password
    full_name: str                         # Display name
    role: UserRole = UserRole.STUDENT      # SUPER_ADMIN, ADMIN, COORDINATOR, STUDENT
    is_active: bool = True                 # Account status
    is_verified: bool = False               # Email verified status
    phone: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    created_at: datetime = datetime.utcnow()
    updated_at: datetime = datetime.utcnow()
    last_login: Optional[datetime] = None
    
    class Settings:
        name = "users"  # MongoDB collection name
```

### Beanie ODM Features Used

- **Document class** - Base class for MongoDB documents
- **Indexed()** - Creates database indexes
- **unique=True** - Ensures unique values
- **Optional[]** - Nullable fields
- **Enum** - Type-safe enumerations
- **datetime** - Automatic timestamp handling
- **Settings.name** - Custom collection name

---

## 🔟 Environment Setup Checklist

- [ ] MongoDB installed and running as service
- [ ] Python virtual environment created and activated
- [ ] Dependencies installed from `requirements.txt`
- [ ] `.env` file created and configured
- [ ] `SECRET_KEY` generated and set
- [ ] `STORAGE_PATH` directory exists or will be created
- [ ] Application starts without errors
- [ ] Health check endpoint responds (http://localhost:8000/health)
- [ ] MongoDB shell connects successfully
- [ ] 10 collections created in MongoDB

---

## Troubleshooting

### MongoDB Won't Start

```cmd
# Check if service is installed
sc query MongoDB

# Start the service
net start MongoDB

# Check MongoDB logs
cd "C:\Program Files\MongoDB\Server\{version}\log"
type mongod.log
```

### Python Dependencies Issue

```cmd
# Clear pip cache and reinstall
pip cache purge
pip install -r requirements.txt --force-reinstall
```

### Port 27017 Already in Use

```cmd
# Find what's using port 27017
netstat -ano | findstr :27017

# Kill the process (replace PID)
taskkill /PID <PID> /F
```

### Connection String Issues

```cmd
# Test connection
python -c "from motor.motor_asyncio import AsyncClient; print('Motor OK')"
python -c "import beanie; print('Beanie OK')"
```

---

## Next Steps (Phase 2)

After successfully connecting to MongoDB:

1. ✅ Create Authentication System (JWT)
2. ✅ Implement User Registration/Login
3. ✅ Build Club Management APIs
4. ✅ Create Event Management APIs
5. ✅ Implement Certificate Generation
6. ✅ Setup Email Service (Gmail OAuth2)
7. ✅ Create QR Code Verification
8. ✅ Build Admin Dashboard

---

## References

- **MongoDB Documentation:** https://docs.mongodb.com/
- **Motor (Async MongoDB):** https://motor.readthedocs.io/
- **Beanie ODM:** https://roman-right.github.io/beanie/
- **FastAPI:** https://fastapi.tiangolo.com/
- **Pydantic:** https://docs.pydantic.dev/

---

**Last Updated:** March 30, 2026  
**Status:** Phase 1 Complete ✓
