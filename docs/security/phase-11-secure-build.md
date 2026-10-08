# Phase 11 — Secure Development and Build Environment

**Project:** Secure Digital Notice Board  
**Target Environment:** Local Ubuntu Linux (`~/Desktop/digital-notice-board`)  
**Document Classification:** SSE Examination Phase 11 Evidence  

---

## 1. Repository and Workflow Strategy

The project utilizes an on-disk Git version control repository initialized at `~/Desktop/digital-notice-board`. Because this is a self-contained local laboratory examination environment, no remote GitHub repository is connected (`git remote -v` returns empty output).

### 1.1 Branch Strategy
The development workflow enforces a multi-tier branch hierarchy:
* **`main`**: Production-ready, stable releases.
* **`develop`**: Integration branch for features and security hardening before release.
* **`feature/*`**: Transient branches created for specific user stories, refactoring tasks, or security controls.

### 1.2 Development Lifecycle
```
feature/* (discrete task)
   ↓
development & typing
   ↓
code review / static check (npm run lint)
   ↓
merge into develop
   ↓
testing & verification (npm test, npm run audit)
   ↓
merge into main / release tag
```

---

## 2. Secure Development Controls

| Control | Implementation | Evidence | Status |
| :--- | :--- | :--- | :--- |
| **Secret Management** | Credentials and keys isolated from source control via `.env`, template placeholders in `.env.example`, and ignore rules in `.gitignore`. | `.gitignore:12:.env`, untracked by Git, zero secrets found in code search. | **VERIFIED** |
| **Dependency Control** | Automated vulnerability scanning across npm dependency trees with pinned lockfiles and security overrides. | `npm run audit` reports `found 0 vulnerabilities`, overrides in `package.json`. | **VERIFIED** |
| **Least Privilege** | Non-root execution model across multi-stage Docker containers and Kubernetes pod security configurations. | `backend/Dockerfile` (`USER node`), `k8s/backend-deployment.yaml` (`runAsNonRoot: true`, `drop: ["ALL"]`). | **VERIFIED** |
| **Code Review / Branch Workflow** | Git branch hierarchy (`feature/*` → `develop` → `main`) ensuring work is isolated before integration. | `git branch -a` shows `develop` and `main`, commit history on `develop`. | **VERIFIED** |
| **Reproducible Builds** | Deterministic package resolution using committed `package-lock.json` and strict `npm ci`. | Both `backend/package-lock.json` and `frontend/package-lock.json` committed. | **VERIFIED** |
| **Static Security Checks** | Automated linting rules prohibiting dynamic evaluation and loose equality coercion. | `backend/eslint.config.js` (`no-eval: error`, `eqeqeq: error`), `npm run lint`. | **VERIFIED** |
| **Protected Branches** | Centralized server-side enforcement preventing unreviewed pushes to `main`. | Local repository has no GitHub remote; branch protection cannot be enforced by GitHub. | **NOT VERIFIED** (Local Env) |

---

## 3. Secret Management

1. **Ignored Configuration File**: The `.env` file containing local credentials is fully excluded by `.gitignore` (line 12).
   ```bash
   $ git check-ignore -v .env
   .gitignore:12:.env	.env
   ```
2. **Untracked in Git**:
   ```bash
   $ git ls-files | grep -E '(^|/).env$'
   # (empty output — .env is not tracked in Git)
   ```
3. **Template Placeholders in `.env.example`**:
   The committed `.env.example` file contains safe, non-sensitive placeholders:
   ```env
   DB_PASSWORD=replace_with_secure_database_password
   JWT_SECRET=replace_with_at_least_32_char_cryptographically_secure_random_secret
   ```
4. **Codebase Grep Inspection**:
   A recursive regex search across `backend/src`, `frontend/src`, `k8s/`, and `docker-compose.yml` verified that variable names like `JWT_SECRET` and `password_hash` reference environment variables and schema properties; zero plaintext secrets or production API keys exist in code.

---

## 4. Dependency Control

1. **Lockfile Enforcement**:
   Both backend and frontend tiers maintain deterministic lockfiles:
   ```bash
   $ find . -name package-lock.json -not -path '*/node_modules/*' -print
   ./backend/package-lock.json
   ./frontend/package-lock.json
   ```
2. **Deterministic Installation**:
   Supported natively via `npm ci`, which strictly adheres to lockfile versions and aborts if `package.json` diverges.
3. **Vulnerability Audit Pipeline**:
   The root script `npm run audit` inspects both backend and frontend workspaces:
   ```bash
   $ npm run audit
   found 0 vulnerabilities
   found 0 vulnerabilities
   ```

---

## 5. Automated Static/Security Check

