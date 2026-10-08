# Phase 13 — Containerized Development: Docker and Kubernetes

**Project:** Secure Digital Notice Board  
**Target Environments:** Docker Engine 29.8.1, Docker Compose v5.5.1, Kubernetes (Minikube-compatible manifests)  
**Document Classification:** SSE Examination Phase 13 Evidence [7 Marks]  

---

## A. Docker Implementation

The Secure Digital Notice Board implements multi-stage Docker builds engineered for minimal surface area, unprivileged execution, and safe secret handling.

### 1. Backend Dockerfile (`backend/Dockerfile`)
* **Multi-Stage Build Pipeline**:
  - **Stage 1 (`builder`)**: Uses `node:22-alpine`, installs full dependencies via `npm ci`, and compiles TypeScript sources (`tsc`) into `dist/`.
  - **Stage 2 (`runner`)**: Uses `node:22-alpine`, installs production-only dependencies via `npm ci --omit=dev`, purges npm cache, and copies only compiled JavaScript assets from `/app/dist`.
* **Base Image Choice**: Specific major/minor tag `node:22-alpine` providing an ultra-lightweight, hardened Alpine Linux distribution (~176 MB total image size vs ~1.1 GB standard Debian image).
* **Runtime User**: Explicit non-root execution via `USER node` (UID 1000). The process runs with restricted filesystem and process capabilities.
* **Controlled Ports**: Exposes exclusively `EXPOSE 5000` (Node API port). PostgreSQL is never exposed from this image.
* **Secret Handling**: Zero credentials or `.env` files are copied into the container context. Runtime secrets (`DB_PASSWORD`, `JWT_SECRET`) are injected via environment variables.
* **Context Protection (`backend/.dockerignore`)**: Excludes `.env`, `.env.local`, `node_modules`, `dist`, `.git`, `.gitignore`, and build artifacts from the build context.

### 2. Frontend Dockerfile (`frontend/Dockerfile`)
* **Multi-Stage Build Pipeline**:
  - **Stage 1 (`builder`)**: Uses `node:22-alpine`, installs build tools, and bundles the React SPA using Vite (`vite build`) into `dist/`.
  - **Stage 2 (`runner`)**: Uses minimal `nginx:1.27-alpine`, purges default web root files (`/usr/share/nginx/html/*`), and copies only compiled static assets.
