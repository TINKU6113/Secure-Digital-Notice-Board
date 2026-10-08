# Secure Digital Notice Board

> **Course / Purpose:** Secure Software Engineering (SSE) End-Semester Laboratory Examination  
> **Traceability Anchor:** Role-Based Access Control, Notice Lifecycle Governance, Horizontal Privilege Enforcement, and Security Audit Logging.

---

## 1. Project Overview

The **Secure Digital Notice Board** is a production-grade full-stack web application designed for a collegiate environment. It enables students to view and search verified academic and departmental notices, while allowing authorized faculty and administrators to draft, schedule, publish, and archive notices under strict access control policies.

Unlike toy CRUD demonstrations, this project enforces **defense-in-depth** principles directly in code, database constraints, and API routing. Every critical requirement can be traced to software engineering artifacts including UML, ER modeling, Data Flow Diagrams (DFDs), STRIDE threat models, attack trees, and automated security verification tests.

---

## 2. System Architecture

The application adopts a decoupled, multi-tier client-server architecture:

```
┌────────────────────────────────────────────────────────┐
│                   Web Browser Client                   │
│   React 18 + TypeScript + Vite + Tailwind CSS (Light)  │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS / REST (JSON)
                            │ Strict CORS: http://localhost:5173
┌───────────────────────────▼────────────────────────────┐
│                    Express 4 / Node 22 API             │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Security Headers (Helmet: CSP, HSTS, X-Frame)    │  │
│  ├──────────────────────────────────────────────────┤  │
│  │ Rate Limiter (express-rate-limit: Auth & API)    │  │
│  ├──────────────────────────────────────────────────┤  │
│  │ Authentication (JWT Bearer Token / Constant-Time)│  │
│  ├──────────────────────────────────────────────────┤  │
│  │ RBAC & Horizontal Ownership Middleware           │  │
│  ├──────────────────────────────────────────────────┤  │
│  │ Input Validation (Zod Schema Validation)         │  │
│  ├──────────────────────────────────────────────────┤  │
│  │ Centralized Error Handler (No Stack Leaks)       │  │
│  ├──────────────────────────────────────────────────┤  │
│  │ Audit Logger (Asynchronous Immutable Trail)      │  │
│  └──────────────────────────────────────────────────┘  │
└───────────────────────────┬────────────────────────────┘
                            │ Parameterized SQL ($1, $2, ...)
┌───────────────────────────▼────────────────────────────┐
│                  PostgreSQL 16 Database                │
│    - users (UUID, bcrypt hashes, role constraints)     │
│    - notices (UUID, foreign keys, status check)        │
│    - audit_logs (UUID, JSONB metadata, timestamps)     │
└────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack & Versions

| Layer | Technology | Version | Purpose / Security Significance |
|---|---|---|---|
| **Runtime** | Node.js | v22.23.2 | Long-Term Support / Modern JavaScript runtime |
| **Language** | TypeScript | v5.8.2 | Strict compile-time typing and contract validation |
| **Backend Framework** | Express | v4.21.2 | Minimalist REST API web server |
| **Database** | PostgreSQL | 16.15 (Alpine) | ACID-compliant relational DB with check constraints |
| **Database Client** | `pg` | v8.13.3 | Connection pooling with parameterized query execution |
| **Validation** | Zod | v3.24.2 | Runtime schema validation on body, query, and params |
| **Password Hashing**| bcryptjs | v2.4.3 | Salted password hashing (cost factor 10) |
| **Token Handling** | jsonwebtoken | v9.0.2 | Signed JWT tokens with HS256 algorithm |
| **Security Headers**| Helmet | v8.0.0 | CSP, X-Content-Type-Options, X-Frame-Options: DENY |
| **Rate Limiter** | express-rate-limit | v7.5.0 | Throttling brute-force login and DoS request bursts |
| **Frontend UI** | React | v18.3.1 | Declarative component architecture |
| **Styling** | Tailwind CSS | v4.0.0 | Clean, accessible light college portal theme |
| **Icons** | Lucide React | v0.475.0 | Clean iconography for portals and status indicators |
| **Build Tool** | Vite | v6.1.1 | Modern ES-module development and production bundling |

---

## 4. Database Schema (PostgreSQL)

The database schema is managed via discrete SQL migrations in `database/migrations/`:

### `users` Table
- `id` (UUID, Primary Key, `DEFAULT gen_random_uuid()`)
- `email` (VARCHAR(255), UNIQUE, NOT NULL)
- `password_hash` (VARCHAR(255), NOT NULL, never returned in API payloads)
- `full_name` (VARCHAR(100), NOT NULL)
- `role` (VARCHAR(20), CHECK `role IN ('STUDENT', 'FACULTY', 'ADMIN')`)
- `department` (VARCHAR(50), CHECK `department IN ('CSE', 'CYS', 'ECE', 'EEE', 'ME', 'General')`)
- `is_active` (BOOLEAN, DEFAULT TRUE)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### `notices` Table
- `id` (UUID, Primary Key, `DEFAULT gen_random_uuid()`)
- `title` (VARCHAR(200), NOT NULL)
- `content` (TEXT, NOT NULL)
- `author_id` (UUID, NOT NULL, FOREIGN KEY REFERENCES `users(id)` ON DELETE CASCADE)
- `department` (VARCHAR(50), CHECK `department IN ('CSE', 'CYS', 'ECE', 'EEE', 'ME', 'General')`)
- `category` (VARCHAR(50), CHECK `category IN ('Academic', 'Examination', 'Placement', 'Event', 'Workshop', 'Holiday', 'Emergency', 'General')`)
- `priority` (VARCHAR(20), CHECK `priority IN ('Normal', 'Important', 'Urgent')`)
- `status` (VARCHAR(20), CHECK `status IN ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED')`)
- `scheduled_at` (TIMESTAMPTZ, NULL)
- `expires_at` (TIMESTAMPTZ, NULL)
- `created_at`, `updated_at` (TIMESTAMPTZ)
- *Constraint:* `CHECK (expires_at IS NULL OR scheduled_at IS NULL OR expires_at > scheduled_at)`

