# Phase 12 — Secure Coding and Refactoring

**Project:** Secure Digital Notice Board  
**Target Module:** Notice Management & Horizontal Access Control (`backend/src/modules/notices/`)  
**Architecture Pattern:** Controller → Service → Repository → Database → Audit Trail  

---

## 1. Module Selected

The **Notice Management and Authorization Module** (`backend/src/modules/notices/`) was selected for refactoring. 

### Characteristics of the Selected Module:
* **Functionality**: Manages collegiate announcements through their complete lifecycle (`DRAFT` → `SCHEDULED` → `PUBLISHED` → `ARCHIVED`).
* **Interacting Actors**: 
  - `STUDENT`: Read-only queries of currently published notices.
  - `FACULTY`: Creation, modification, deletion, and scheduling of notices authored by themselves.
  - `ADMIN`: Global governance, moderation, and override of any notice.
* **Security-Sensitive Operations**: Horizontal privilege checks (`assertNoticeOwnership`), dynamic role-based query filtering, and automatic security event auditing.
* **Key Files**:
  - `backend/src/modules/notices/notices.controller.ts`
  - `backend/src/modules/notices/notices.service.ts`
  - `backend/src/modules/notices/notices.repository.ts`
  - `backend/src/modules/notices/notices.schema.ts`
  - `backend/src/modules/notices/notices.routes.ts`

---

## 2. Initial Security/Code-Quality Weaknesses

From the initial project repository commit (`6346607`), two genuine architectural and security weaknesses were identified in `backend/src/modules/notices/notices.service.ts`:

### Weakness 1: Direct SQL Execution and Coupling inside the Business Logic Layer
* **Initial State**: `NoticesService` directly imported the PostgreSQL database connection pool (`import { query } from '../../db/pool.js'`) and embedded raw SQL query strings (`INSERT INTO notices`, `UPDATE notices`, `SELECT * FROM notices`, `DELETE FROM notices`) across all service methods.
* **Why it was Insecure & Poor Maintainability**:
  - Violation of Single Responsibility: Business rules, lifecycle state machine updates, and SQL data access were mixed in a single monolithic service file.
  - Verification Burden: Auditing queries for parameterized SQL safety was difficult because query assembly was scattered across business logic branches.
  - Testability: Unit testing service rules in isolation was impossible without spinning up a live PostgreSQL database.

### Weakness 2: Duplicated & Inconsistent Horizontal Ownership Checks
* **Initial State**: The logic verifying that a faculty member only alters or deletes notices they authored was duplicated across both `updateNotice` and `deleteNotice` methods. Each method separately checked:
  ```typescript
  // updateNotice (commit 6346607):
  if (user.role === 'FACULTY' && notice.author_id !== user.id) {
    await AuditService.record({ ... reason: 'HORIZONTAL_AUTHORIZATION_VIOLATION' });
    throw new Error('Forbidden: You can only modify notices authored by yourself');
  }

  // deleteNotice (commit 6346607):
  if (user.role === 'FACULTY' && notice.author_id !== user.id) {
    await AuditService.record({ ... reason: 'HORIZONTAL_AUTHORIZATION_DELETE_VIOLATION' });
    throw new Error('Forbidden: You can only delete notices authored by yourself');
  }
  ```