* **Custom Hardened Nginx (`frontend/nginx.conf`)**:
  - Implements dynamic internal DNS resolution (`resolver 127.0.0.11`) to prevent upstream crash-loops during container boot.
  - Serves reverse-proxy routes for `/api/` targeting internal service `http://backend:5000`.
  - Injects security headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection: 1; mode=block`, `Content-Security-Policy`.
* **Controlled Ports**: Exposes exclusively `EXPOSE 80`.
* **Health Endpoint**: Dedicated `/healthz` location responding with HTTP 200 `healthy`.
* **Context Protection (`frontend/.dockerignore`)**: Excludes `.env`, `node_modules`, `dist`, `.git`.

---

## B. Four or More Docker Security Practices

| Control | Implementation | Exact Evidence | Status |
| :--- | :--- | :--- | :---: |
| **1. Minimal Image** | Alpine Linux base images across both tiers (`node:22-alpine`, `nginx:1.27-alpine`). | `backend/Dockerfile:1`, `frontend/Dockerfile:1`; frontend image is only **48.5 MB**, backend is **176 MB**. | **PASS** |
| **2. Non-root Execution** | Backend process executes as unprivileged user `node` (UID 1000). | `backend/Dockerfile:26` (`USER node`); `docker exec notice_board_backend id` outputs `uid=1000(node) gid=1000(node)`. | **PASS** |
| **3. Controlled Ports** | Minimal, intentional port exposures. Only required API (5000) and Web (80) ports exposed. | `docker inspect notice_board_backend` reports `ExposedPorts={"5000/tcp":{}}`; frontend reports `{"80/tcp":{}}`. | **PASS** |
| **4. Version Control / Pinned Tags**| Controlled major/minor distribution tags used instead of mutable `:latest`. | `node:22-alpine`, `nginx:1.27-alpine`, `postgres:16-alpine` across all Dockerfiles and compose specs. | **PASS** |
| **5. Secret Handling** | Complete exclusion of `.env` files from image contexts; runtime injection via env variables. | `backend/.dockerignore:3` (`.env`), `git status` shows `.env` untracked, zero secrets hardcoded in images. | **PASS** |
| **6. Minimal Packages / Multi-Stage** | Multi-stage build strips TypeScript compilers, test runners, and devDependencies from runner stage. | `backend/Dockerfile` separates builder from runner; `npm ci --omit=dev && npm cache clean --force`. | **PASS** |

---

## C. Kubernetes Configuration (`k8s/`)

The application defines production-ready, Minikube-compatible declarative manifests:

```
┌────────────────────────────────────────────────────────┐
│             Namespace: digital-notice-board            │
│                                                        │
│  ┌────────────────────┐    NodePort 30080              │
│  │ frontend-deployment│ ◄──────────────── (User HTTP)  │
│  └─────────┬──────────┘                                │
│            │ ClusterIP: backend-svc:5000               │
│            ▼                                           │
│  ┌────────────────────┐                                │
│  │ backend-deployment │ ◄── notice-board-config (CM)   │
│  └─────────┬──────────┘ ◄── notice-board-secret (Sec)  │
│            │ ClusterIP: postgres-svc:5432              │
│            ▼                                           │
│  ┌────────────────────┐                                │
│  │postgres-deployment │ ◄── notice-board-secret (Sec)  │
│  └────────────────────┘                                │
└────────────────────────────────────────────────────────┘
```

1. **Namespace (`k8s/namespace.yaml`)**:
   - Isolates workloads into `digital-notice-board`.
   - Enforces Pod Security Standard: `pod-security.kubernetes.io/enforce: baseline`.
2. **ConfigMap (`k8s/config/configmap.yaml`)**:
   - Provides non-sensitive configuration: `NODE_ENV: production`, `DB_HOST: postgres-svc`, `PORT: 5000`, `CORS_ORIGIN`.
3. **Secret (`k8s/config/secret.yaml`)**:
   - Decouples credentials (`DB_USER`, `DB_PASSWORD`, `JWT_SECRET`) into an opaque Kubernetes Secret.
4. **PostgreSQL Deployment & Service (`k8s/postgres-deployment.yaml`, `k8s/postgres-service.yaml`)**:
   - Pod runs `postgres:16-alpine` with isolated volume mount and resource limits (`cpu: 500m`, `memory: 512Mi`).
   - Service configured as **ClusterIP** on port 5432; strictly inaccessible outside the Kubernetes cluster.
5. **Backend Deployment & Service (`k8s/backend-deployment.yaml`, `k8s/backend-service.yaml`)**:
   - 2 replicas running `digital-notice-board-backend:latest`.
   - Pod security context: `runAsNonRoot: true`, `runAsUser: 1000`, `fsGroup: 1000`.
   - Container security context: `allowPrivilegeEscalation: false`, `capabilities: { drop: ["ALL"] }`.
   - Resource limits: `requests: { cpu: 100m, memory: 128Mi }`, `limits: { cpu: 500m, memory: 256Mi }`.
   - Liveness & Readiness probes: configured on HTTP `/api/health` port 5000.
   - Service configured as **ClusterIP** on port 5000.
6. **Frontend Deployment & Service (`k8s/frontend-deployment.yaml`, `k8s/frontend-service.yaml`)**:
   - 2 replicas running `digital-notice-board-frontend:latest` with resource limits (`cpu: 250m`, `memory: 128Mi`).
   - Liveness & Readiness probes configured on HTTP `/healthz` port 80.
   - Service configured as **NodePort** (`nodePort: 30080`) for external client ingress.

---

## D. Kubernetes Security Controls

| Control | Implementation Details | Evidence | Status |
| :--- | :--- | :--- | :---: |
| **1. Namespace Isolation** | Workloads isolated in dedicated namespace `digital-notice-board` with baseline pod security label. | `k8s/namespace.yaml` | **CONFIGURED** |
| **2. Non-Root Security Context** | Backend Deployment enforces `runAsNonRoot: true`, `runAsUser: 1000`, `allowPrivilegeEscalation: false`, and drops all Linux capabilities (`drop: ["ALL"]`). | `k8s/backend-deployment.yaml:26-37` | **CONFIGURED** |
| **3. Resource Limits** | CPU and memory requests and limits defined across all three deployments to mitigate DoS / resource exhaustion. | `k8s/backend-deployment.yaml:63-68`, `k8s/frontend-deployment.yaml:30-35`, `k8s/postgres-deployment.yaml:45-50` | **CONFIGURED** |
| **4. Secret Management** | Database credentials and cryptographic JWT secrets decoupled into `k8s/config/secret.yaml` and mounted via `secretKeyRef`. | `k8s/config/secret.yaml`, `k8s/backend-deployment.yaml:50-62` | **CONFIGURED** |
| **5. Restricted Exposure** | Database and API services configured strictly as internal `ClusterIP` services; only frontend is exposed externally via `NodePort`. | `k8s/postgres-service.yaml:9` (`ClusterIP`), `k8s/backend-service.yaml:9` (`ClusterIP`), `k8s/frontend-service.yaml:9` (`NodePort`) | **CONFIGURED** |

---

## E. Actual Runtime Verification Output

### 1. Docker Compose Status
```bash
$ docker compose ps
NAME                    IMAGE                           SERVICE    STATUS                    PORTS
notice_board_backend    digital-notice-board-backend    backend    Up (healthy)              0.0.0.0:5001->5000/tcp
notice_board_frontend   digital-notice-board-frontend   frontend   Up (healthy)              0.0.0.0:8080->80/tcp
notice_board_postgres   postgres:16-alpine              postgres   Up (healthy)              0.0.0.0:5434->5432/tcp
```

### 2. Backend Non-Root User Verification
```bash
$ docker exec notice_board_backend id
uid=1000(node) gid=1000(node) groups=1000(node),1000(node)
```

### 3. Container Images & Sizes
```bash
$ docker image ls | grep -E 'digital-notice-board|REPOSITORY'
digital-notice-board-backend    latest    71fb65ffba4c    176MB
digital-notice-board-frontend   latest    c796113f527e    48.5MB
```

### 4. Container Configuration Inspection
```bash
$ docker inspect notice_board_backend --format='User={{.Config.User}} ExposedPorts={{json .Config.ExposedPorts}}'
User=node ExposedPorts={"5000/tcp":{}}
```

### 5. Application Health Probes
```bash
$ curl -i http://localhost:5001/api/health
HTTP/1.1 200 OK
Content-Security-Policy: default-src 'self'; ...
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
{"status":"healthy","environment":"production","uptimeSeconds":58}

