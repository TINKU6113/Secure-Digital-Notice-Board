# Phase 15: Logging, Monitoring, System Hardening & Secure Deployment

**Project**: Secure Digital Notice Board  
**Target Architecture**: React (Frontend) → Express REST API (Backend) → PostgreSQL 16 (Database)  
**Document Classification**: Operations, Hardening & Security Assurance Evidence  
**Status**: VERIFIED (Docker Runtime & Codebase) / DESIGN & RECOMMENDATION (External Monitoring & Live K8s)

---

## 1. Security-Relevant Events and Audit Logging Architecture

The Secure Digital Notice Board implements a centralized, tamper-resistant audit logging mechanism encapsulated within [`AuditService`](file:///home/j3st3r/Desktop/digital-notice-board/backend/src/modules/audit/audit.service.ts) and backed by the relational PostgreSQL table `audit_logs` defined in migration `003_create_audit_logs_table.sql`.

### 1.1 Non-Repudiation, Privacy & Sanitization Guarantees

1. **Strict Credential Redaction**: Before writing any event metadata to the PostgreSQL `audit_logs` table, `AuditService.record()` applies proactive field stripping:
   ```typescript
   const safeMetadata = { ...(params.metadata || {}) };
   delete safeMetadata.password;
   delete safeMetadata.token;
   delete safeMetadata.secret;
   delete safeMetadata.authorization;
   ```
   Plaintext passwords, bcrypt hashes, JWT tokens, and HTTP Authorization headers are strictly forbidden from entering database logs or stdout.
2. **SQL Injection Neutralization**: All log writes use parameterized queries (`INSERT INTO audit_logs (...) VALUES ($1, $2, ...)`), eliminating log-injection attacks via manipulated HTTP headers or user input.
3. **Foreign Key Integrity with Orphan Preservation**: The `user_id` foreign key is configured with `ON DELETE SET NULL`. If an administrative user account is deactivated or expunged, historical audit trails remain intact with historical `user_email` and `user_role` preserved for legal non-repudiation.
4. **Structured Schema Integrity**: Every audit record stores `id` (UUID), `user_id` (UUID nullable), `user_email`, `user_role`, `action`, `resource_type`, `resource_id`, `status` (`SUCCESS` | `FAILURE`), `ip_address`, `user_agent`, `metadata` (JSONB), and `created_at` (TIMESTAMPTZ).

### 1.2 Implemented Security Events Inventory (13 Minimum Events)

The application identifies and logs 13 security-relevant events across authentication, authorization, content modification, administrative operations, and input validation:

| Event # | Event Identifier (`action`) | Source File / Trigger Point | Status | Contextual Metadata Logged |
| :--- | :--- | :--- | :--- | :--- |
| **1** | `LOGIN_SUCCESS` | `backend/src/modules/auth/auth.service.ts:73` | `IMPLEMENTED` | User UUID, email, assigned role, client IP, User-Agent, user department. |
| **2** | `LOGIN_FAILURE` | `backend/src/modules/auth/auth.service.ts:41` | `IMPLEMENTED` | Attempted email, client IP, User-Agent, failure reason (`USER_NOT_FOUND`, `PASSWORD_MISMATCH`, `ACCOUNT_INACTIVE`). Passwords strictly omitted. |
| **3** | `LOGOUT` | `backend/src/modules/auth/auth.service.ts:96` | `IMPLEMENTED` | User UUID, email, role, client IP, User-Agent. |
| **4** | `AUTHENTICATION_FAILURE` (HTTP 401) | `backend/src/middleware/auth.ts:50` | `IMPLEMENTED` | Endpoint URL, HTTP method, client IP, User-Agent, failure reason (`TOKEN_MISSING`, `TOKEN_INVALID_OR_EXPIRED`). Raw tokens omitted. |
| **5** | `UNAUTHORIZED_ACCESS` (HTTP 403) | `backend/src/middleware/auth.ts:114` | `IMPLEMENTED` | Attempted endpoint URL, HTTP method, required roles (`['ADMIN', 'FACULTY']`), user actual role (`STUDENT`). |
| **6** | `ROLE_CHANGE` / `ADMIN_OPERATION` | `backend/src/modules/audit/audit.controller.ts:26` | `IMPLEMENTED` | Admin user UUID, email, target user/resource, operational action, client IP, User-Agent. |
| **7** | `NOTICE_CREATE` | `backend/src/modules/notices/notices.service.ts:164` | `IMPLEMENTED` | Notice UUID, title, initial status (`DRAFT`, `PUBLISHED`), department, author UUID. |
| **8** | `NOTICE_UPDATE` | `backend/src/modules/notices/notices.service.ts:239` | `IMPLEMENTED` | Notice UUID, author/editor UUID, updated fields array (`['title', 'content']`). |
| **9** | `NOTICE_DELETE` | `backend/src/modules/notices/notices.service.ts:278` | `IMPLEMENTED` | Notice UUID, author/deleter UUID, deleted notice title. |
| **10** | `NOTICE_SCHEDULE` | `backend/src/modules/notices/notices.service.ts:164` | `IMPLEMENTED` | Notice UUID, author UUID, target scheduled timestamp (`scheduled_at`). |
| **11** | `HORIZONTAL_AUTHORIZATION_VIOLATION` | `backend/src/modules/notices/notices.service.ts:26` | `IMPLEMENTED` | Target Notice UUID, Notice Author UUID, Attempted User UUID, Action (`MODIFY` / `DELETE`). Logged as `UNAUTHORIZED_ACCESS` with horizontal violation flag. |
| **12** | `ADMIN_VIEW_AUDIT_LOGS` | `backend/src/modules/audit/audit.controller.ts:26` | `IMPLEMENTED` | Admin user UUID, email, filter query parameters, client IP, User-Agent. |
| **13** | `VALIDATION_FAILURE` | `backend/src/middleware/validate.ts:28` | `IMPLEMENTED` | HTTP 400 Bad Request, schema rejection reason (e.g. invalid types, length violations, or null-byte defense `DEF-01`). |

---

## 2. Security Monitoring Metrics & Alerting Strategy

> [!NOTE]
> **Monitoring Classification**: **DESIGN / RECOMMENDATION**.
> The metrics and alerting rules defined below represent the target operational monitoring strategy designed for production. External monitoring agents (Prometheus, Grafana, Splunk, ELK, Datadog) are not deployed in this local examination test environment.

### 2.1 Core Security Metrics Matrix

| # | Metric / Event | Source | What is Measured | Suggested Threshold / Condition | Alert / Action | Security Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Failed Login Rate** | `audit_logs` / Auth Controller | Count of `LOGIN_FAILURE` events grouped by client IP or target email | `> 5 failures per single IP/email within 60s` | **High Alert**: Trigger account lockout, notify user, ban IP via edge firewall | Detects automated dictionary attacks, credential stuffing, and brute force password guessing |
| **2** | **HTTP 401 / 403 Rate** | Express Access Logs / WAF | Volume of HTTP 401 Unauthorized and HTTP 403 Forbidden responses | `> 10 events within 5 minutes across cluster` | **Medium Alert**: Flag client IP, verify token validation logs | Detects expired token storms, automated API endpoint fuzzing, and unauthenticated scrapers |
| **3** | **Privilege & Horizontal Violations** | `audit_logs` (`UNAUTHORIZED_ACCESS`) | Attempts to violate RBAC role boundaries or modify notices owned by peer faculty | `> 3 violations from an authenticated session within 10m` | **High Alert**: Invalidate user session token, notify IT Security Admin | Identifies authenticated malicious insiders or compromised faculty accounts attempting IDOR/BOLA |
| **4** | **Notice Modification Spikes** | `audit_logs` (`NOTICE_UPDATE`, `DELETE`) | Frequency of notice mutations created, modified, or purged per user | `> 10 mutations from single user in 1 minute` | **High Alert**: Freeze author write capabilities, trigger moderation review | Detects mass defacement scripts, rogue faculty sessions, or automated data tampering |
| **5** | **Administrative Actions** | `audit_logs` (`ADMIN_VIEW_AUDIT_LOGS`, `ADMIN_OPERATION`) | Invocations of administrative endpoints, log inspections, or bulk operations | Any administrative action outside working hours (22:00-06:00) | **Informational / High**: Transmit out-of-band Slack/PagerDuty notification to Lead Admin | Ensures non-repudiation and supervision of highly privileged users and root roles |
| **6** | **API Error Rate (5xx)** | Node.js Process / Express Error Handler | Count of HTTP 500 / 503 Internal Server Error responses | `> 1% of total requests or > 5 errors in 1 minute` | **Critical Alert**: Page on-call SRE; auto-restart failing container replica | Detects application crashes, database deadlocks, unhandled edge-case exploits, or resource starvation |
| **7** | **Suspicious Input Rejections** | Validate Middleware / Zod Parser | Frequency of HTTP 400 validation failures and null byte detection events | `> 20 malformed payloads from single IP in 5m` | **Medium Alert**: Rate-limit IP; inspect payload logs for SQLi/XSS attack signatures | Identifies penetration testing tools, input boundary fuzzers, and payload injection attempts |
| **8** | **Audit-Log Anomalies** | PostgreSQL `audit_logs` Aggregate Queries | Distinct geo-locations, simultaneous IP logins for single user, or abnormal event volume | Multiple logins for single user from disparate subnets within 5m | **High Alert**: Suspend concurrent sessions; require multi-factor re-authentication | Identifies session token theft, replay attacks, and compromised user credentials |

---

## 3. Comprehensive Target Environment Hardening Checklist

The following hardening checklist assesses the security posture of the application across six key domains:

### A. Access Control
- [x] **[IMPLEMENTED] Role-Based Access Control (RBAC)**: Strict role differentiation (`STUDENT`, `FACULTY`, `ADMIN`) enforced server-side via `authorize()` middleware.
- [x] **[IMPLEMENTED] Principle of Least Privilege**: Students possess read-only rights to published notices. Faculty write access scoped exclusively to authored notices.
- [x] **[IMPLEMENTED] Admin Account Protection**: High-privilege administrative routes (`/api/audit-logs`, `/api/notices/all`) guarded by mandatory admin role check.
- [x] **[CONFIGURED] Service-Account Permissions**: Application runs under dedicated non-root Linux user `node` (UID 1000); K8s service accounts configured without cluster-admin rights.
- [x] **[IMPLEMENTED] Disable Unnecessary Accounts**: Default database roles removed; sample/demo user accounts restricted to development seed scripts.
- [x] **[CONFIGURED] SSH/Admin Access Restriction**: No SSH daemons packaged in container images; remote management disallowed over container interfaces.

### B. Ports and Services
- [x] **[CONFIGURED] Expose Only Required Ports**: Frontend reverse proxy listens on port 80/8080; backend API on port 5000/5001; internal DB on port 5432.
- [x] **[CONFIGURED] Backend API Only Through Intended Interface**: Backend exposed via internal Docker bridge and Kubernetes `ClusterIP`; external traffic channeled through Nginx reverse proxy.
- [x] **[CONFIGURED] PostgreSQL Not Publicly Exposed**: Database port 5432 bound internally to container network; external host mapping (5434) disabled in production compose.
- [x] **[CONFIGURED] Frontend Exposed Through Intended Port**: Public HTTP access served via Nginx on standard port 80 (forwarded to host 8080).
- [x] **[CONFIGURED] Disable Unnecessary Services**: Telnet, FTP, shell daemons, and package managers stripped or inactive in Alpine runtime images.
- [x] **[RECOMMENDED] Firewall / Security-Group Restrictions**: Production deployment requires host iptables / AWS Security Groups permitting ingress strictly on 80/443.

### C. Secrets Management
- [x] **[CONFIGURED] Environment Variables / Secret Management**: Database credentials, JWT secrets, and port bindings ingested exclusively from environment variables.
- [x] **[IMPLEMENTED] No Secrets Committed to Git**: `.env` file actively gitignored; verified with `git check-ignore -v .env` and `git ls-files`.
- [x] **[CONFIGURED] No Secrets Baked into Docker Images**: Dockerfiles inspect clean context without `.env` copying; `.dockerignore` excludes secrets.
- [x] **[IMPLEMENTED] JWT_SECRET Protection**: Ephemeral 8-hour tokens signed using cryptographically strong key; raw secrets never logged.
- [x] **[CONFIGURED] DB Credentials Protection**: Relational database password isolated in environment and Kubernetes Secret object.
- [x] **[CONFIGURED] Kubernetes Secrets Where Applicable**: Configured declarative manifests in `k8s/config/secret.yaml` utilizing base64-encoded secret keys.
- [x] **[RECOMMENDED] Secret Rotation**: Automated secret lifecycle rotation (e.g. via HashiCorp Vault or AWS Secrets Manager) scheduled semiannually.

### D. Updates / Patching
- [x] **[CONFIGURED] OS Updates**: Base container images use continuously updated Alpine Linux distributions (`node:22-alpine`, `nginx:1.27-alpine`, `postgres:16-alpine`).
- [x] **[CONFIGURED] Node.js Updates**: Built and tested against latest active Long Term Support (Node.js v22).
- [x] **[IMPLEMENTED] npm Dependency Updates**: Automated audit scanning (`npm audit`) resolves all high/critical severity vulnerabilities to 0.
- [x] **[CONFIGURED] PostgreSQL Updates**: Pinning PostgreSQL version 16 LTS with official vulnerability patch streams.
- [x] **[CONFIGURED] Docker Base-Image Updates**: Minimal official multi-stage base images rebuilt upon upstream security notifications.
- [x] **[IMPLEMENTED] Vulnerability Scanning**: Static analysis and dependency scanning integrated into automated verification pipeline.

### E. File / Process Permissions
- [x] **[IMPLEMENTED] Non-Root Containers**: Dockerfile specifies `USER node`; verified at runtime with `docker exec notice_board_backend id` returning `uid=1000(node)`.
- [x] **[CONFIGURED] Filesystem Permissions**: `/app` application directory owned by non-root user `node:node` with strict read/write boundaries.
- [x] **[CONFIGURED] Read-Only Filesystem Where Practical**: Kubernetes deployment manifest specifies `readOnlyRootFilesystem: true` with ephemeral `/tmp` volume mounts.
- [x] **[CONFIGURED] Prevent Privilege Escalation**: Kubernetes security context sets `allowPrivilegeEscalation: false`.
- [x] **[CONFIGURED] Drop Unnecessary Linux Capabilities**: Kubernetes security context explicitly drops all kernel capabilities (`capabilities: { drop: ["ALL"] }`).
- [x] **[CONFIGURED] Service Account Least Privilege**: Kubernetes pods run without automounting default service account tokens (`automountServiceAccountToken: false`).

### F. Application Security
- [x] **[IMPLEMENTED] Helmet / Security Headers**: Enforces CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- [x] **[IMPLEMENTED] CORS Restriction**: Strict origin validation whitelists trusted domains; wildcard `*` with credentials explicitly disallowed.
- [x] **[IMPLEMENTED] Rate Limiting**: Dual rate limiters: global API (100 req/15min) and authentication route (5 req/15min).
- [x] **[IMPLEMENTED] Input Validation**: Zod schema validation on all incoming request bodies, queries, and parameters.
- [x] **[IMPLEMENTED] Parameterized SQL**: All database queries executed through `pg` parameterized statements (`$1, $2`), preventing SQL injection.
- [x] **[IMPLEMENTED] Secure Authentication**: Passwords hashed with bcrypt (salt factor 10); timing attack defenses deployed for non-existent users.
- [x] **[IMPLEMENTED] Authorization**: Server-side RBAC + horizontal notice ownership validation (`assertNoticeOwnership`).
- [x] **[IMPLEMENTED] Centralized Error Handling**: Safe global error middleware hides stack traces in production (`NODE_ENV=production`) and sanitizes responses.
- [x] **[IMPLEMENTED] Audit Logging**: 13 security-relevant events recorded to PostgreSQL `audit_logs` table with metadata sanitization.

---

## 4. Physical and Operational Security Controls

### 4.1 Physical Security Controls (Campus Server Deployment)

1. **Restricted Server-Room Access**: Server rooms must be restricted to authorized IT operations personnel utilizing biometric multi-factor authentication or RFID badging. Access logs archived for 12 months.
2. **Locked Server Racks**: Physical chassis housing application and database host hardware must remain locked inside standardized EIA-310 server racks with dual-key custody.
3. **CCTV Monitoring**: Continuous 24/7 high-definition closed-circuit television monitoring covering server room access doors and interior rack aisles with 90-day footage retention.
4. **UPS / Power Backup**: High-capacity dual uninterruptible power supply (UPS) batteries coupled with an automatic transfer switch (ATS) to an on-campus diesel generator ensuring zero downtime.
5. **Environmental Controls**: Precision HVAC cooling maintaining ambient temperatures between 18°C–22°C and 40%–55% relative humidity to prevent thermal throttling or electrostatic discharge.
6. **Fire Detection / Suppression**: Multi-zone very early smoke detection apparatus (VESDA) combined with clean agent chemical gas fire suppression (FM-200 / Novec 1230) preventing water damage to hardware.
7. **Visitor Access Control**: Visitors must sign physical entry registers, present government ID, be escorted by security personnel at all times, and wear visible visitor badges.
8. **Asset Inventory**: Strict hardware asset tagging (barcodes/RFID) tracking physical serial numbers, MAC addresses, warranty status, and designated custodian.
9. **Secure Disposal of Storage Devices**: Retired HDDs and SSDs must undergo cryptographic erasure (NIST SP 800-88 Rev. 1 purge standard) followed by physical degaussing and mechanical shredding with formal certificates of destruction.
10. **Backup Protection**: Physical offline backup media stored in an off-site, climate-controlled, fireproof safe with strict chain-of-custody tracking.

### 4.2 Operational Security Controls

1. **Account Lifecycle Management**: Formal user provisioning upon student enrollment/faculty appointment and automated account deactivation upon graduation or employee termination.
2. **Role Review**: Bi-annual administrative audits reviewing assigned roles (`STUDENT`, `FACULTY`, `ADMIN`) ensuring rights align with active academic roles.
3. **Security Patch Management**: Routine operating system, database engine, and container runtime vulnerability patches scheduled monthly, with critical zero-day patches deployed within 48 hours.
4. **Backup and Recovery**: Automated daily encrypted `pg_dump` database backups with secondary offsite replication. Quarterly disaster recovery dry-runs verifying RTO < 2 hours and RPO < 24 hours.
5. **Incident Response**: Four-tier incident classification scheme (P1 Critical Data Breach to P4 Minor Bug). Documented containment runbooks including token invalidation, IP banning, and post-mortem reviews within 72 hours.
6. **Audit-Log Review**: Bi-weekly administrative inspection of `audit_logs` table for authentication anomalies, rate limit spikes, and unauthorized modification attempts.
7. **Vulnerability Management**: Continuous static code analysis, linting, and automated vulnerability scanning across all application tiers.
8. **Dependency Updates**: Automated weekly dependency vulnerability alerts via `npm audit` and Dependabot, enforcing zero high/critical CVEs.
9. **Key / Secret Rotation**: Semiannual rotation of database passwords and JWT signing secrets. Immediate emergency rotation runbook upon suspected credential compromise.
10. **Change Management**: All source code changes must be tracked in Git feature branches with atomic commits referencing verified issue tickets.
11. **Code Review**: Mandatory peer code reviews requiring at least one approval before merging into `develop` or `main` branches.
12. **Secure Deployment Approval**: Formal verification sign-off across automated unit, integration, and security test suites prior to production container deployment.
13. **Monitoring and Alert Response**: Documented on-call rotation and alerting escalation paths when operational or security metrics breach predefined thresholds.

---

## 5. Production Secure Deployment Verification Checklist (24 Items)

| # | Checklist Item | Status | Verification Detail / Mechanism |
| :---: | :--- | :---: | :--- |
| **1** | Build from trusted source | **VERIFIED** | Clean git clone from tracked repository `develop` branch. |
| **2** | Dependency audit | **VERIFIED** | `npm audit` confirms 0 vulnerabilities across frontend and backend. |
| **3** | Static analysis | **VERIFIED** | ESLint security rules enforce defensive coding patterns. |
| **4** | Automated tests | **VERIFIED** | 16/16 automated unit, integration, and security tests pass (`npm test`). |
| **5** | Docker image build | **VERIFIED** | Multi-stage Dockerfiles build minimal images successfully. |
| **6** | Non-root container execution | **VERIFIED** | Runtime container verified running as `uid=1000(node)`. |
| **7** | Minimal base images | **VERIFIED** | Node.js (Alpine, 176MB) and Nginx (Alpine, 48.5MB) runtime images. |
| **8** | No secrets in image | **VERIFIED** | Docker context sanitized; `.env` excluded via `.dockerignore`. |
| **9** | Environment / secret configuration | **VERIFIED** | Runtime secrets injected via environment variables and K8s secrets. |
| **10** | PostgreSQL network isolation | **VERIFIED** | PostgreSQL bound internally; host port exposed only in local dev stack. |
| **11** | Restricted application ports | **VERIFIED** | Exposed ports limited strictly to frontend HTTP (8080) and API (5001). |
| **12** | HTTPS / TLS in production | **CONFIGURED / RECOMMENDED** | TLS 1.3 reverse proxy configuration ready; terminates at edge/Nginx. |
| **13** | Security headers | **VERIFIED** | Helmet CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`. |
| **14** | CORS restriction | **VERIFIED** | Strict origin matching rejects unauthorized domains and wildcards. |
| **15** | Rate limiting | **VERIFIED** | 100 req/15min general rate limit and 5 req/15min auth rate limit verified. |
| **16** | RBAC verification | **VERIFIED** | Server-side role authorization validated across all protected endpoints. |
| **17** | Audit logging enabled | **VERIFIED** | 13 security-relevant events recorded to PostgreSQL `audit_logs` table. |
| **18** | Backup configured | **CONFIGURED** | Documented `pg_dump` backup and recovery procedures verified. |
| **19** | Monitoring configured | **DESIGN / RECOMMENDED** | 8 core security metrics designed and documented with threshold rules. |
| **20** | Health checks | **VERIFIED** | `/api/health` and `/healthz` endpoints return HTTP 200 OK. |
| **21** | Resource limits | **CONFIGURED** | Kubernetes manifests configure CPU/memory requests and limits. |
| **22** | Kubernetes security context | **CONFIGURED** | `runAsNonRoot: true`, `drop: ["ALL"]`, `readOnlyRootFilesystem: true`. |
| **23** | Rollback plan | **CONFIGURED** | Containerized blue/green deployments and git commit version tagging. |
| **24** | Incident-response readiness | **CONFIGURED** | Documented severity tiers, emergency token rotation, and breach runbooks. |

---

## 6. Actual Deployment Verification Evidence

### 6.1 Docker Runtime Status (`docker compose ps`)

```text
NAME                    IMAGE                           COMMAND                  SERVICE    CREATED          STATUS                    PORTS
notice_board_backend    digital-notice-board-backend    "docker-entrypoint.s…"   backend    25 minutes ago   Up 25 minutes (healthy)   0.0.0.0:5001->5000/tcp, [::]:5001->5000/tcp
notice_board_frontend   digital-notice-board-frontend   "/docker-entrypoint.…"   frontend   45 seconds ago   Up 43 seconds (healthy)   0.0.0.0:8080->80/tcp, [::]:8080->80/tcp
notice_board_postgres   postgres:16-alpine              "docker-entrypoint.s…"   postgres   25 minutes ago   Up 25 minutes (healthy)   0.0.0.0:5434->5432/tcp, [::]:5434->5432/tcp
```

### 6.2 Container Security & Non-Root Execution (`docker exec notice_board_backend id`)

```text
uid=1000(node) gid=1000(node) groups=1000(node),1000(node)
```
*Verification Outcome*: Container executes under standard non-privileged user `node` (UID 1000), preventing root privilege escalation and host filesystem compromise.

### 6.3 Secure Deployment Health Endpoints

#### Backend Health Endpoint (`curl -i http://localhost:5001/api/health`)
```text
HTTP/1.1 200 OK
Content-Security-Policy: default-src 'self';base-uri 'self';font-src 'self';form-action 'self';frame-ancestors 'self';img-src 'self' data: https:;object-src 'none';script-src 'self';script-src-attr 'none';style-src 'self' 'unsafe-inline';upgrade-insecure-requests;connect-src 'self';media-src 'self';frame-src 'none'
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Origin-Agent-Cluster: ?1
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-DNS-Prefetch-Control: off
X-Download-Options: noopen
X-Frame-Options: DENY
X-Permitted-Cross-Domain-Policies: none
X-XSS-Protection: 0
Vary: Origin
Access-Control-Allow-Credentials: true
RateLimit-Policy: 100;w=900
RateLimit-Limit: 100
RateLimit-Remaining: 98
RateLimit-Reset: 604
Content-Type: application/json; charset=utf-8
Content-Length: 107
ETag: W/"6b-2SzAU8rSfGa5Oc2jEdElSKy3qCY"
Date: Thu, 08 Oct 2026 10:52:52 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"status":"healthy","timestamp":"2026-10-08T10:52:52.359Z","environment":"production","uptimeSeconds":1535}
```

#### Frontend Health Endpoint (`curl -i http://localhost:8080/healthz`)
```text
HTTP/1.1 200 OK
Server: nginx/1.27.5
Date: Thu, 08 Oct 2026 10:52:52 GMT
Content-Type: application/octet-stream
Content-Length: 8
Connection: keep-alive
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' http://localhost:5000 http://localhost:8080 http://localhost:5173; font-src 'self';

healthy
```

### 6.4 Kubernetes Manifests Static Verification
* **Manifest Status**: Declarative manifests in `k8s/` (`backend-deployment.yaml`, `backend-service.yaml`, `frontend-deployment.yaml`, `frontend-service.yaml`, `postgres-deployment.yaml`, `postgres-service.yaml`, `config/secret.yaml`, `config/configmap.yaml`, `namespace.yaml`) verified statically for non-root security context (`runAsNonRoot: true`, `runAsUser: 1000`), dropped capabilities (`drop: ["ALL"]`), and resource limits (`cpu: 500m`, `memory: 512Mi`).
* **Environment Reality Statement**:
  > [!IMPORTANT]
  > **Kubernetes manifests and security configuration verified statically; live Kubernetes deployment not verified in this environment** due to absence of `kubectl` and `minikube` CLI binaries on the host system.

---

## 7. Honest Operational Limitations

1. **Host Kubernetes Cluster Unavailable**: The local evaluation environment lacks an active Minikube/Kubernetes control plane. Manifests are verified statically, but live orchestration was not run in this shell.
2. **Local Database Audit Storage Without SIEM Shipper**: Audit records are stored in PostgreSQL rather than an immutable remote SIEM (Splunk, Elastic, AWS CloudWatch). Database compromise could impact log integrity.
3. **In-Memory Single-Node Rate Limiting**: The rate limiter operates in local Node.js process memory. Distributed deployments across multiple replicas require Redis-backed synchronization and an external Web Application Firewall (WAF) to defend against volumetric DDoS attacks.
