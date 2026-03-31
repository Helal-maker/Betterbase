# Betterbase Security & Code Quality Review

**Version**: 1.0  
**Date**: 2026-03-31  
**Status**: Critical Issues Found

---

## Executive Summary

This document provides a comprehensive security analysis and code quality review of the Betterbase project. The analysis identified **7 critical security vulnerabilities**, **3 incomplete features**, and **significant code quality issues** that require immediate attention.

| Priority | Count | Description |
|----------|-------|-------------|
| Critical | 7 | Security vulnerabilities requiring immediate fix |
| High | 6 | Significant issues affecting production readiness |
| Medium | 5 | Code quality and incomplete features |
| Low | 3 | Code hygiene and testing improvements |

---

## 1. Critical Security Vulnerabilities

### 1.1 Authentication Bypass in Auth Template

**Severity**: CRITICAL  
**Location**: `templates/auth/src/routes/auth.ts`  
**Lines**: 70, 135, 197, 221, 246, 322

#### Issue Description

The auth template has 12+ incomplete implementations that completely bypass authentication in both development and production modes.

#### Affected Endpoints

| Line | Endpoint | Bypass Method |
|------|----------|---------------|
| 70 | `GET /magic-link/verify` | Accepts any token starting with `dev-token-` |
| 135 | `POST /otp/verify` | Accepts ANY 6-digit code |
| 197 | `POST /mfa/verify` | Same bypass |
| 221 | `POST /mfa/disable` | Same bypass |
| 246 | `POST /mfa/challenge` | Same bypass |
| 322 | `POST /phone/verify` | Same bypass |

#### Vulnerable Code (Line 135)

```typescript
// In templates/auth/src/routes/auth.ts:135
if (process.env.NODE_ENV === "development" || code.length === 6) {
  // Creates session without verifying OTP
  const sessionId = crypto.randomUUID();
  return c.json({
    token: sessionId,
    user: { id: "otp-user-id", email, name: "OTP User" },
  });
}
```

#### Root Cause

The condition `code.length === 6` is redundant because the Zod schema at line 16 already validates:
```typescript
const otpVerifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6, "OTP must be 6 digits"),
});
```

This means **production accepts any 6-digit code** as valid authentication.

#### Impact

- Complete authentication bypass in production
- Anyone can access any user account with any 6-digit code
- MFA endpoints are completely non-functional

#### Remediation

1. Remove the `|| code.length === 6` condition entirely
2. Implement proper OTP verification with database lookup
3. Add time-based expiry check (10 minutes)
4. Store hashed OTP codes in database

#### Recommended Fix

```typescript
authRoute.post("/otp/verify", async (c) => {
  // ... validation ...
  const { email, code } = result.data;
  
  // TODO: Verify OTP from database with expiry check
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM otp_codes 
     WHERE email = $1 AND code = $2 AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [email, code]
  );
  
  if (rows.length === 0) {
    return c.json({ error: "Invalid or expired OTP" }, 401);
  }
  
  // Delete used OTP
  await pool.query("DELETE FROM otp_codes WHERE id = $1", [rows[0].id]);
  
  // Create session...
});
```

---

### 1.2 No Rate Limiting on Admin Login

**Severity**: CRITICAL  
**Location**: `packages/server/src/routes/admin/auth.ts:15-45`

#### Issue Description

The admin login endpoint has no rate limiting or brute-force protection.

#### Vulnerable Code

```typescript
// In packages/server/src/routes/admin/auth.ts
authRoutes.post(
  "/login",
  zValidator("json", z.object({
    email: z.string().email(),
    password: z.string().min(1),
  })),
  async (c) => {
    const { email, password } = c.req.valid("json");
    // No rate limiting - attacker can brute force
    const valid = await verifyPassword(password, admin.password_hash);
  }
);
```

#### Impact

- Vulnerable to brute-force attacks
- No account lockout after failed attempts
- Attackers can try unlimited passwords

#### Remediation

Add rate limiting middleware:

```typescript
import { rateLimit } from "hono-rate-limit";

authRoutes.post(
  "/login",
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    keyGenerator: (c) => c.req.header("X-Real-IP") ?? "unknown",
  }),
  // ... rest of handler
);
```