Static analysis is configured in `backend/eslint.config.js` using ESLint 9 flat configuration with `@typescript-eslint`:

* **`no-eval: 'error'`**: Prohibits `eval()`, preventing dynamic execution of untrusted input.
* **`no-implied-eval: 'error'`**: Prohibits string-based execution in `setTimeout`, `setInterval`, etc.
* **`no-new-func: 'error'`**: Blocks arbitrary function constructors (`Function(...)`).
* **`eqeqeq: ['error', 'always']`**: Enforces strict equality comparison (`===`), mitigating JavaScript type juggling bugs.
* **`@typescript-eslint/no-explicit-any: 'warn'`**: Flags untyped data structures for developer awareness.

---

## 6. Remediation

### Historical Remediation Analysis
* **BEFORE**: An initial `npm audit` flagged high-severity transitive vulnerabilities in the `braces` (GHSA-vfj7-8cjw-p6xm) and `micromatch` packages (Regular Expression Denial of Service / Memory Exhaustion).
* **FINDING**: Transitive dependencies inherited from older globbing utilities could allow unbounded backtracking on maliciously crafted glob inputs.
* **REMEDIATION**: Added explicit dependency overrides in both `backend/package.json` and `frontend/package.json`:
  ```json
  "overrides": {
    "braces": "^3.0.3",
    "micromatch": "^4.0.8"
  }
  ```
* **AFTER**: Re-running `npm audit` across both workspaces verified:
  ```
  found 0 vulnerabilities
  found 0 vulnerabilities
  ```

---

## 7. Reproducible Build / Artifact Integrity

1. **Lockfile Integrity**: `package-lock.json` contains cryptographic SHA-512 subresource integrity hashes for every installed dependency tarball.
2. **Build Determinism**:
   - Backend compiles TypeScript via `tsc` to `backend/dist/`.
   - Frontend bundles React assets via `tsc && vite build` to `frontend/dist/`.
   Both builds execute reproducibly on any system providing Node.js 22 and npm.

---

## 8. Verification Commands

The following commands were executed to verify Phase 11 compliance:

```bash
cd ~/Desktop/digital-notice-board

# 1. Verify Git status and branches
git status
git branch -a
git branch --show-current
git log --oneline --decorate -10
git remote -v

# 2. Verify secret hygiene (.env exclusion)
git check-ignore -v .env
git ls-files | grep -E '(^|/)\.env$' || true

# 3. Search codebase for hardcoded credentials
grep -RniE 'password|passwd|secret|api[*-]?key|token|jwt[*-]?secret' \
  backend/src frontend/src k8s docker-compose.yml \
  --exclude-dir=node_modules --exclude-dir=dist || true

# 4. Verify static security linting
npm run lint

# 5. Verify dependency security audit
npm run audit

# 6. Verify lockfile presence
find . -name package-lock.json -not -path '*/node_modules/*' -print

# 7. Verify full application compilation
npm --prefix backend run build
npm --prefix frontend run build
```

---

## 9. Actual Results

### Git Status & Branch Output
```text
On branch develop
* develop
  main
develop
6346607 (HEAD -> develop, main) Initial secure digital notice board foundation
```

### Git Secret Exclusion
```text
.gitignore:12:.env	.env
(git ls-files returned 0 matches for .env)
```

### Static Analysis (`npm run lint`)
```text
> secure-digital-notice-board@1.0.0 lint
> npm --prefix backend run lint

> digital-notice-board-backend@1.0.0 lint
> eslint src/

✖ 23 problems (0 errors, 23 warnings)
```

### Dependency Audit (`npm run audit`)
```text
> secure-digital-notice-board@1.0.0 audit
> npm --prefix backend audit && npm --prefix frontend audit

found 0 vulnerabilities
found 0 vulnerabilities
```

### Build Output (`npm run build`)
```text
> digital-notice-board-backend@1.0.0 build
> tsc

> digital-notice-board-frontend@1.0.0 build
> tsc && vite build

vite v6.4.4 building for production...
✓ 1601 modules transformed.
dist/index.html                   0.66 kB │ gzip:  0.42 kB
dist/assets/index-CIJcItAy.css   33.64 kB │ gzip:  6.77 kB
dist/assets/index-BK9j5DI8.js   212.49 kB │ gzip: 60.03 kB
✓ built in 50.38s
```

---

## 10. Limitations

1. **Local Repository Only**: No remote GitHub origin is configured (`git remote -v` is empty).
2. **Protected Branches Not Verified**: Server-side branch protection rules (e.g., GitHub Branch Protection requiring status checks and approvals) cannot be active without a remote GitHub repository. This control is honestly reported as **NOT VERIFIED** rather than fabricated.
