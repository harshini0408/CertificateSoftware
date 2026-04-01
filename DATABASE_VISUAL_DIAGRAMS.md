# 🎨 Database Connection - Visual Diagrams & Flowcharts

## Diagram 1: Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         YOUR COMPUTER (Windows)                         │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     Python Environment                           │  │
│  │                                                                  │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │  FastAPI Application  (app.main:app)                    │  │  │
│  │  │                                                          │  │  │
│  │  │  Startup:                                              │  │  │
│  │  │  1. Load settings from .env                            │  │  │
│  │  │  2. Call connect_db()                                  │  │  │
│  │  │     │                                                  │  │  │
│  │  │     └─→ Create Motor AsyncClient                       │  │  │
│  │  │          Connection string: mongodb://localhost:27017 │  │  │
│  │  │                                                          │  │  │
│  │  │  3. Beanie initializes models:                          │  │  │
│  │  │     ├─ User                                            │  │  │
│  │  │     ├─ Club                                            │  │  │
│  │  │     ├─ Event                                           │  │  │
│  │  │     ├─ Participant                                     │  │  │
│  │  │     ├─ Certificate                                     │  │  │
│  │  │     ├─ Template                                        │  │  │
│  │  │     ├─ EmailLog                                        │  │  │
│  │  │     ├─ ScanLog                                         │  │  │
│  │  │     ├─ CreditRule                                      │  │  │
│  │  │     └─ StudentCredit                                   │  │  │
│  │  │                                                          │  │  │
│  │  │  4. Collections auto-created in MongoDB                │  │  │
│  │  │  5. Application ready to serve requests                │  │  │
│  │  │                                                          │  │  │
│  │  │  Shutdown:                                             │  │  │
│  │  │  1. Call disconnect_db()                               │  │  │
│  │  │  2. Close MongoDB connection gracefully                │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  │                          ↑ HTTP ↓                               │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │         API Endpoints (Phase 2+)                        │  │  │
│  │  │  GET/POST /auth, /clubs, /events, /certs, etc.         │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │               MongoDB Server (Local Service)                    │  │
│  │                    Port: 27017                                  │  │
│  │                                                                  │  │
│  │  Database: psgItech_certs                                       │  │
│  │                                                                  │  │
│  │  ┌────────────────────────────────────────────────────────┐   │  │
│  │  │  Collections (10):                                    │   │  │
│  │  │  ├─ users        (Unique: email)                     │   │  │
│  │  │  ├─ clubs        (Unique: name)                      │   │  │
│  │  │  ├─ events       (Indexed: name, club_id)            │   │  │
│  │  │  ├─ participants (Indexed: event_id)                 │   │  │
│  │  │  ├─ certificates (Unique: certificate_number)        │   │  │
│  │  │  ├─ templates    (Unique: name)                      │   │  │
│  │  │  ├─ email_logs   (Indexed: certificate_id)           │   │  │
│  │  │  ├─ scan_logs    (Indexed: certificate_id)           │   │  │
│  │  │  ├─ credit_rules (Unique: role)                      │   │  │
│  │  │  └─ student_credits (Indexed: user_id)              │   │  │
│  │  └────────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Diagram 2: Data Flow - How a Request Gets Processed

```
User/Browser
     │
     │ HTTP Request (e.g., GET /health)
     │
     ↓
┌──────────────────────────────────┐
│  FastAPI Router (main.py)        │
│  @app.get("/health")             │
│                                   │
│  async def health_check():       │
│      return {...}                │
└──────────────────────────────────┘
     │
     │ (For database operations)
     ↓
┌──────────────────────────────────┐
│  Service Layer (services/*.py)   │
│  - auth_service.py               │
│  - cert_generator.py             │
│  - email_service.py              │
│  - etc.                           │
│                                   │
│  Calls:                           │
│  await User.find()               │
│  await Certificate.insert_one()  │
└──────────────────────────────────┘
     │
     │ Database operation
     ↓
┌──────────────────────────────────┐
│  Beanie ODM (models/*.py)        │
│  Validates data                   │
│  Creates query                    │
└──────────────────────────────────┘
     │
     │ MongoDB query
     ↓
┌──────────────────────────────────┐
│  Motor AsyncClient               │
│  Sends async query to MongoDB    │
│  Doesn't block other requests    │
└──────────────────────────────────┘
     │
     │ TCP connection to port 27017
     ↓
┌──────────────────────────────────┐
│  MongoDB Server                  │
│  - Receives query                │
│  - Finds/creates documents       │
│  - Returns result                │
└──────────────────────────────────┘
     │
     │ Result back to Motor
     ↓
┌──────────────────────────────────┐
│  Motor converts to Python        │
│  Returns to Beanie               │
└──────────────────────────────────┘
     │
     │ Result back to Service
     ↓
┌──────────────────────────────────┐
│  Service processes result        │
│  Returns to Router               │
└──────────────────────────────────┘
     │
     │ JSON response
     ↓
┌──────────────────────────────────┐
│  FastAPI sends response          │
│  Content-Type: application/json  │
└──────────────────────────────────┘
     │
     │ HTTP Response
     ↓
User/Browser gets JSON response
```