---

### 1.3 Unauthenticated WebSocket Connections

**Severity**: CRITICAL  
**Location**: `packages/server/src/routes/betterbase/ws.ts:142-147`

#### Issue Description

WebSocket connections don't require authentication, allowing anyone to connect to any project's realtime stream.

#### Vulnerable Code

```typescript
// In packages/server/src/routes/betterbase/ws.ts:142-147
export function getBunServeConfig() {
  return {
    fetch(req: Request, server: any) {
      const url = new URL(req.url);
      if (url.pathname === "/betterbase/ws") {
        const projectSlug = url.searchParams.get("project") ?? "default";
        // No authentication check
        const upgraded = server.upgrade(req, { data: { projectSlug } });
      }
    },
  };
}
```

#### Impact

- Anyone can subscribe to any project's data changes
- No authorization on which project to connect to
- Potential data leakage through realtime updates

#### Remediation

Add authentication validation:

```typescript
if (url.pathname === "/betterbase/ws") {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }
  
  const payload = await verifyAdminToken(token);
  if (!payload) {
    return new Response("Invalid token", { status: 401 });
  }
  
  const projectSlug = url.searchParams.get("project") ?? "default";
  // Verify user has access to this project
  // ...
}
```

---

### 1.4 Hardcoded Default Credentials

**Severity**: CRITICAL  
**Location**: `packages/server/src/routes/betterbase/index.ts:191-192`

#### Issue Description

Default S3 credentials are hardcoded as fallback.

#### Vulnerable Code

```typescript
const s3 = new S3Client({
  endpoint: env.STORAGE_ENDPOINT ?? "http://minio:9000",
  region: "us-east-1",
  credentials: {
    accessKeyId: env.STORAGE_ACCESS_KEY ?? "minioadmin",
    secretAccessKey: env.STORAGE_SECRET_KEY ?? "minioadmin",
  },
  forcePathStyle: true,
});
```

#### Impact

- If env vars aren't set, known default credentials are used
- Attackers can access MinIO storage if they discover the endpoint

#### Remediation

```typescript
if (!env.STORAGE_ACCESS_KEY || !env.STORAGE_SECRET_KEY) {
  throw new Error("STORAGE_ACCESS_KEY and STORAGE_SECRET_KEY must be set");
}
```

---

### 1.5 No CSRF Protection

**Severity**: HIGH  
**Location**: `packages/server/src/index.ts:52-60`

#### Issue Description

CORS is configured but there's no CSRF token validation for state-changing operations.

#### Current Configuration

```typescript
app.use(
  "*",
  cors({
    origin: env.CORS_ORIGINS.split(","),
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);
```

#### Impact

- Cross-site request forgery attacks possible
- Attackers can make authenticated requests on behalf of users

#### Remediation

Add CSRF middleware with double-submit cookie pattern.

---

### 1.6 Excessive JWT Token Expiry

**Severity**: HIGH  
**Location**: `packages/server/src/lib/auth.ts:7`

#### Issue Description

Admin JWT tokens expire after 30 days.

```typescript
const TOKEN_EXPIRY = "30d";
```

#### Impact

- If token is compromised, attackers have ~month of access
- Violates security best practices (tokens should be short-lived)

#### Remediation

- Reduce to 7 days for admin tokens
- Implement refresh token mechanism
- Use shorter expiry (1-24 hours) for sensitive operations

---

### 1.7 Input Validation Gaps

**Severity**: HIGH  
**Location**: `packages/server/src/routes/betterbase/index.ts:180`

#### Issue Description

Filename parameter not validated - potential path traversal.

```typescript
const { contentType, filename } = await c.req.json();
const ext = filename?.split(".").pop() ?? "";
const s3Key = `project_${projectSlug}/${storageId}${ext ? "." + ext : ""}`;
```

#### Impact

- Path traversal attacks possible (e.g., `../../etc/passwd`)
- No sanitization of file extension

#### Remediation

