# PSG iTech Activity Points Management Software — Frontend

React + Vite single-page application for PSG Institute of Technology and Applied Research Activity Points Management and Certificate Platform.

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup

```bash
# 1. Install dependencies
cd frontend
npm install

# 2. Configure environment
copy .env.example .env        # Windows
# cp .env.example .env        # Linux/Mac

# 3. Start local development server
npm run dev
```

### Production Build

```bash
npm run build
```

## Architecture & Dashboards

```
frontend/src/
├── components/          # Reusable UI components (Navbar, Sidebar, DataTable, StatCard, etc.)
├── dashboards/
│   ├── auth/            # Login, password reset, OTP verification
│   ├── club/            # Club Coordinator dashboard, event creation, QR generation, certificate issuance
│   ├── student/         # Student dashboard, activity credits, certificate wallet, QR scanner, 1-time reg no update
│   ├── tutor/           # Tutor dashboard, student monitoring, credit verification, reg no edit (max 2 times)
│   ├── dept/            # Department Coordinator dashboard, department certificates, student credits
│   ├── hod/             # HOD dashboard, departmental event analytics, credit oversight
│   ├── principal/       # Principal dashboard, college-wide KPIs and event statistics
│   ├── student_affairs/ # Student Affairs dashboard, club event oversight, report approval
│   ├── superadmin/      # Super Admin dashboard, semester reset, user management, credit rules
│   └── guest/           # Self-service 5-step certificate generation wizard
├── store/               # Zustand state stores (authStore, uiStore)
└── utils/               # Axios instance, query client, helper utilities
```

## Key Features
- **Software Branding**: PSG iTech Activity Points Management Software.
- **Club Event Workflow**: Mandatory event report upload before certificate generation can be triggered.
- **Student Profile Management**: One-time update of temporary register numbers (e.g. `T24Z108`) to official 12-digit university registration numbers.
- **Tutor Student Management**: Mapped tutors can edit assigned student register numbers up to 2 times.
- **Credit Resets**: Superadmin-controlled semester roll-overs with full historical archive preservation.