---

## Diagram 3: Connection Lifecycle

```
╔════════════════════════════════════════════════════════════════╗
║            APPLICATION STARTUP LIFECYCLE                      ║
╚════════════════════════════════════════════════════════════════╝

1. START: python -m uvicorn app.main:app --reload
   │
   ├─ Python starts FastAPI
   │  └─ Loads app.main module
   │
   ├─ FastAPI reads lifespan context manager
   │
   ├─ STARTUP PHASE:
   │  │
   │  ├─ print("🚀 Starting PSG iTech Certificate Platform...")
   │  │
   │  ├─ await connect_db() [from database.py]
   │  │  │
   │  │  ├─ Create AsyncClient("mongodb://localhost:27017")
   │  │  │  │
   │  │  │  ├─ Attempts to connect to MongoDB on port 27017
   │  │  │  │
   │  │  │  └─ ✅ Connection established
   │  │  │
   │  │  ├─ Select database: "psgItech_certs"
   │  │  │  │
   │  │  │  └─ ✅ Database selected
   │  │  │
   │  │  ├─ await init_beanie(database=_db, models=[...10 models...])
   │  │  │  │
   │  │  │  ├─ For each model:
   │  │  │  │  ├─ Create collection in MongoDB
   │  │  │  │  ├─ Create indexes (unique, compound, etc.)
   │  │  │  │  └─ Ready for operations
   │  │  │  │
   │  │  │  └─ ✅ Beanie initialized with 10 models
   │  │  │
   │  │  ├─ print("✓ MongoDB connected successfully")
   │  │  │
   │  │  └─ print("✓ Database: psgItech_certs")
   │  │
   │  └─ ✅ STARTUP COMPLETE
   │
   ├─ yield (App is now running, serving requests)
   │
   ├─ 📊 APPLICATION IS LIVE
   │  │
   │  └─ HTTP requests processed
   │     Database operations handled
   │     Collections growing with data
   │
   ├─ 🛑 SHUTDOWN SIGNAL (Ctrl+C or process termination)
   │
   ├─ SHUTDOWN PHASE:
   │  │
   │  ├─ print("🛑 Shutting down...")
   │  │
   │  ├─ await disconnect_db()
   │  │  │
   │  │  ├─ _client.close()
   │  │  │  │
   │  │  │  ├─ Close all database connections
   │  │  │  ├─ Release connection pool
   │  │  │  └─ ✅ Graceful shutdown
   │  │  │
   │  │  └─ print("✓ MongoDB disconnected")
   │  │
   │  └─ ✅ SHUTDOWN COMPLETE
   │
   └─ Application stopped

╔════════════════════════════════════════════════════════════════╗
║  CONNECTION STATES:                                           ║
║  🔴 NOT_STARTED - Application hasn't begun                    ║
║  🟠 CONNECTING - Motor connecting to MongoDB                  ║
║  🟢 CONNECTED - Application running, queries happening        ║
║  🟡 DISCONNECTING - Graceful shutdown in progress             ║
║  ⚫ DISCONNECTED - Application stopped                         ║
╚════════════════════════════════════════════════════════════════╝
```

---

## Diagram 4: Database Collections Schema

