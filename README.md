# PSG iTech Activity Points Management Software — Deployment & Overview

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
uvicorn app.main:app --reload --port 8000
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

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

2. Build images:

```bash
docker compose build
```

3. Start all services:

```bash
docker compose up -d
```

4. View status/logs:

```bash
docker compose ps
docker compose logs -f
```

5. Stop services:

```bash
docker compose down
```

To also remove volumes (destructive to DB data):

```bash
docker compose down -v
```

## 3. Production Deployment (Ubuntu + Host Nginx)

1. Install Docker Engine + Docker Compose plugin.
2. Clone repository to server, e.g. `/opt/certificate-software`.
3. Create production env:

```bash
cp .env.example .env
```

4. Set secure values in `.env`:
- `SECRET_KEY`
- SMTP credentials
- `SUPERADMIN_PASSWORD`
- domain values (`FRONTEND_URL`, `ALLOWED_ORIGINS`, `BASE_URL`)

5. Start containers:

```bash
docker compose up -d --build
```

6. Configure host Nginx with:
- `deploy/nginx.project-name.conf`

7. Reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 4. Updating After Code Changes

```bash
git pull
docker compose build
docker compose up -d
```

For a single service:

```bash
docker compose build frontend
docker compose up -d frontend
```

## 5. Environment Variables

### Root `.env`
Used by Docker Compose for backend runtime and frontend build arguments.

### `backend/.env.example`
Documents backend app variables for direct backend execution.

### `frontend/.env.example`
Documents Vite build/dev variables:
- `VITE_BASE_PATH` should be `/project-name/` in production.
- `VITE_API_URL` should be `/project-name/api`.
- `VITE_BACKEND_BASE_URL` should be `/project-name`.

## 6. Networking Notes

- Containers communicate over the Compose network using service names.
- Backend Mongo URI uses `mongodb` service hostname.
- Frontend does not call `localhost` directly; it uses configurable base URLs.
- Exposed ports are bound to `127.0.0.1` so host Nginx can proxy safely.

## 7. Troubleshooting

### Containers not starting
```bash
docker compose logs --tail=200
```

### Backend cannot connect to MongoDB
- Verify `MONGODB_URL=mongodb://mongodb:27017` in `.env`.
- Verify Mongo health:

```bash
docker compose ps
```

### Frontend path issues under `/project-name`
- Ensure `.env` contains:
  - `VITE_BASE_PATH=/project-name/`
  - `VITE_API_URL=/project-name/api`
  - `VITE_BACKEND_BASE_URL=/project-name`
- Rebuild frontend image:

```bash
docker compose build frontend
docker compose up -d frontend
```

### CORS errors
- Set `ALLOWED_ORIGINS` to your public origin (comma-separated for multiple).
- Restart backend container after env changes.

## 8. Security Checklist

- `.env` is ignored by git.
- Do not commit secrets.
- Change default `SUPERADMIN_PASSWORD` and `SECRET_KEY` in production.
- Keep Docker images updated (`docker compose build --pull`).