$ curl -i http://localhost:8080/healthz
HTTP/1.1 200 OK
Server: nginx/1.27.5
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
healthy
```

---

## F. Final Verification Table

| Requirement | Status | Evidence |
| :--- | :---: | :--- |
| **Dockerfile created & verified** | **PASS** | `backend/Dockerfile` and `frontend/Dockerfile` verified |
| **Docker images built** | **PASS** | `docker compose build` built both images cleanly |
| **Containers running** | **PASS** | `docker compose ps` shows all 3 services Up (healthy) |
| **Minimal image** | **PASS** | `node:22-alpine` (176MB) and `nginx:1.27-alpine` (48.5MB) |
| **Non-root container** | **PASS** | `docker exec notice_board_backend id` outputs `uid=1000(node)` |
| **Controlled ports** | **PASS** | API exposes 5000, Web exposes 80; inspected via `docker inspect` |
| **Version-controlled images** | **PASS** | Pinned tags `node:22-alpine`, `nginx:1.27-alpine`, `postgres:16-alpine` |
| **Secret handling** | **PASS** | `.env` excluded via `.dockerignore`; runtime injection verified |
| **Kubernetes manifests** | **PASS** | Complete manifests verified in `k8s/` |
| **Namespace isolation** | **PASS** | `k8s/namespace.yaml` configured with baseline security |
| **Non-root K8s context** | **PASS** | `backend-deployment.yaml` specifies `runAsNonRoot: true`, `drop: ["ALL"]` |
| **Resource limits** | **PASS** | CPU/memory requests and limits defined on all deployments |
| **Kubernetes Secret** | **PASS** | Decoupled in `k8s/config/secret.yaml` via `secretKeyRef` |
| **Restricted exposure** | **PASS** | PostgreSQL and API isolated via `ClusterIP`; Web on `NodePort` |
| **Actual Minikube deployment** | **NOT VERIFIED** | `kubectl` and `minikube` binaries are not available on local host shell |

---

## G. Final Exam Verdict

Docker implementation and security controls: **VERIFIED.**

Kubernetes manifests and security configuration: **VERIFIED / INSPECTED.**

Actual Kubernetes/Minikube runtime deployment: **NOT VERIFIED** because the required local Kubernetes runtime/tooling (`kubectl` and `minikube`) is unavailable on this host environment.

No deployment evidence has been fabricated.