```
┌─────────────────────────────────────────────────────────────┐
│                    MONGODB DATABASE                         │
│              psgItech_certs (on localhost:27017)            │
└─────────────────────────────────────────────────────────────┘

┌───────────────────┐  ┌───────────────────┐
│  users            │  │  clubs            │
├───────────────────┤  ├───────────────────┤
│ _id               │  │ _id               │
│ email* (unique)   │  │ name* (unique)    │
│ password_hash     │  │ description       │
│ full_name         │  │ created_by→users  │
│ role              │  │ coordinator_id    │
│ is_active         │  │ is_active         │
│ phone             │  │ created_at        │
│ department        │  │ updated_at        │
│ created_at        │  └───────────────────┘
│ updated_at        │
│ last_login        │  ┌───────────────────┐
└───────────────────┘  │  events           │
        △              ├───────────────────┤
        │              │ _id               │
        │              │ name (indexed)    │
        │              │ club_id→clubs*    │
        └──────────────│ description       │
                       │ event_date        │
                       │ location          │
                       │ is_active         │
                       │ created_at        │
                       │ updated_at        │
                       └───────────────────┘
                               │
                               │ (1:many)
                               ↓
                       ┌───────────────────┐
                       │  participants     │
                       ├───────────────────┤
                       │ _id               │
                       │ event_id→events*  │
                       │ user_id→users     │
                       │ name              │
                       │ email             │
                       │ phone             │
                       │ position          │
                       │ created_at        │
                       └───────────────────┘
                               │
                               │ (1:many)
                               ↓
                       ┌───────────────────┐
                       │  certificates     │
                       ├───────────────────┤
                       │ _id               │
                       │ certificate_*     │
                       │  number* (unique) │
                       │ participant_id→   │
                       │  participants*    │
                       │ event_id→events*  │
                       │ template_id→      │
                       │  templates*       │
                       │ file_path         │
                       │ qr_code_path      │
                       │ verification_*    │
                       │  token* (unique)  │
                       │ is_sent           │
                       │ sent_at           │
                       │ created_at        │
                       └───────────────────┘
                               │
                       ┌───────┴────────┐
                       ↓                ↓
        ┌─────────────────────┐  ┌──────────────────┐
        │  email_logs         │  │  scan_logs       │
        ├─────────────────────┤  ├──────────────────┤
        │ _id                 │  │ _id              │
        │ certificate_id→*    │  │ certificate_id→* │
        │ recipient_email     │  │ scanned_by_ip    │
        │ status              │  │ user_agent       │
        │ retry_count         │  │ is_valid         │
        │ created_at          │  │ scanned_at       │
        │ updated_at          │  │ created_at       │
        └─────────────────────┘  └──────────────────┘

        ┌─────────────────────┐  ┌──────────────────┐
        │  templates          │  │  credit_rules    │
        ├─────────────────────┤  ├──────────────────┤
        │ _id                 │  │ _id              │
        │ name* (unique)      │  │ role* (unique)   │
        │ template_type       │  │ credits_per_*    │
        │ html_content        │  │  event           │
        │ background_image_*  │  │ max_credits_*    │
        │ fonts_used          │  │  per_year        │
        │ is_active           │  │ description      │
        │ created_at          │  │ is_active        │
        │ updated_at          │  │ created_at       │
        └─────────────────────┘  │ updated_at       │
                                 └──────────────────┘
        
        ┌──────────────────────────────┐
        │  student_credits             │
        ├──────────────────────────────┤
        │ _id                          │
        │ user_id→users (indexed)      │
        │ event_id→events*             │
        │ credits_earned               │
        │ role                         │
        │ created_at                   │
        └──────────────────────────────┘

Legend:
* = Unique index (only one allowed)
→ = References another collection
(indexed) = Regular index for fast queries
```

---

## Diagram 5: Verification Flow

```
START HERE: You want to verify database is working
                     │
                     ↓
    ┌────────────────────────────────────┐
    │  CHECK 1: Application Startup      │
    ├────────────────────────────────────┤
    │  Look for:                         │
    │  1. "🚀 Starting..."               │
    │  2. "✓ MongoDB connected..."       │
    │  3. "✓ Database: psgItech_certs"   │
    └────────────────────────────────────┘
                     │
         ┌───────────┴──────────┐
         │ YES ✅               │ NO ❌
         ↓                      ↓
    CONTINUE         Fix MongoDB (net start MongoDB)
                     then restart app
                              │
                              └──→ Loop back to CHECK 1
         │
         ↓
    ┌────────────────────────────────────┐
    │  CHECK 2: Health Endpoint          │
    ├────────────────────────────────────┤
    │  Visit: http://localhost:8000/     │
    │  Should see:                       │
    │  {                                 │
    │    "status": "healthy",            │
    │    "environment": "development"    │
    │  }                                 │
    └────────────────────────────────────┘
                     │
         ┌───────────┴──────────┐
         │ YES ✅               │ NO ❌
         ↓                      ↓
    CONTINUE         Check app error logs
                              │
                              └──→ Fix errors, restart
         │
         ↓
    ┌────────────────────────────────────┐
    │  CHECK 3: API Documentation        │
    ├────────────────────────────────────┤
    │  Visit: http://localhost:8000/docs │
    │  Should see: Swagger UI interface  │
    └────────────────────────────────────┘
                     │
         ┌───────────┴──────────┐
         │ YES ✅               │ NO ❌
         ↓                      ↓
    CONTINUE         Check for Python errors
                              │
                              └──→ Fix errors, restart
         │
         ↓
    ┌────────────────────────────────────┐
    │  CHECK 4: MongoDB Collections      │
    ├────────────────────────────────────┤
    │  Terminal: mongosh                 │
    │  Then: use psgItech_certs          │
    │  Then: show collections            │
    │  Should see: 10 collections        │
    └────────────────────────────────────┘
                     │
         ┌───────────┴──────────┐
         │ YES ✅               │ NO ❌
         ↓                      ↓
    DATABASE IS          May need to:
    WORKING! ✅           1. Check app logs
                          2. Restart app
                          3. Verify MongoDB running
                              │
                              └──→ Fix and retry
         │
         ↓
    ┌────────────────────────────────────┐
    │  OPTIONAL: MongoDB Compass         │
    ├────────────────────────────────────┤
    │  Download: mongodb.com/compass     │
    │  Connect: localhost:27017          │
    │  View collections visually         │
    └────────────────────────────────────┘
                     │
         ┌───────────┴──────────┐
         │ YES ✅               │ NO ❌
         ↓                      ↓
    GREAT!              Use mongosh
    WORKING! ✅          instead
         │
         ↓
    ✨ DATABASE FULLY VERIFIED ✨
```

