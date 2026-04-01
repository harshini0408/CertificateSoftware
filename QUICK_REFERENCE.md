# 🚀 Quick Reference Card - MongoDB Connection

## Copy & Paste Commands

### 1️⃣ Initial Setup (First Time Only)

```bash
# Navigate to backend
cd d:\Certificate-Software\backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
venv\Scripts\activate

# Install all dependencies
pip install -r requirements.txt

# Copy environment template
copy .env.example .env

# Generate secure SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 2️⃣ Every Development Session

```bash
# Navigate to backend
cd d:\Certificate-Software\backend

# Activate virtual environment
venv\Scripts\activate

# Start the application
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Open in browser: http://localhost:8000/docs
```

### 3️⃣ MongoDB Management

```bash
# Check MongoDB is running
tasklist | find /I "mongod"

# Start MongoDB (if not running)
net start MongoDB

# Stop MongoDB
net stop MongoDB

# Connect to MongoDB shell
mongosh

# In MongoDB shell:
show databases
use psgItech_certs
show collections
db.users.find()
exit
```

---

## 📋 Essential Endpoints

| Purpose | URL |
|---------|-----|
| Health Check | http://localhost:8000/health |
| API Docs | http://localhost:8000/docs |
| Alternative Docs | http://localhost:8000/redoc |
| API Root | http://localhost:8000/ |

---

## 🔧 .env File (Key Settings)

```env
# MUST CHANGE:
SECRET_KEY=<output from: python -c "import secrets; print(secrets.token_urlsafe(32))">
STORAGE_PATH=D:/Certificate-Software/storage

# OPTIONAL (already correct):
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=psgItech_certs
APP_ENV=development
```

---

## ✅ Success Indicators

```
✓ Application starts: "Uvicorn running on http://..."
✓ Database connects: "✓ MongoDB connected successfully"
✓ Health check works: http://localhost:8000/health returns JSON
✓ API docs load: http://localhost:8000/docs shows Swagger UI
✓ Collections exist: mongosh → show collections (10 results)
```

---

## 🐛 Quick Fixes

| Problem | Solution |
|---------|----------|
| "mongod not found" | Add MongoDB to PATH or restart terminal |
| "Port 27017 in use" | `netstat -ano \| findstr :27017` then `taskkill /PID <PID> /F` |
| "Can't import motor" | `pip install -r requirements.txt --force-reinstall` |
| ".env not loading" | Check file is `.env` not `.env.txt` in `backend/` folder |
| "Database not connected" | Ensure MongoDB service is running (`net start MongoDB`) |

---

## 📂 File Locations

```
Project Root: d:\Certificate-Software\
├── Backend: d:\Certificate-Software\backend\
│   ├── .env (YOUR CONFIG - git ignored)
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py (FastAPI app)
│   │   ├── database.py (MongoDB connection)
│   │   ├── config.py (Settings loader)
│   │   └── models/ (10 Beanie documents)
│   └── storage/
│       ├── certs/ (Generated certificates)
│       └── assets/ (Uploaded files)
└── Documentation:
    ├── README.md (Overview)
    ├── SETUP_GUIDE.md (Detailed setup)
    ├── DATABASE_CONNECTION_STEPS.md (Step-by-step)
    ├── ARCHITECTURE.md (System design)
    └── QUICK_REFERENCE.md (This file)
```

---

## 🎯 Phase 1 Status

| Component | Status | Details |
|-----------|--------|---------|
| Project Structure | ✅ | 50+ files created |
| MongoDB Connection | ✅ | Motor + Beanie ready |
| Models | ✅ | 10 documents defined |
| Configuration | ✅ | .env-based settings |
| FastAPI Setup | ✅ | Lifespan events ready |
| Documentation | ✅ | 5 comprehensive guides |

---

## 📞 Help!

### Step 1: Check Documentation
- **Setup issues?** → Read [SETUP_GUIDE.md](../SETUP_GUIDE.md)
- **Connection issues?** → Read [DATABASE_CONNECTION_STEPS.md](../DATABASE_CONNECTION_STEPS.md)
- **Architecture questions?** → Read [ARCHITECTURE.md](../ARCHITECTURE.md)
- **Overview?** → Read [README.md](../README.md)

### Step 2: Verify Services
```bash
# Check MongoDB
tasklist | find "mongod"

# Check Python version
python --version

# Check virtual environment
python -c "import sys; print(sys.prefix)"
```

### Step 3: View Logs
```bash
# Terminal output shows startup messages
# Check for "✓ MongoDB connected successfully"
# Check for any red error text
```

---

## 🔄 Daily Workflow

```
Morning:
1. Open terminal
2. cd backend
3. venv\Scripts\activate
4. python -m uvicorn app.main:app --reload

Work:
1. Make code changes (auto-reload handles it)
2. Test in browser: http://localhost:8000/docs
3. Check MongoDB: mongosh (in another terminal)

End of day:
1. Ctrl+C to stop application
2. Optional: net stop MongoDB (or leave running)
3. deactivate (exit virtual env)
```

---

## 🎓 Key Concepts

### Motor
- **What:** Async MongoDB driver
- **Why:** Non-blocking database calls
- **Benefit:** Handles 100+ concurrent users

### Beanie
- **What:** ODM (Object-Document Mapper)
- **Why:** Map Python classes to MongoDB documents
- **Benefit:** Type-safe, automatic validation

### FastAPI
- **What:** Modern web framework
- **Why:** Built for async, automatic docs
- **Benefit:** /docs endpoint, fast development

### Lifespan
- **What:** App startup/shutdown events
- **Why:** Connect DB on start, disconnect on stop
- **Benefit:** Clean resource management

---

## 🚀 You Are Ready!

Your database connection is complete and verified. You can now:

✅ Start the application  
✅ Access API documentation  
✅ Verify MongoDB collections  
✅ Begin Phase 2 development  

**Happy coding!** 🎉

---

**Quick Links:**
- [Full Setup Guide](../SETUP_GUIDE.md)
- [Step-by-Step Connection](../DATABASE_CONNECTION_STEPS.md)
- [System Architecture](../ARCHITECTURE.md)
- [Main README](../README.md)

---

**Status:** Phase 1 Complete ✓  
**Last Updated:** March 30, 2026  
**Ready for:** Phase 2 Development
