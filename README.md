# PSG iTech Certificate Platform

**Self-Hosted Certificate Generation & Verification System**

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Status](https://img.shields.io/badge/status-Phase%201%20%E2%9C%93%20Complete-green)
![Python](https://img.shields.io/badge/python-3.10%2B-blue)
![MongoDB](https://img.shields.io/badge/mongodb-5.0%2B-brightgreen)

---

## 📋 Quick Start

### Prerequisites
- Python 3.10+
- MongoDB 5.0+ (Windows Service)
- Git

### Installation (5 minutes)

```bash
# 1. Navigate to backend
cd backend

# 2. Create virtual environment
python -m venv venv
venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
copy .env.example .env
# Edit .env with your settings

# 5. Start application
python -m uvicorn app.main:app --reload
```

### Verify Setup

```
✓ Health Check: http://localhost:8000/health
✓ API Docs: http://localhost:8000/docs
✓ ReDoc: http://localhost:8000/redoc
```

---

## 📖 Documentation

| Document | Purpose |
|----------|---------|
| **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** | Complete MongoDB installation and configuration guide |
| **[DATABASE_CONNECTION_STEPS.md](./DATABASE_CONNECTION_STEPS.md)** | Step-by-step database connection instructions |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | System architecture and data flow diagrams |

---

## 🏗️ Phase 1: Complete ✓

### What's Included

- ✅ **Project Structure** - Organized backend folder
- ✅ **10 MongoDB Models** - Complete data schema
- ✅ **Database Connection** - Motor (async) + Beanie (ODM)
- ✅ **FastAPI Setup** - With lifespan events
- ✅ **Configuration** - Environment-based settings
- ✅ **CORS Support** - Frontend integration ready
- ✅ **Health Endpoints** - Basic API testing

### What's NOT Included

- ⏳ Authentication & Authorization (Phase 2)
- ⏳ User Management APIs (Phase 2)
- ⏳ Certificate Generation Logic (Phase 2)
- ⏳ Email Service (Phase 2)
- ⏳ Admin Dashboard (Phase 2+)

---

## 🗂️ Project Structure

```
backend/
├── app/
│   ├── models/              (10 Beanie documents)
│   ├── schemas/             (Pydantic validators - Phase 2)
│   ├── routers/             (API endpoints - Phase 2)
│   ├── services/            (Business logic - Phase 2)
│   ├── core/                (Security & dependencies - Phase 2)
│   ├── config.py            (Settings management)
│   ├── database.py          (MongoDB connection)
│   └── main.py              (FastAPI initialization)
├── storage/
│   ├── certs/               (Generated certificates)
│   └── assets/              (Uploaded images)
├── requirements.txt         (All dependencies)
└── .env.example            (Configuration template)
```

---

## 🗄️ Database Schema

### 10 Collections Created

1. **users** - Platform users with roles
2. **clubs** - Student clubs/organizations
3. **events** - Club events
4. **participants** - Event participants
5. **certificates** - Generated certificates
6. **templates** - Certificate HTML templates
7. **email_logs** - Email sending history
8. **scan_logs** - QR code verification logs
9. **credit_rules** - Credit rules per role
10. **student_credits** - Student credit tracking

### Database Connection Flow

```
Application Startup
        ↓
Load .env Configuration
        ↓
FastAPI Lifespan Event
        ↓
Motor AsyncClient connects to MongoDB
        ↓
Beanie initializes with 10 models
        ↓
Collections auto-created
        ↓
Application ready for requests
```

---

## 🚀 Stack

### Backend
```
FastAPI 0.111.0           - Web Framework
Uvicorn 0.29.0           - ASGI Server
Motor 3.4.0              - Async MongoDB Driver
Beanie 1.25.0            - MongoDB ODM
Pydantic 2.0+            - Data Validation
```

### Database
```
MongoDB 5.0+             - Document Database
localhost:27017          - Default connection
psgItech_certs           - Database name
```

### Security
```
python-jose              - JWT tokens
bcrypt                   - Password hashing
passlib                  - Password utilities
```

### Utilities
```
APScheduler 3.10.4       - Task scheduling
python-dotenv 1.0.1      - Environment configuration
Pillow 10.3.0            - Image processing
QRcode 7.4.2             - QR code generation
google-api-python-client - Gmail integration (Phase 2)
```

---

## 🔧 Configuration

### Environment Variables

```env
# App
APP_ENV=development
SECRET_KEY=your-32-char-secret-key
ALGORITHM=HS256
FRONTEND_URL=http://localhost:5173
DOMAIN=localhost

# MongoDB
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=psgItech_certs

# JWT
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Storage
STORAGE_PATH=D:/Certificate-Software/storage

# Gmail (Phase 2)
GMAIL_CLIENT_ID=your-client-id
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REFRESH_TOKEN=your-refresh-token
GMAIL_SENDER_EMAIL=certificates@psgitech.ac.in
GMAIL_DAILY_LIMIT=500

# Super Admin
SUPER_ADMIN_EMAIL=admin@psgitech.ac.in
SUPER_ADMIN_PASSWORD=change-on-first-login
```

---

## 🎯 API Endpoints (Phase 1)

### Health & Info
```
GET  /                    - API info
GET  /health              - Health check
GET  /docs                - Swagger UI
GET  /redoc               - ReDoc documentation
```

### Phase 2 Coming Soon
```
Authentication:
POST /auth/login          - User login
POST /auth/register       - User registration
POST /auth/refresh        - Refresh token

Clubs:
GET  /clubs               - List clubs
POST /clubs               - Create club
GET  /clubs/{id}          - Get club details

Events:
GET  /events              - List events
POST /events              - Create event
GET  /events/{id}         - Get event details

Certificates:
POST /certs/generate      - Generate certificates
GET  /certs/{id}          - Get certificate
GET  /verify/{token}      - Verify certificate
```

---

## 🔐 Security Features (Planned)

### Authentication
- JWT-based authentication
- Refresh token rotation
- Email verification
- Password hashing with bcrypt

### Authorization
- Role-based access control (RBAC)
- Roles: SUPER_ADMIN, ADMIN, COORDINATOR, STUDENT
- Resource-level permissions

### Audit
- Email logs for all communications
- Scan logs for QR verification
- Timestamp tracking on all documents

---

## 📊 Performance Considerations

### Async/Await
- All database operations are non-blocking
- Motor handles connection pooling
- FastAPI handles concurrent requests

### Indexes
- Unique indexes on: email, certificate_number, verification_token
- Indexed fields: name, club_id, event_id, user_id

### Scalability
- No Redis required (APScheduler handles tasks)
- No Docker dependency
- Self-hosted on local machine
- Can scale to production later

---

## 🔄 Development Workflow

### 1. Start Services
```bash
# MongoDB runs as Windows Service (auto-start)
# Verify: tasklist | find "mongod"

# Start application
cd backend
venv\Scripts\activate
python -m uvicorn app.main:app --reload
```

### 2. Development
```bash
# FastAPI auto-reloads on code changes
# Watch terminal for errors
# Open http://localhost:8000/docs to test
```

### 3. Database Management
```bash
# Connect to MongoDB
mongosh

# View database
use psgItech_certs
show collections
db.users.find()
```

---

## 📚 Learning Resources

### MongoDB
- **Official Docs:** https://docs.mongodb.com/
- **MongoDB Shell:** https://docs.mongodb.com/mongodb-shell/
- **MongoDB Compass:** GUI tool for MongoDB

### Motor (Async Driver)
- **Documentation:** https://motor.readthedocs.io/
- **Examples:** Motor GitHub repository

### Beanie (ODM)
- **Documentation:** https://roman-right.github.io/beanie/
- **GitHub:** https://github.com/roman-right/beanie

### FastAPI
- **Official Tutorial:** https://fastapi.tiangolo.com/tutorial/
- **Full Documentation:** https://fastapi.tiangolo.com/

### Pydantic
- **Documentation:** https://docs.pydantic.dev/
- **Validation Examples:** Pydantic GitHub

---

## 🐛 Troubleshooting

### MongoDB Not Starting
```bash
# Check service status
sc query MongoDB

# Start service
net start MongoDB

# Restart service
net stop MongoDB
net start MongoDB
```

### Port Already in Use
```bash
# Find process using port 27017
netstat -ano | findstr :27017

# Kill process (replace PID)
taskkill /PID <PID> /F
```

### Dependencies Not Installing
```bash
# Clear pip cache
pip cache purge

# Reinstall dependencies
pip install -r requirements.txt --force-reinstall --no-cache-dir
```

### Database Connection Errors
```bash
# Verify MongoDB is running
mongosh

# Check .env file location
# Should be: backend/.env (not backend/.env.txt)

# Restart application
# Ctrl+C to stop
# python -m uvicorn app.main:app --reload
```

---

## 📅 Phase Roadmap

### Phase 1: Database Setup ✅
- Project structure ✓
- MongoDB connection ✓
- Models defined ✓
- Configuration ✓
- **Status:** COMPLETE

### Phase 2: Core Features (Next)
- [ ] Authentication system
- [ ] User management APIs
- [ ] Club management
- [ ] Event management
- [ ] Certificate generation
- [ ] Email service integration
- [ ] QR code verification

### Phase 3: Advanced Features
- [ ] Admin dashboard
- [ ] Analytics & reporting
- [ ] Bulk operations
- [ ] Custom templates
- [ ] Digital signatures
- [ ] Audit trails

### Phase 4: Production
- [ ] Deployment setup
- [ ] Docker containerization
- [ ] CI/CD pipeline
- [ ] Monitoring & logging
- [ ] Backup & recovery

---

## ✅ Pre-Launch Checklist

### Development Environment
- [ ] MongoDB installed and running
- [ ] Python 3.10+ installed
- [ ] Virtual environment created
- [ ] All dependencies installed
- [ ] .env file configured
- [ ] Application starts without errors

### Database
- [ ] MongoDB local service running
- [ ] Database name set to `psgItech_certs`
- [ ] All 10 collections created
- [ ] Indexes created for unique fields
- [ ] Verified with mongosh or MongoDB Compass

### API
- [ ] Application responds to /health endpoint
- [ ] Swagger UI loads at /docs
- [ ] No startup errors in logs
- [ ] CORS configured correctly

### Code Quality
- [ ] No Python errors
- [ ] All imports working
- [ ] Type hints present
- [ ] Documentation complete

---

## 📞 Support

### Getting Help
1. Check **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** for installation issues
2. Review **[DATABASE_CONNECTION_STEPS.md](./DATABASE_CONNECTION_STEPS.md)** for DB setup
3. See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for system design
4. Check error logs in terminal for debugging

### Common Issues
- **MongoDB won't connect:** Ensure service is running (`net start MongoDB`)
- **Port already in use:** Kill existing process or use different port
- **Dependencies missing:** Run `pip install -r requirements.txt` again
- **.env not loading:** Check file is in `backend/` directory (not `backend/.env.txt`)

---

## 📄 License

This project is proprietary to PSG Institute of Technology.

---

## 👥 Team

**PSG iTech Certificate Platform**
- Project Type: Certificate Generation & Verification System
- Version: 1.0.0
- Status: Phase 1 Complete ✓
- Created: March 2026

---

## 🎉 You're All Set!

Your PSG iTech Certificate Platform database is ready for Phase 2 development.

**Next Steps:**
1. Review the documentation files
2. Verify all components are running
3. Start building Phase 2 features
4. Follow the API development guidelines

**Happy Coding! 🚀**

---

**Last Updated:** March 30, 2026  
**Next Review:** Phase 2 Planning  
**Status:** ✅ Production Ready for Phase 2