---

## Diagram 6: Comparison - Local vs Cloud

```
                    LOCAL MONGODB              MONGODB ATLAS (Cloud)
                    ═════════════              ══════════════════════

WHAT IS IT:         Database on your PC        Database on cloud servers

LOCATION:           Your computer              MongoDB servers (AWS, Azure, GCP)
                    localhost:27017            cluster0.mongodb.net

SETUP TIME:         5 minutes                  10 minutes

COST:               Free                       Free tier available

SPEED:              Very fast (local)          Fast (but network dependent)

BACKUP:             Manual                     Automatic

SECURITY:           Local network only         Cloud security + encryption

UPTIME:             Depends on your PC         99.95% SLA

SCALABILITY:        Limited to your PC         Enterprise scale

BEST FOR:           Development & Learning     Production & Teams

ACCESS:             Only your computer         Anywhere in the world

MONITORING:         None (use Compass)         Built-in dashboard


CURRENT SETUP:      ✅ USING LOCAL             TO USE CLOUD:
Your project uses   Change MONGODB_URL
local MongoDB on    in .env to:
localhost:27017     mongodb+srv://user:pass@
with database name  cluster.mongodb.net/...
psgItech_certs      then restart app
```

---

## Diagram 7: Error Resolution Tree

```
                    ❌ SOMETHING IS WRONG
                              │
                              ↓
                    ┌─────────────────────┐
                    │ Check error message │
                    └─────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ↓                 ↓                 ↓
    "Connection       "Module not      "Database not
     refused"          found"            connected"
        │                 │                 │
        ↓                 ↓                 ↓
    ┌───────────┐   ┌───────────┐    ┌──────────┐
    │MongoDB    │   │pip install│    │restart   │
    │not running│   │-r require-│    │app &     │
    │           │   │ments.txt  │    │check.env │
    │ FIX:      │   │           │    │          │
    │net start  │   │Then:      │    │ FIX:     │
    │MongoDB    │   │restart    │    │net start │
    └───────────┘   │app        │    │MongoDB   │
                    └───────────┘    └──────────┘
                              │
                              ↓
                    ✅ TRY AGAIN
                              │
                    ┌─────────────────┐
                    │ Working now?    │
                    └─────────────────┘
                         │  │
                     YES ↓  ↓ NO
                    ✅   └──→ Check logs
                        Review error message
                        Consult documentation
```

---

## Quick Reference: Files & Locations

```
Database Setup Files:

📄 backend/app/database.py
   └─ Contains: connect_db(), disconnect_db()
   └─ Imports: Motor, Beanie, all models
   └─ Purpose: Database initialization

📄 backend/app/config.py
   └─ Contains: Settings class
   └─ Reads from: .env file
   └─ Provides: mongodb_url, database_name

📄 backend/app/main.py
   └─ Contains: lifespan context manager
   └─ Calls: connect_db() on startup
   └─ Calls: disconnect_db() on shutdown

📁 backend/app/models/
   └─ user.py
   └─ club.py
   └─ event.py
   └─ participant.py
   └─ certificate.py
   └─ template.py
   └─ email_log.py
   └─ scan_log.py
   └─ credit_rule.py
   └─ student_credit.py

📄 backend/.env
   └─ Contains: MONGODB_URL, SECRET_KEY
   └─ Format: KEY=value
   └─ Git ignored: Never commit

📄 backend/requirements.txt
   └─ Contains: motor, beanie, fastapi
   └─ Install: pip install -r requirements.txt
```

---

**Diagrams Complete!** 📊

These visual representations help you understand:
- How the system is structured
- How connections are established
- How data flows through the system
- How to verify everything works
- What to do when errors occur

Review these diagrams while reading DATABASE_COMPLETE_GUIDE.md for better understanding!