### `audit_logs` Table
- `id` (UUID, Primary Key, `DEFAULT gen_random_uuid()`)
- `user_id` (UUID, NULL, FOREIGN KEY REFERENCES `users(id)` ON DELETE SET NULL)
- `user_email` (VARCHAR(255), NULL)
- `user_role` (VARCHAR(20), NULL)
- `action` (VARCHAR(50), NOT NULL) — e.g. `LOGIN_SUCCESS`, `LOGIN_FAILURE`, `UNAUTHORIZED_ACCESS`, `NOTICE_CREATE`, `NOTICE_UPDATE`, `NOTICE_DELETE`, `NOTICE_SCHEDULE`
- `resource_type` (VARCHAR(50), NOT NULL) — e.g. `AUTH`, `NOTICE`, `USER`, `SYSTEM`
- `resource_id` (VARCHAR(100), NULL)
- `status` (VARCHAR(20), CHECK `status IN ('SUCCESS', 'FAILURE')`)
- `ip_address` (VARCHAR(50), NULL)
- `user_agent` (TEXT, NULL)
- `metadata` (JSONB, NULL DEFAULT `'{}'::jsonb`)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())

---

## 5. Security Architecture & Controls

### A. Role-Based Access Control (RBAC) & Authorization
- Enforced strictly on backend routes via `authorize('ROLE')` middleware.
- Hiding frontend buttons is treated as a UX affordance only; the backend is the authoritative security boundary.
- **Student**: Read-only access to published notices. Cannot access audit logs, create notices, or alter state.
- **Faculty**: Can view published notices and author/manage notices for their department.
- **Admin**: System-wide governance; can view all notices across all lifecycles, inspect audit logs, and modify any notice.

### B. Prevention of Horizontal Privilege Escalation
- If Faculty A attempts to update or delete a notice authored by Faculty B (`PUT /api/notices/:id`), the backend compares `req.user.id` against `notice.author_id`.
- If there is a mismatch:
  1. The operation is aborted with **403 Forbidden**.
  2. An `UNAUTHORIZED_ACCESS` security event with `reason: HORIZONTAL_AUTHORIZATION_VIOLATION` is automatically written to the `audit_logs` table.

### C. Notice Lifecycle Backend Enforcement
- Notice queries evaluate status dynamically:
  - Students can **only** receive notices where `status = 'PUBLISHED'`, `scheduled_at <= NOW()`, and `expires_at > NOW()`.
  - Drafts and scheduled notices are physically withheld at the query filter level, preventing data leakage.
  - Expired notices automatically transition to `ARCHIVED`.

