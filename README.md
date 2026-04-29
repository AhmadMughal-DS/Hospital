# 🏥 MediCore HMS — Hospital Management System

[![CI/CD Pipeline](https://github.com/AhmadMughal-DS/Hospital/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/AhmadMughal-DS/Hospital/actions/workflows/ci-cd.yml)
![Python](https://img.shields.io/badge/Python-3.12-blue?logo=python)
![Django](https://img.shields.io/badge/Django-5.1-green?logo=django)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)

A **fully integrated, production-grade Hospital Management System** built with Django REST Framework + React (Vite). Supports 4 user roles with a shared patient record ecosystem, real-time queue, video consultations, pharmacy, billing, and automated CI/CD.

---

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Quick Start (Local Dev)](#quick-start-local-dev)
- [Docker Deployment](#docker-deployment)
- [CI/CD Pipeline](#cicd-pipeline)
- [GitHub Secrets](#github-secrets-required)
- [API Overview](#api-overview)

---

## ✨ Features

### 👤 Patient
- Book appointments (In-Person / TeleHealth)
- View & edit full profile (blood group, allergies, insurance)
- Real-time video consultation via Jitsi
- Download invoice PDF
- View medical history timeline
- Rate doctors after completed visits
- Cancel appointments
- In-app notification bell

### 🩺 Doctor
- Today's patient queue (auto-refreshed)
- Write prescriptions with drug lookup
- Update diagnosis, notes, follow-up
- View full patient records (360° view)
- TeleHealth video call
- In-app notifications

### 💊 Pharmacist
- View pending prescriptions
- Dispense medicines with stock tracking
- Low-stock alerts
- Drug inventory management

### 🔧 Admin
- Doctor management (add, edit, remove)
- Full patient list with record viewer
- Appointment management & status updates
- Billing & revenue dashboard (6-month trend chart)
- Pharmacy inventory control
- OPD & X-Ray module
- Live queue management

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Django 5.1, Django REST Framework, SimpleJWT |
| **Database** | PostgreSQL 16 |
| **Frontend** | React 18, Vite, Tailwind CSS |
| **Video Calls** | Jitsi Meet (WebRTC) |
| **Payments** | Stripe |
| **PDF** | ReportLab |
| **Server** | Gunicorn + Nginx |
| **Containers** | Docker + Docker Compose |
| **CI/CD** | GitHub Actions |

---

## 🏛 Architecture

```
┌─────────────────────────────────────────────────┐
│                  GitHub Actions                  │
│  Lint → Build/Test → Push DockerHub → Deploy VM │
└─────────────────────────────────────────────────┘
                        │
              ┌─────────▼─────────┐
              │   Production VM   │
              │                   │
              │  ┌─────────────┐  │
              │  │   Nginx:80  │  │  ← React SPA
              │  └──────┬──────┘  │
              │         │         │
              │  ┌──────▼──────┐  │
              │  │ Gunicorn:   │  │  ← Django API
              │  │   8000      │  │
              │  └──────┬──────┘  │
              │         │         │
              │  ┌──────▼──────┐  │
              │  │ PostgreSQL  │  │  ← Database
              │  │    5432     │  │
              │  └─────────────┘  │
              └───────────────────┘
```

---

## 🚀 Quick Start (Local Dev)

### Prerequisites
- Docker + Docker Compose
- Python 3.12+ (optional, for local backend dev)
- Node 20+ (optional, for local frontend dev)

### 1. Clone the repo
```bash
git clone https://github.com/AhmadMughal-DS/Hospital.git
cd Hospital
```

### 2. Start with Docker Compose (Recommended)
```bash
# Copy env template (edit values if needed)
cp .env.example backend-django/.env

# Start all services
docker-compose up -d

# Seed test data (first run)
docker-compose exec backend python manage.py seed_hms
```

Access:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000/api/v1/
- **Admin Panel**: http://localhost:8000/admin/

### 3. Default Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@hms.ae | Admin@1234 |
| Patient | ahmad@gmail.com | Ahmad@857 |

---

## 🐳 Docker Deployment (Production)

```bash
# 1. Set up environment variables
cp .env.example .env
nano .env  # Fill in production values

# 2. Build and start
docker-compose -f docker-compose.prod.yml up -d

# 3. Check status
docker-compose -f docker-compose.prod.yml ps
```

---

## ⚙️ CI/CD Pipeline

The pipeline runs automatically on `git push` to `main`:

```
┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Stage 1 │───▶│   Stage 2    │───▶│   Stage 3    │───▶│   Stage 4    │
│   Lint   │    │ Build & Test │    │ Push DockerHub│    │ Deploy to VM │
│          │    │              │    │              │    │              │
│ Dockerfile│   │ Both images  │    │ amd64+arm64  │    │ docker-compose│
│ Python   │    │ Integration  │    │ sha+latest   │    │ SSH deploy   │
│ Node build│   │ tests        │    │ tags         │    │ health check │
└──────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

### Triggers
- `push` to `master` → Full pipeline (Lint + Build + Push + Deploy)
- `push` to `develop` → Lint + Build only
- `pull_request` to `master` → Lint + Build only

---

## 🔐 GitHub Secrets Required

Go to your repo → **Settings → Secrets and variables → Actions** and add:

| Secret | Description | Example |
|--------|-------------|---------|
| `DOCKER_USERNAME` | DockerHub username | `ahmadmughal` |
| `DOCKER_PAT` | DockerHub access token | `dckr_pat_...` |
| `VM_IP` | Production server IP | `192.168.1.100` |
| `VM_USERNAME` | SSH username | `ubuntu` |
| `VM_PASSWORD` | SSH password | `your-password` |
| `SECRET_KEY` | Django secret key | 50+ char random string |
| `DB_NAME` | Database name | `hms_db` |
| `DB_USER` | Database user | `hms_user` |
| `DB_PASSWORD` | Database password | Strong password |
| `ALLOWED_HOSTS` | Django allowed hosts | `yourdomain.com` |
| `CORS_ALLOWED_ORIGINS` | CORS origins | `https://yourdomain.com` |
| `EMAIL_HOST_USER` | SMTP email | `you@gmail.com` |
| `EMAIL_HOST_PASSWORD` | SMTP password | Gmail App Password |
| `STRIPE_SECRET_KEY` | Stripe secret | `sk_live_...` |
| `STRIPE_PUBLISHABLE_KEY` | Stripe pub key | `pk_live_...` |
| `VITE_DJANGO_API_BASE` | Backend URL for frontend | `https://hospital.ahmaddataops.com` |
| `VITE_QUEUE_API_BASE` | Queue API URL | `https://hospital.ahmaddataops.com` |

---

## 📡 API Overview

Base URL: `http://localhost:8000/api/v1/`

| Module | Endpoint | Description |
|--------|----------|-------------|
| Auth | `POST /auth/login/` | JWT login |
| Auth | `POST /auth/register/` | Register patient |
| Auth | `GET/PATCH /auth/me` | Profile |
| Auth | `GET /auth/patients/` | All patients (admin/doctor) |
| Doctors | `GET /doctors/` | Doctor list |
| Doctors | `GET /doctors/admin-all/` | Admin doctor list |
| Appointments | `GET/POST /appointments/` | Book & list |
| Appointments | `POST /<id>/rate/` | Rate doctor |
| Appointments | `GET /notifications/` | In-app notifications |
| Pharmacy | `GET /pharmacy/drugs/` | Drug inventory |
| Billing | `GET /billing/invoices/` | Invoice list |
| Billing | `GET /billing/invoices/<id>/pdf/` | PDF download |
| Billing | `GET /billing/summary/` | Revenue stats |
| Queue | `GET /queue/tokens/current` | Live queue |

---

## 📁 Project Structure

```
Hospital/
├── .github/
│   └── workflows/
│       └── ci-cd.yml          # GitHub Actions pipeline
├── backend-django/
│   ├── apps/
│   │   ├── accounts/          # Users, Patient profiles
│   │   ├── appointments/      # Booking, Prescriptions, Ratings
│   │   ├── billing/           # Invoices, Stripe, PDF
│   │   ├── doctors/           # Doctor profiles, Specialties
│   │   ├── pharmacy/          # Drugs, Stock, Dispensing
│   │   └── queue_mgmt/        # Queue tokens
│   ├── config/                # Django settings, URLs
│   ├── Dockerfile             # Multi-stage production build
│   └── requirements.txt
├── frontend-web/
│   ├── src/
│   │   ├── components/        # Reusable UI (Sidebar, Modals, etc.)
│   │   ├── pages/             # Dashboard pages per role
│   │   └── hooks/             # Custom React hooks
│   ├── Dockerfile             # Node build → Nginx serve
│   └── nginx.conf             # SPA routing + security headers
├── docker-compose.yml         # Local development
├── docker-compose.prod.yml    # Production deployment
├── .env.example               # Environment template
└── README.md
```

---

## 📄 License

MIT License — © 2026 Ahmad Mughal