```typescript
const { contentType, filename } = await c.req.json();

// Validate filename
if (filename && !/^[a-zA-Z0-9_.-]+$/.test(filename)) {
  return c.json({ error: "Invalid filename" }, 400);
}

const ext = filename?.split(".").pop() ?? "";
if (ext && !/^[a-zA-Z0-9]{1,10}$/.test(ext)) {
  return c.json({ error: "Invalid file extension" }, 400);
}
```

---

## 2. Incomplete Features

### 2.1 GraphQL Subscriptions Not Implemented

**Status**: INCOMPLETE  
**Location**: `packages/core/src/graphql/resolvers.ts:505-546`

#### Description

GraphQL subscriptions are marked as Phase 6 and return empty iterators.

```typescript
resolvers.Subscription![`${tableName}Created`] = {
  subscribe: () => {
    // Subscriptions require realtime layer (Phase 6)
    return {
      [Symbol.asyncIterator]() {
        return this;
      },
      async next() {
        return { done: true, value: undefined };
      },
    };
  },
} as unknown as GraphQLResolver;
```

#### Impact

- GraphQL subscriptions don't work
- Clients waiting for realtime updates will hang indefinitely

#### Required Work

Implement subscriptions using the existing WebSocket infrastructure in `packages/server/src/routes/betterbase/ws.ts`.

---

### 2.2 RLS Role-Based Policies Not Implemented

**Status**: INCOMPLETE  
**Location**: `packages/core/src/rls/evaluator.ts:57-66`

#### Description

The `auth.role()` check always returns `false`.

```typescript
const roleMatch = policyExpression.match(/auth\.role\(\)\s*=\s*'([^']+)'/);
if (roleMatch) {
  const requiredRole = roleMatch[1];
  // In a full implementation, we'd get the user's role from the session
  return false; // Deny by default if role check not implemented
}
```

#### Impact

- Role-based access control doesn't work
- Admin/editor/viewer roles cannot be enforced

#### Required Work

Implement role retrieval from session and proper evaluation.

---

### 2.3 Auth Template TODOs

**Status**: INCOMPLETE  
**Location**: `templates/auth/src/routes/auth.ts`

#### List of Incomplete Implementations

| Line | Feature | Description |
|------|---------|-------------|
| 57 | Magic Link API | Use better-auth's magic link API |
| 68 | Token Verification | Implement proper token verification |
| 113 | OTP Storage | Store OTP in database with expiry |
| 133 | OTP Verification | Verify OTP from database |
| 166 | MFA Enable | Use better-auth twoFactor plugin |
| 195 | MFA Verification | Verify TOTP code using better-auth |
| 220 | MFA Disable | Disable MFA using better-auth |
| 244 | MFA Challenge | Verify TOTP and return session |
| 298 | Phone OTP Storage | Store hashed code with 10-min expiry |
| 299 | Twilio Integration | Send SMS via Twilio in production |
| 320 | Phone Verification | Verify code with expiry check |

#### Impact

- Auth template is not production-ready
- Only works in development mode

---

## 3. Code Quality Issues

### 3.1 Excessive `any` Type Usage

**Severity**: MEDIUM  
**Count**: 327+ occurrences

#### Examples

| Location | Line | Usage |
|----------|------|-------|
| `packages/server/src/routes/betterbase/index.ts` | 43 | `(fn.handler as any)._args` |
| `packages/server/src/routes/betterbase/ws.ts` | 24 | `open(ws: any)` |
| `packages/core/src/iac/db-context.ts` | 60 | `params as any[]` |

#### Remediation

Define proper TypeScript types for all function signatures and handlers.

---

### 3.2 Console Logging in Production

**Severity**: MEDIUM  
**Count**: 369+ occurrences

#### Examples

```typescript
// packages/server/src/index.ts:89
console.error("[error]", err);

// packages/core/src/rls/evaluator.ts:69
console.warn(`[RLS] Unknown policy expression: ${policyExpression}`);
```

#### Remediation

Replace with structured logger (pino or similar):

```typescript
import { logger } from "./lib/logger";

logger.error({ err }, "Request failed");
```

---

### 3.3 Placeholder Tests

**Severity**: LOW  
**Count**: 10+ test files with no real tests

#### Examples

```typescript
// packages/core/test/realtime-channel-manager.test.ts
it("should subscribe to channels", () => {
  expect(true).toBe(true); // Placeholder
});
```