### D. Malicious Content & XSS Protection (CWE-79)
- All notice content is untrusted input.
- Frontend renders notice text using native React text node interpolation (`whitespace-pre-wrap`), completely avoiding `dangerouslySetInnerHTML`.
- All text inputs are validated on the backend with Zod.

### E. SQL Injection Prevention (CWE-89)
- Parameterized queries (`$1, $2, ...`) are strictly utilized across all database operations.
- Zero raw string concatenation or template literal interpolation into SQL strings.

### F. Authentication Protection & Timing Attack Defense (CWE-208, CWE-204)
- Password hashing with bcrypt (cost factor 10).
- If an email does not exist in the database, the server runs a dummy bcrypt comparison against a precomputed hash to maintain constant response timing, preventing username enumeration.
- Login rate-limiting (10 requests per 15 minutes per IP).
- Sanitized generic error messages (`"Invalid email or password"`).

### G. Information Leakage Prevention (CWE-209)
- Centralized Express error handler catches unhandled errors, logs technical details server-side, and returns sanitized client error codes without stack traces or database schema disclosures.

---

## 6. Demo Accounts (SSE Examination Setup)

All accounts are pre-seeded in the database:

| Role | Email | Password | Department | Permissions |
|---|---|---|---|---|
| **Student** | `student@college.edu` | `Student@123` | CSE | View / Filter published notices |
| **Student** | `student.cys@college.edu` | `Student@123` | CYS | View / Filter published notices |
| **Faculty** | `faculty.cse@college.edu` | `Faculty@123` | CSE | Author & manage CSE notices |
| **Faculty** | `faculty.cys@college.edu` | `Faculty@123` | CYS | Author & manage CYS notices |
| **Admin** | `admin@college.edu` | `Admin@123` | General | Global notice control & audit logs |

---

## 7. How to Run the Application

### Prerequisites
- Node.js >= 20
- npm >= 10
- Docker & Docker Compose (for PostgreSQL container)

### Step 1: Start PostgreSQL Database
```bash
docker compose up -d postgres
```
*Note: Starts PostgreSQL on port `5434` with user `postgres` and database `digital_notice_board`.*

### Step 2: Configure Environment
```bash
cp .env.example .env
```

### Step 3: Run Database Migrations and Seeds
```bash
cd backend
npm install
npm run db:migrate
npm run db:seed
```

### Step 4: Start Backend API
```bash
cd backend
npm run dev
```
*The API will start at `http://localhost:5000` (Healthcheck: `http://localhost:5000/api/health`).*

### Step 5: Start Frontend Application
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
*The UI will start at `http://localhost:5173`.*

---

## 8. Current Implementation Status

### Completed in Task 1:
- [x] Complete project structure and configuration (`frontend/`, `backend/`, `database/`, `docs/`, `docker-compose.yml`)
- [x] PostgreSQL database migrations for `users`, `notices`, `audit_logs`, and schema tracking
- [x] Database seeder script with bcrypt-hashed demo credentials and sample lifecycle notices
- [x] Secure authentication module (bcrypt, JWT HS256, timing-attack mitigation)
- [x] RBAC authorization middleware (Student, Faculty, Admin)
- [x] Notice lifecycle enforcement (Draft, Scheduled, Published, Archived)
- [x] Horizontal ownership authorization enforcement (Faculty-to-Faculty tamper prevention)
- [x] Security audit logging service with dedicated Admin viewer
- [x] Input validation with Zod schemas for all endpoints
- [x] Rate limiting (general API + stricter auth endpoint limit)
- [x] HTTP security headers via Helmet and strict CORS
- [x] Clean light-theme college portal UI in React + TypeScript + Tailwind CSS
- [x] Zero vulnerability dependency audit across both backend and frontend

### Remaining for Subsequent Phases:
- [ ] Containerization: Production Dockerfiles with multi-stage builds and non-root users
- [ ] Orchestration: Minikube-compatible Kubernetes manifests (Deployments, Services, ConfigMaps, Secrets, SecurityContext)
- [ ] CI/CD: GitHub Actions pipeline (Lint, Test, SAST, Docker Build)
- [ ] Automated Test Suite: Jest/Supertest integration tests, horizontal authorization tests, XSS fuzzing script
- [ ] Academic Documentation artifacts in `docs/` (UML, DFD, STRIDE threat models, attack trees, sprint tasks)
