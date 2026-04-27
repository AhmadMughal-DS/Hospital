# MediCore HMS — Enterprise Hospital Management System

A full-stack, enterprise-grade Hospital Management System targeting the Middle East (UAE/Saudi Arabia) and European markets.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Django 5.1 + Django REST Framework + JWT |
| Frontend | React 18 + Vite + Tailwind CSS 3 |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Auth | JWT (SimpleJWT — Bearer token) |
| i18n | react-i18next (EN + AR/RTL) |
| Containerization | Docker + Docker Compose |

---

## Quick Start (Local Development)

### 1. Backend (Django)

```bash
cd backend-django

# Activate virtual environment
.venv\Scripts\activate          # Windows
# source .venv/bin/activate    # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Seed demo data
set PYTHONIOENCODING=utf-8
python manage.py seed_hms

# Start server (port 8000)
python manage.py runserver
```

### 2. Frontend (React)

```bash
cd frontend-web
npm install
npm run dev        # Starts at http://localhost:5173
```

---

## Demo Credentials

| Role | Email | Password |
|---|---|---|
| Admin | admin@hms.ae | Admin@1234 |
| Doctor | sara.khan@hms.ae | Doctor@1234 |
| Pharmacist | pharma@hms.ae | Pharma@1234 |
| Patient | patient@hms.ae | Patient@1234 |

---

## Module Overview

### Patient Portal (`/patient`)
- Registration with auto-generated Patient ID
- Real-time appointment booking with doctor specialty filters
- Multi-currency support (AED, SAR, EUR)
- Medical records viewer (Prescriptions, Lab Reports, Visits)
- Invoice history and payment status
- Live OPD queue token system

### Doctor Command Center (`/doctor`)
- Today's appointment queue with real-time status updates
- Patient list with visit history
- E-Prescription writer (drugs, dosage, frequency, duration)
- TeleHealth readiness indicator

### Admin Control Center (`/admin`)
- Full system KPI overview
- Billing management (mark invoices paid, revenue summary)
- Pharmacy inventory view
- Queue control (Call Next Patient)
- Appointment management

### Pharmacy Management (`/pharmacy`)
- Drug inventory with SKU, stock, price, expiry
- Stock movement recording (IN/OUT/ADJUSTMENT/EXPIRED)
- Low-stock alerts with threshold management
- Expired drug detection

---

## API Endpoints

### Auth
```
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /api/v1/auth/me
POST /api/v1/auth/token/refresh/
```

### Doctors
```
GET  /api/v1/doctors/
GET  /api/v1/doctors/<id>/
GET  /api/v1/doctors/specialties/
GET  /api/v1/doctors/me/
```

### Appointments
```
GET  /api/v1/appointments/
POST /api/v1/appointments/
GET  /api/v1/appointments/<id>/
GET  /api/v1/appointments/today-queue/
POST /api/v1/appointments/<id>/prescription/
```

### Pharmacy
```
GET  /api/v1/pharmacy/drugs/
POST /api/v1/pharmacy/drugs/
GET  /api/v1/pharmacy/stock-movements/
POST /api/v1/pharmacy/stock-movements/
GET  /api/v1/pharmacy/alerts/low-stock/
```

### Billing
```
GET  /api/v1/billing/invoices/
POST /api/v1/billing/invoices/
POST /api/v1/billing/invoices/<id>/pay/
GET  /api/v1/billing/summary/
```

### Queue
```
GET  /api/v1/queue/tokens/
POST /api/v1/queue/tokens/
GET  /api/v1/queue/tokens/current/
POST /api/v1/queue/tokens/call-next/
```

---

## RBAC Roles

| Role | Permissions |
|---|---|
| ADMIN | Full access to all modules |
| DOCTOR | Own appointments, prescriptions, today's queue |
| PHARMACIST | Drug inventory, stock movements, alerts |
| PATIENT | Own appointments, own records, own invoices |

---

## Compliance & Security
- JWT access tokens (8h) with refresh (7d)
- Role-Based Access Control (RBAC) on every endpoint
- GDPR-ready database structure (consent tracking on PatientProfile)
- Data sovereignty fields (patient_id opaque to external systems)
- CORS configured (restrict in production)

---

## Localization
- **English**: Full support (default)
- **Arabic (RTL)**: Full UI mirror via `dir="rtl"`, language toggle in sidebar
- **Currencies**: AED (UAE Dirham), SAR (Saudi Riyal), EUR (Euro)
- **Timezones**: Per-user timezone stored (Asia/Dubai default)

---

## Docker Compose

```bash
docker compose up --build
```

Services:
- `backend` → http://localhost:8000
- `frontend` → http://localhost:5173