#### Remediation

Implement actual test coverage for:
- `realtime-channel-manager.test.ts`
- `subscription-tracker.ts` tests
- `invalidation-manager.ts` tests

---

## 4. Testing Gaps

### 4.1 Missing Test Coverage

| Module | Status | Notes |
|--------|--------|-------|
| WebSocket handler | NO TESTS | `packages/server/src/routes/betterbase/ws.ts` |
| IaC route handler | NO TESTS | `packages/server/src/routes/betterbase/index.ts` |
| Subscription tracker | NO TESTS | Core realtime component |
| Invalidation manager | NO TESTS | Core realtime component |
| Storage context | NO TESTS | `packages/core/src/iac/storage/storage-ctx.ts` |

### 4.2 Integration Tests Missing

No end-to-end tests for:
- Full IaC pipeline (schema → function registry → route handler)
- WebSocket realtime subscriptions
- Auth flow with real database

---

## 5. Security Best Practices

### 5.1 SQL Injection Risk

**Location**: `packages/core/src/iac/db-context.ts:105`

```typescript
const embeddingStr = `[${embedding.join(",")}]`;
const { rows } = await this._pool.query(sql, [embeddingStr]);
```

While the embedding is passed as a parameter, the SQL construction should be reviewed to ensure no injection is possible through complex queries.

### 5.2 Global Mutable State

**Location**: `packages/core/src/iac/db-context.ts:331`

```typescript
const mgr = (globalThis as any).__betterbaseRealtimeManager;
```

Using global state for realtime manager can cause issues in serverless/edge environments.

---

## 6. Recommendations Summary

### Immediate Actions (Critical)

| # | Action | Location | Effort |
|---|--------|-----------|--------|
| 1 | Fix auth bypass | `templates/auth/src/routes/auth.ts:135` | Medium |
| 2 | Add rate limiting | `packages/server/src/routes/admin/auth.ts` | Low |
| 3 | Authenticate WebSocket | `packages/server/src/routes/betterbase/ws.ts` | Medium |
| 4 | Remove hardcoded creds | `packages/server/src/routes/betterbase/index.ts` | Low |
| 5 | Add input validation | `packages/server/src/routes/betterbase/index.ts:180` | Low |

### Short-term (High Priority)

| # | Action | Location | Effort |
|---|--------|-----------|--------|
| 6 | Add CSRF middleware | `packages/server/src/index.ts` | Medium |
| 7 | Reduce JWT expiry | `packages/server/src/lib/auth.ts` | Low |
| 8 | Implement RLS roles | `packages/core/src/rls/evaluator.ts` | Medium |

### Medium-term (Feature Completion)

| # | Action | Location | Effort |
|---|--------|-----------|--------|
| 9 | GraphQL subscriptions | `packages/core/src/graphql/resolvers.ts` | High |
| 10 | Complete auth template | `templates/auth/src/routes/auth.ts` | High |
| 11 | Replace console.log | Throughout codebase | Medium |

### Long-term (Code Quality)

| # | Action | Effort |
|---|--------|--------|
| 12 | Remove `any` types (327+) | High |
| 13 | Add integration tests | High |
| 14 | Structured logging migration | Medium |

---

## 7. Appendix

### File Locations Reference

| Issue | File Path |
|-------|-----------|
| Auth bypass | `templates/auth/src/routes/auth.ts` |
| No rate limiting | `packages/server/src/routes/admin/auth.ts` |
| WebSocket auth | `packages/server/src/routes/betterbase/ws.ts` |
| Hardcoded creds | `packages/server/src/routes/betterbase/index.ts` |
| No CSRF | `packages/server/src/index.ts` |
| JWT expiry | `packages/server/src/lib/auth.ts` |
| Input validation | `packages/server/src/routes/betterbase/index.ts` |
| GraphQL subs | `packages/core/src/graphql/resolvers.ts` |
| RLS roles | `packages/core/src/rls/evaluator.ts` |
| `any` types | Throughout `packages/server` and `packages/core` |

---

*Document generated: 2026-03-31*
*Review scope: Full codebase analysis*