* **Why it was Insecure & Poor Maintainability**:
  - Violation of DRY (Don't Repeat Yourself): Inconsistent audit metadata reasons (`HORIZONTAL_AUTHORIZATION_VIOLATION` vs `HORIZONTAL_AUTHORIZATION_DELETE_VIOLATION`) and disparate error messages.
  - Risk of Security Drift: Future mutation endpoints (e.g. batch archiving or scheduling) risked omitting or weakening the ownership check.

---

## 3. Before/After Refactoring

### Concise Before/After Comparison

| Issue | Before (Commit `6346607`) | After (Refactored) | Security Improvement | Maintainability Improvement |
| :--- | :--- | :--- | :--- | :--- |
| **Data Access Coupling** | `NoticesService` executed raw SQL queries directly via `query()`. | Extracted dedicated `NoticesRepository` (`notices.repository.ts`). | Centralizes query construction; isolates database boundary. | Decouples business logic from persistence; simplifies testing. |
| **Ownership Authorization** | Duplicated `if (user.role === 'FACULTY' && notice.author_id !== user.id)` checks in `updateNotice` and `deleteNotice`. | Centralized helper `assertNoticeOwnership(notice, user, action, meta)`. | Single authoritative routine for SR-04; eliminates authorization bypass risks. | DRY compliance; unified audit log generation and error codes. |

### Code Comparison

#### Before: Duplicated Ownership Verification in Service Methods
```typescript
// Initial commit 6346607: backend/src/modules/notices/notices.service.ts
static async updateNotice(id: string, data: any, user: AuthUser, meta: any) {
  const existing = await query('SELECT * FROM notices WHERE id = $1', [id]);
  // ...
  if (user.role === 'FACULTY' && notice.author_id !== user.id) {
    await AuditService.record({ ... });
    throw new Error('Forbidden: You can only modify notices authored by yourself');
  }
  // ...
}
```

#### After: Centralized Ownership Assertion and Repository Delegation
```typescript
// Refactored: backend/src/modules/notices/notices.service.ts
export class NoticesService {
  private static async assertNoticeOwnership(
    notice: Notice,
    user: AuthUser,
    action: string,
    meta: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    if (user.role === 'ADMIN') return;

    if (user.role === 'FACULTY' && notice.author_id !== user.id) {
      await AuditService.record({
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'UNAUTHORIZED_ACCESS',
        resourceType: 'NOTICE',
        resourceId: notice.id,
        status: 'FAILURE',
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: {
          reason: 'HORIZONTAL_AUTHORIZATION_VIOLATION',
          attemptedAction: action,
          targetNoticeAuthorId: notice.author_id,
          attemptedByUserId: user.id,
        },
      });

      const error: any = new Error(
        `Forbidden: You can only ${action.toLowerCase()} notices authored by yourself`
      );
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }
  }

  static async updateNotice(id: string, data: any, user: AuthUser, meta: any) {
    const existing = await NoticesRepository.findById(id);
    if (!existing) throw new NotFoundError();

    await this.assertNoticeOwnership(existing, user, 'MODIFY', meta);
    return NoticesRepository.update(id, ...);
  }
}
```

---

## 4. Input Validation

Input validation is enforced at the route boundary via `validateRequest` middleware and Zod schemas in `backend/src/modules/notices/notices.schema.ts`.

### Validation Path:
```
HTTP Request
  ↓
validateRequest({ body: createNoticeSchema, query: queryNoticeSchema })
  ↓
Zod Parsing & Type Coercion
  ↓
NoticesController
  ↓
NoticesService
  ↓
NoticesRepository
  ↓
PostgreSQL Database
```

### Protection Enforced:
1. **Missing Required Fields**: `title`, `content`, `department`, `category` are strictly required on creation.
2. **Incorrect Data Types**: Non-string fields or improper types are rejected immediately.
3. **Invalid Enum Values**:
   - `department`: Restrained to `['CSE', 'CYS', 'ECE', 'EEE', 'ME', 'General']`.
   - `category`: Restrained to `['Academic', 'Examination', 'Placement', 'Event', 'Workshop', 'Holiday', 'Emergency', 'General']`.
   - `priority`: Restrained to `['Normal', 'Important', 'Urgent']`.
   - `status`: Restrained to `['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']`.
4. **Boundary & Length Protection**:
   - `title`: `z.string().trim().min(3).max(200)`
   - `content`: `z.string().trim().min(5).max(10000)`
5. **Temporal Logic Validation**:
   - Refinement rule enforces: `expires_at > scheduled_at`. Expiry dates preceding scheduled publication dates are rejected with HTTP 400.
6. **Null-Byte Sanitization**:
   - Search query strings sanitize embedded null bytes (`\0`) via `.transform((val) => val.replace(/\0/g, ''))`, preventing PostgreSQL byte sequence errors (`DEF-01`).

---

## 5. Authorization

The application enforces a two-tier defense-in-depth authorization model:

### 5.1 Vertical RBAC (`backend/src/middleware/auth.ts`)
* `authorize(...allowedRoles)` middleware validates `req.user.role`.
* Students attempting to call `POST /api/notices`, `PUT /api/notices/:id`, or `DELETE /api/notices/:id` receive HTTP 403 Forbidden.
* Attempt is logged with `action: UNAUTHORIZED_ACCESS`.

### 5.2 Horizontal Object-Level Authorization (`assertNoticeOwnership`)
* When an authenticated faculty member accesses `PUT /api/notices/:id` or `DELETE /api/notices/:id`:
  - The notice is retrieved via `NoticesRepository.findById(id)`.
  - `assertNoticeOwnership` checks:
    ```typescript
    if (user.role === 'FACULTY' && notice.author_id !== user.id)
    ```
  - If IDs mismatch: returns **HTTP 403 Forbidden** and logs an immutable audit failure with actor details.
* `ADMIN` role is granted global override capability.

---

## 6. Error Handling

Centralized error handling in `backend/src/middleware/errorHandler.ts` and controller try/catch wrappers guarantee safe error processing:

1. **Client-Side Errors (4xx)**:
   - Validation failure: HTTP 400 (`VALIDATION_ERROR`) with structured field-level errors.
   - Missing/invalid authentication: HTTP 401 (`UNAUTHORIZED` or `INVALID_TOKEN`).
   - Unauthorized access / horizontal tampering: HTTP 403 (`FORBIDDEN`).
   - Resource not found: HTTP 404 (`NOT_FOUND`).
   - Payload exceeding 100KB: HTTP 413 (`PAYLOAD_TOO_LARGE`).
2. **Server-Side Errors (500)**:
   - Full diagnostic stack trace is logged strictly to server console/logs.
   - External HTTP response sanitizes internal error details to:
     ```json
     {
       "success": false,
       "error": {
         "code": "INTERNAL_SERVER_ERROR",
         "message": "An unexpected internal error occurred. Please contact system administrator."
       }
     }
     ```
   - Database table names, SQL syntax errors, and stack traces are never exposed to clients.

---

## 7. Sensitive Data Handling

1. **Passwords**: Stored exclusively as bcrypt hashes (work factor 10); never stored in plaintext.
2. **API Payloads**: `password_hash` column is explicitly excluded when returning user data to clients.
3. **Audit Log Scrubbing**: `AuditService.record()` strips sensitive fields (`password`, `token`, `secret`, `authorization`) before inserting metadata into `audit_logs`.
4. **JWT Secrets**: Loaded dynamically from `env.JWT_SECRET` (validated to be ≥ 32 characters by Zod); never committed to repository.

---

## 8. Parameterized Database Access

All queries executed by `NoticesRepository` utilize parameterized SQL placeholders (`$1, $2, ...`):

```typescript
// backend/src/modules/notices/notices.repository.ts
static async findById(id: string): Promise<Notice | null> {
  const result = await query(
    `
    SELECT n.*, u.full_name as author_name, u.email as author_email
    FROM notices n
    LEFT JOIN users u ON n.author_id = u.id
    WHERE n.id = $1;
    `,
    [id]
  );
  return result.rows[0] || null;
}
```

### Security Justification:
* By separating query structure from user input via `$1, $2, ...`, PostgreSQL parses the query plan before data binding.
* User input strings (such as `' OR '1'='1` or `'; DROP TABLE notices; --`) are treated purely as literal scalar values, completely neutralizing SQL Injection (CWE-89).

---

## 9. Security Tests

The refactored module was evaluated against 5 mandatory security test scenarios:

| # | Test Scenario | Expected Result | Actual Result | Status | Security Property Demonstrated |
|:---:|:---|:---:|:---:|:---:|:---|
| **1** | Unauthenticated `GET /api/notices` | HTTP 401 | HTTP 401 | **PASS** | Authentication required; token validation enforced. |
| **2** | Authorized notice creation by Faculty | HTTP 201 | HTTP 201 | **PASS** | Valid credentials allow authorized notice creation. |
| **3** | Student attempting `POST /api/notices` | HTTP 403 | HTTP 403 | **PASS** | Vertical RBAC blocks unauthorized student operations. |
| **4** | Faculty A attempting `PUT /api/notices/:id` of Faculty B | HTTP 403 | HTTP 403 | **PASS** | Horizontal authorization (SR-04) prevents peer tampering. |
| **5** | Invalid schema payload (Title < 3 chars) | HTTP 400 | HTTP 400 | **PASS** | Zod input boundary validation blocks malformed requests. |

---

## 10. Security Justification

1. **Defense-in-Depth**: Security is enforced at multiple decoupled layers: Route middleware (RBAC) → Controller/Schema (Input Validation) → Service (Horizontal Ownership & Business Logic) → Repository (Parameterized SQL).
2. **Auditability & Non-Repudiation**: Every unauthorized access attempt triggers an immutable audit log entry capturing user ID, IP address, user agent, and attempted action.
3. **Resilience to Code Drift**: Extracting ownership logic into `assertNoticeOwnership` ensures that any future notice management features can reuse a single audited authorization routine.

---

## 11. Evidence/Screenshots

Command outputs and evidence verifying the refactored module:
* Automated test suite execution: `npm test` passed 16/16 tests in 1.4s.
* Direct 5-case security probe: verified HTTP 401, 201, 403, 403, 400 status codes.
* Audit trail query: verified `UNAUTHORIZED_ACCESS` log entry with `HORIZONTAL_AUTHORIZATION_VIOLATION` metadata.
