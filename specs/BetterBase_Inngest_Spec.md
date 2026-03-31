# BetterBase Inngest Integration — Orchestrator Specification

> **For Kilo Code Orchestrator**
> Execute tasks in strict order. Each task lists its dependencies — do not begin a task until all listed dependencies are marked complete. All file paths are relative to the monorepo root unless otherwise noted.

---

## Overview

This specification integrates [Inngest](https://www.inngest.com/) into BetterBase as the durable workflow and background job engine. Inngest replaces all fire-and-forget async patterns currently in the codebase with retryable, observable, step-based functions.

**Two deployment modes are fully supported and share identical application code:**

| Mode | Inngest Backend | Used By |
|------|----------------|---------|
| Cloud | `https://api.inngest.com` | BetterBase Cloud offering |
| Self-Hosted | `http://inngest:8288` (Docker container) | `docker-compose.self-hosted.yml` |
| Local Dev | `http://localhost:8288` (npx CLI) | Development and testing |

A single environment variable (`INNGEST_BASE_URL`) switches between all three modes. No application code changes between modes.

**5 tasks across 3 phases.**

---

## Phase 1 — Infrastructure

> Foundation. ING-02 through ING-05 depend on ING-01.

### Task ING-01 — Add Inngest to Docker Compose (Both Modes)

**Depends on:** Nothing (infrastructure-only change)

**What it is:** Inngest ships an official Docker image that runs a local orchestration server. We add it to both the self-hosted production compose file and document the local dev workflow. The `dev` command is used for local development; the `start` command is used for self-hosted production deployments.

---

#### Update file: `docker-compose.self-hosted.yml`

Add the following service. Insert it **before** the `betterbase-server` service block so dependency ordering is clear:

```yaml
  # ─── Inngest (Durable Workflow Engine) ────────────────────────────────────
  inngest:
    image: inngest/inngest:latest
    container_name: betterbase-inngest
    restart: unless-stopped
    command: inngest start --host 0.0.0.0 --port 8288
    environment:
      INNGEST_LOG_LEVEL: ${INNGEST_LOG_LEVEL:-info}
    volumes:
      - inngest_data:/data
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:8288/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - betterbase-internal
```

**Update the `betterbase-server` service** to add Inngest as a dependency:

```yaml
  betterbase-server:
    # ... existing config ...
    depends_on:
      postgres:
        condition: service_healthy
      minio:
        condition: service_healthy
      inngest:                        # ← ADD THIS
        condition: service_healthy
    environment:
      # ... existing env vars ...
      INNGEST_BASE_URL: http://inngest:8288          # ← ADD THIS
      INNGEST_SIGNING_KEY: ${INNGEST_SIGNING_KEY:-betterbase-dev-signing-key}  # ← ADD THIS
      INNGEST_EVENT_KEY: ${INNGEST_EVENT_KEY:-betterbase-dev-event-key}        # ← ADD THIS
```

**Add the `inngest_data` volume** to the `volumes:` block at the bottom of the file:

```yaml
volumes:
  postgres_data:
  minio_data:
  inngest_data:    # ← ADD THIS
```

**Update Nginx config** (`docker/nginx/nginx.conf`) to proxy the Inngest dashboard UI (optional but useful for self-hosters):

```nginx
    # Inngest dashboard (self-hosted only)
    location /inngest/ {
      rewrite ^/inngest/(.*) /$1 break;
      proxy_pass http://inngest:8288;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }
```

---

#### Create file: `docker-compose.dev.yml`

This is a lightweight compose file for local development. It runs only Inngest — BetterBase server runs natively via `bun run dev` outside Docker.

```yaml
version: "3.9"

# Local development: runs Inngest dev server only.
# BetterBase server runs outside Docker via: bun run dev
#
# Usage:
#   docker compose -f docker-compose.dev.yml up -d
#   Then in a separate terminal: cd packages/server && bun run dev
#
# Inngest dashboard available at: http://localhost:8288

services:
  inngest:
    image: inngest/inngest:latest
    container_name: betterbase-inngest-dev
    command: inngest dev --host 0.0.0.0 --port 8288
    ports:
      - "8288:8288"   # Expose for local browser access to Inngest dashboard
    volumes:
      - inngest_dev_data:/data

volumes:
  inngest_dev_data:
```

---

#### Update file: `.env.self-hosted.example`

Add the following entries under the `OPTIONAL` section:

```bash
# ─── INNGEST ─────────────────────────────────────────────────────────────────
# Signing key: used to verify that events come from Inngest (not arbitrary HTTP)
# Generate with: openssl rand -hex 32
INNGEST_SIGNING_KEY=change-me-to-a-random-hex-string

# Event key: used by the BetterBase server to send events to Inngest
# Generate with: openssl rand -hex 16
INNGEST_EVENT_KEY=change-me-to-another-random-hex-string

# Log level for the Inngest container (debug | info | warn | error)
INNGEST_LOG_LEVEL=info
```

**Acceptance criteria:**

- `docker compose -f docker-compose.self-hosted.yml up -d` starts all services including Inngest
- `betterbase-server` does not start until Inngest passes its healthcheck
- `inngest start` (production mode) is used in the self-hosted compose — not `inngest dev`
- `inngest dev` is used in `docker-compose.dev.yml` — not `inngest start`
- `inngest_data` volume persists workflow state across container restarts in self-hosted mode
- Inngest dashboard accessible at `http://localhost/inngest/` via Nginx in self-hosted mode
- `docker compose -f docker-compose.dev.yml up -d` brings up only the Inngest dev server for local development

---

## Phase 2 — Server Integration

> Wires Inngest into `packages/server`. Execute ING-02 → ING-03 in order.

### Task ING-02 — Create Inngest Client and Core Functions

**Depends on:** ING-01

**What it is:** Creates the Inngest client singleton and defines all BetterBase Inngest functions in one place. The client reads `INNGEST_BASE_URL` to switch between cloud, self-hosted, and local dev automatically.

---

**Add to `packages/server/package.json` dependencies:**

```json
"inngest": "^3.0.0"
```

---

**Create file:** `packages/server/src/lib/inngest.ts`

```typescript
import { Inngest, EventSchemas } from "inngest";

// ─── Event Schema ────────────────────────────────────────────────────────────
// Define all events that BetterBase can send to Inngest.
// Typed payloads prevent runtime mismatches.

type Events = {
  // Webhook delivery
  "betterbase/webhook.deliver": {
    data: {
      webhookId: string;
      webhookName: string;
      url: string;
      secret: string | null;
      eventType: string;
      tableName: string;
      payload: unknown;
      attempt: number;
    };
  };

  // Notification rule evaluation
  "betterbase/notification.evaluate": {
    data: {
      ruleId: string;
      ruleName: string;
      metric: string;
      threshold: number;
      channel: "email" | "webhook";
      target: string;
      currentValue: number;
    };
  };

  // Background CSV export
  "betterbase/export.users": {
    data: {
      projectId: string;
      projectSlug: string;
      requestedBy: string; // admin email
      filters: {
        search?: string;
        banned?: boolean;
        from?: string;
        to?: string;
      };
    };
  };
};

// ─── Inngest Client ──────────────────────────────────────────────────────────

export const inngest = new Inngest({
  id: "betterbase",
  schemas: new EventSchemas().fromRecord<Events>(),

  // INNGEST_BASE_URL controls which Inngest backend is used:
  //   - undefined / not set    → api.inngest.com (BetterBase Cloud)
  //   - http://inngest:8288    → self-hosted Docker container
  //   - http://localhost:8288  → local dev server (npx inngest-cli dev)
  baseUrl: process.env.INNGEST_BASE_URL,

  // Signing key verifies that incoming function execution requests
  // genuinely come from the Inngest backend, not arbitrary HTTP callers.
  signingKey: process.env.INNGEST_SIGNING_KEY,

  // Event key authenticates outbound event sends from BetterBase server to Inngest.
  eventKey: process.env.INNGEST_EVENT_KEY ?? "betterbase-dev-event-key",
});

// ─── Function: Webhook Delivery ──────────────────────────────────────────────

export const deliverWebhook = inngest.createFunction(
  {
    id: "deliver-webhook",
    retries: 5,
    // Concurrency: max 10 simultaneous deliveries to the same webhook URL
    // prevents hammering a slow endpoint
    concurrency: {
      limit: 10,
      key: "event.data.webhookId",
    },
  },
  { event: "betterbase/webhook.deliver" },
  async ({ event, step }) => {
    const { webhookId, webhookName, url, secret, eventType, tableName, payload, attempt } =
      event.data;

    // Step 1: Send the HTTP request
    // step.run is a code-level transaction: retries automatically on throw,
    // runs only once on success, state persisted between retries.
    const deliveryResult = await step.run("send-http-request", async () => {
      const body = JSON.stringify({
        id: crypto.randomUUID(),
        webhook_id: webhookId,
        table: tableName,
        type: eventType,
        record: payload,
        timestamp: new Date().toISOString(),
      });

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Betterbase-Event": eventType,
        "X-Betterbase-Webhook-Id": webhookId,
      };

      // Sign the payload if a secret is configured
      if (secret) {
        const { createHmac } = await import("crypto");
        const signature = createHmac("sha256", secret).update(body).digest("hex");
        headers["X-Betterbase-Signature"] = `sha256=${signature}`;
      }

      const start = Date.now();
      const res = await fetch(url, { method: "POST", headers, body });
      const duration = Date.now() - start;
      const responseBody = await res.text().catch(() => "");

      if (!res.ok) {
        // Throwing causes Inngest to retry with exponential backoff
        throw new Error(
          `Webhook delivery failed: HTTP ${res.status} from ${url} — ${responseBody.slice(0, 200)}`
        );
      }

      return {
        httpStatus: res.status,
        durationMs: duration,
        responseBody: responseBody.slice(0, 500),
      };
    });

    // Step 2: Persist the delivery record
    // This step only runs after the HTTP request succeeds.
    await step.run("log-successful-delivery", async () => {
      const { getPool } = await import("./db");
      const pool = getPool();

      await pool.query(
        `INSERT INTO betterbase_meta.webhook_deliveries
           (webhook_id, event_type, payload, status, response_code, duration_ms, delivered_at, attempt_count)
         VALUES ($1, $2, $3, 'success', $4, $5, NOW(), $6)`,
        [
          webhookId,
          eventType,
          JSON.stringify(payload),
          deliveryResult.httpStatus,
          deliveryResult.durationMs,
          attempt,
        ]
      );
    });

    return {
      success: true,
      webhookId,
      httpStatus: deliveryResult.httpStatus,
      durationMs: deliveryResult.durationMs,
    };
  }
);

// ─── Function: Notification Rule Evaluation ──────────────────────────────────

export const evaluateNotificationRule = inngest.createFunction(
  {
    id: "evaluate-notification-rule",
    retries: 3,
  },
  { event: "betterbase/notification.evaluate" },
  async ({ event, step }) => {
    const { ruleId, ruleName, metric, threshold, channel, target, currentValue } = event.data;

    // Only proceed if the threshold is breached
    if (currentValue < threshold) {
      return { triggered: false, metric, currentValue, threshold };
    }

    // Step: Send the notification
    const result = await step.run("send-notification", async () => {
      if (channel === "email") {
        const { getPool } = await import("./db");
        const pool = getPool();

        // Load SMTP config
        const { rows } = await pool.query(
          "SELECT * FROM betterbase_meta.smtp_config WHERE id = 'singleton' AND enabled = TRUE"
        );
        if (rows.length === 0) {
          throw new Error("SMTP not configured — cannot send notification email");
        }

        const smtp = rows[0];
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.default.createTransport({
          host: smtp.host,
          port: smtp.port,
          secure: smtp.port === 465,
          requireTLS: smtp.use_tls,
          auth: { user: smtp.username, pass: smtp.password },
        });

        await transporter.sendMail({
          from: `"${smtp.from_name}" <${smtp.from_email}>`,
          to: target,
          subject: `[Betterbase Alert] ${ruleName} threshold breached`,
          text: `Metric "${metric}" has reached ${currentValue} (threshold: ${threshold}).`,
          html: `<p>Metric <strong>${metric}</strong> has reached <strong>${currentValue}</strong> (threshold: ${threshold}).</p>`,
        });

        return { method: "email", to: target };
      }

      if (channel === "webhook") {
        const res = await fetch(target, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rule_id: ruleId,
            rule_name: ruleName,
            metric,
            current_value: currentValue,
            threshold,
            triggered_at: new Date().toISOString(),
          }),
        });
        if (!res.ok) {
          throw new Error(`Notification webhook failed: HTTP ${res.status}`);
        }
        return { method: "webhook", url: target, httpStatus: res.status };
      }

      throw new Error(`Unknown notification channel: ${channel}`);
    });

    return { triggered: true, metric, currentValue, threshold, ...result };
  }
);

// ─── Function: Background User CSV Export ────────────────────────────────────

export const exportProjectUsers = inngest.createFunction(
  {
    id: "export-project-users",
    retries: 2,
    // Concurrency: one export at a time per project
    concurrency: {
      limit: 1,
      key: "event.data.projectId",
    },
  },
  { event: "betterbase/export.users" },
  async ({ event, step }) => {
    const { projectId, projectSlug, requestedBy, filters } = event.data;
    const schemaName = `project_${projectSlug}`;

    // Step 1: Query users
    const rows = await step.run("query-users", async () => {
      const { getPool } = await import("./db");
      const pool = getPool();

      const conditions: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (filters.search) {
        conditions.push(`(email ILIKE $${idx} OR name ILIKE $${idx})`);
        params.push(`%${filters.search}%`);
        idx++;
      }
      if (filters.banned !== undefined) {
        conditions.push(`banned = $${idx}`);
        params.push(filters.banned);
        idx++;
      }
      if (filters.from) {
        conditions.push(`created_at >= $${idx}`);
        params.push(filters.from);
        idx++;
      }
      if (filters.to) {
        conditions.push(`created_at <= $${idx}`);
        params.push(filters.to);
        idx++;
      }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const { rows } = await pool.query(
        `SELECT id, name, email, email_verified, created_at, banned
         FROM ${schemaName}."user"
         ${where}
         ORDER BY created_at DESC`,
        params
      );
      return rows;
    });

    // Step 2: Build CSV
    const csv = await step.run("build-csv", async () => {
      const header = "id,name,email,email_verified,created_at,banned\n";
      const body = rows
        .map(
          (r: any) =>
            `${r.id},"${r.name}","${r.email}",${r.email_verified},${r.created_at},${r.banned}`
        )
        .join("\n");
      return header + body;
    });

    // Step 3: Store export result
    // In v1, write to a temp table. Future: upload to MinIO and return a signed URL.
    await step.run("store-export", async () => {
      const { getPool } = await import("./db");
      const pool = getPool();

      await pool.query(
        `INSERT INTO betterbase_meta.export_jobs
           (project_id, requested_by, status, row_count, result_csv, completed_at)
         VALUES ($1, $2, 'complete', $3, $4, NOW())`,
        [projectId, requestedBy, rows.length, csv]
      );
    });

    return { projectId, rowCount: rows.length, requestedBy };
  }
);

// ─── All functions (used in serve() registration) ────────────────────────────

export const allInngestFunctions = [
  deliverWebhook,
  evaluateNotificationRule,
  exportProjectUsers,
];
```

---

**Create file:** `packages/server/migrations/011_inngest_support.sql`

```sql
-- Export jobs table: stores async export results for the background CSV export function
CREATE TABLE IF NOT EXISTS betterbase_meta.export_jobs (
  id            BIGSERIAL PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES betterbase_meta.projects(id) ON DELETE CASCADE,
  requested_by  TEXT NOT NULL,   -- admin email
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending | complete | failed
  row_count     INT,
  result_csv    TEXT,            -- stored in DB for v1; move to MinIO in v2
  error_msg     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_export_jobs_project_id
  ON betterbase_meta.export_jobs (project_id, created_at DESC);
```

**Acceptance criteria:**

- `inngest` package added to `packages/server/package.json`
- `inngest.ts` exports: `inngest` client, `deliverWebhook`, `evaluateNotificationRule`, `exportProjectUsers`, `allInngestFunctions`
- `INNGEST_BASE_URL` absent/undefined → client targets `api.inngest.com` automatically (Inngest SDK default)
- `INNGEST_BASE_URL=http://inngest:8288` → client targets self-hosted Docker container
- `INNGEST_BASE_URL=http://localhost:8288` → client targets local dev server
- All three Inngest functions defined with correct event names, typed payloads, and retry counts
- Migration file `011_inngest_support.sql` exists with `export_jobs` table
- No function makes direct DB calls outside of `step.run` blocks

---

### Task ING-03 — Register Inngest Serve Endpoint in Server

**Depends on:** ING-02

**What it is:** Inngest works by calling back into your application to execute functions. You expose a single HTTP endpoint (`/api/inngest`) that the Inngest backend (cloud or self-hosted) uses to invoke functions. This is how Inngest knows where your functions live.

---

**Update file:** `packages/server/src/index.ts`

Add the following imports at the top of the file:

```typescript
import { serve } from "inngest/hono";
import { inngest, allInngestFunctions } from "./lib/inngest";
```

Add the Inngest serve handler **after** the health check route and **before** the admin/device routers:

```typescript
// ─── Inngest Function Serve Handler ──────────────────────────────────────────
// This endpoint is called by the Inngest backend (cloud or self-hosted) to
// execute registered functions. It handles GET (introspection/registration)
// and POST (function execution) automatically.
app.on(
  ["GET", "POST", "PUT"],
  "/api/inngest",
  serve({
    client: inngest,
    functions: allInngestFunctions,
    signingKey: process.env.INNGEST_SIGNING_KEY,
  })
);
```

**Also add Inngest to the env validation schema** in `packages/server/src/lib/env.ts`:

```typescript
// Add these fields to the existing EnvSchema object:
INNGEST_BASE_URL:     z.string().url().optional(),     // undefined = use api.inngest.com
INNGEST_SIGNING_KEY:  z.string().optional(),           // required in production cloud mode
INNGEST_EVENT_KEY:    z.string().optional(),           // required in production cloud mode
```

**Update Nginx config** (`docker/nginx/nginx.conf`) to proxy the Inngest serve endpoint so external Inngest (cloud mode) can reach it:

```nginx
    # Inngest function serve endpoint (cloud callbacks)
    location /api/inngest {
      proxy_pass http://betterbase_server;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_read_timeout 300s;  # Inngest functions can run up to 5 minutes
    }
```

**Acceptance criteria:**

- `GET /api/inngest` returns a 200 with function registration metadata (Inngest introspection)
- `POST /api/inngest` is callable by the Inngest backend to trigger function execution
- Endpoint appears in server startup logs
- 300s proxy timeout set — prevents Nginx killing long-running Inngest function calls
- `serve()` wired to `allInngestFunctions` — adding a new function to that array automatically registers it

---

## Phase 3 — Feature Migration

> Replaces existing fragile async patterns with Inngest-backed durability. Execute ING-04 → ING-05 in order.

### Task ING-04 — Migrate Webhook Delivery to Inngest

**Depends on:** ING-03

**What it is:** The existing webhook delivery flow (`POST /admin/projects/:id/webhooks/:webhookId/retry` and the test endpoint in `packages/server/src/routes/admin/project-scoped/webhooks.ts`) fires HTTP requests inline in the route handler. This means: no retries on failure, no delivery trace, no exponential backoff. Replace this with Inngest event dispatch.

---

**Update file:** `packages/server/src/routes/admin/project-scoped/webhooks.ts`

Add import at the top:

```typescript
import { inngest } from "../../../lib/inngest";
```

**Replace the `POST /:webhookId/retry` handler** entirely:

```typescript
// POST /admin/projects/:id/webhooks/:webhookId/retry
projectWebhookRoutes.post("/:webhookId/retry", async (c) => {
  const pool = getPool();
  const { rows: webhooks } = await pool.query(
    "SELECT * FROM betterbase_meta.webhooks WHERE id = $1",
    [c.req.param("webhookId")]
  );
  if (webhooks.length === 0) return c.json({ error: "Webhook not found" }, 404);

  const webhook = webhooks[0];

  // Get the latest failed delivery to use its payload for retry
  const { rows: lastDelivery } = await pool.query(
    `SELECT payload, attempt_count FROM betterbase_meta.webhook_deliveries
     WHERE webhook_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [webhook.id]
  );

  const payload = lastDelivery[0]?.payload ?? {};
  const attempt = (lastDelivery[0]?.attempt_count ?? 0) + 1;

  // Send event to Inngest — Inngest handles the retry, backoff, and delivery logging
  await inngest.send({
    name: "betterbase/webhook.deliver",
    data: {
      webhookId: webhook.id,
      webhookName: webhook.name,
      url: webhook.url,
      secret: webhook.secret ?? null,
      eventType: "RETRY",
      tableName: webhook.table_name,
      payload,
      attempt,
    },
  });

  // Insert a pending delivery record immediately so the dashboard shows activity
  await pool.query(
    `INSERT INTO betterbase_meta.webhook_deliveries
       (webhook_id, event_type, payload, status, attempt_count)
     VALUES ($1, 'RETRY', $2, 'pending', $3)`,
    [webhook.id, JSON.stringify(payload), attempt]
  );

  return c.json({
    success: true,
    message: "Retry queued via Inngest. Delivery will be attempted with automatic backoff on failure.",
  });
});
```

**Replace the `POST /:webhookId/test` handler** entirely:

```typescript
// POST /admin/projects/:id/webhooks/:webhookId/test
projectWebhookRoutes.post("/:webhookId/test", async (c) => {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT * FROM betterbase_meta.webhooks WHERE id = $1",
    [c.req.param("webhookId")]
  );
  if (rows.length === 0) return c.json({ error: "Not found" }, 404);

  const webhook = rows[0];

  // Test deliveries go through Inngest too — provides identical trace visibility
  await inngest.send({
    name: "betterbase/webhook.deliver",
    data: {
      webhookId: webhook.id,
      webhookName: webhook.name,
      url: webhook.url,
      secret: webhook.secret ?? null,
      eventType: "TEST",
      tableName: webhook.table_name,
      payload: { id: "test-123", example: "data", _test: true },
      attempt: 1,
    },
  });

  return c.json({
    success: true,
    message: "Test event sent to Inngest. Check the Inngest dashboard for delivery trace.",
  });
});
```

**Also create a helper** for dispatching real webhook events from database triggers. Create `packages/server/src/lib/webhook-dispatcher.ts`:

```typescript
import { inngest } from "./inngest";
import { getPool } from "./db";

/**
 * Called by the database change listener (or webhooks integrator) when a
 * table mutation event fires. Looks up all matching enabled webhooks and
 * dispatches one Inngest event per webhook.
 */
export async function dispatchWebhookEvents(
  tableName: string,
  eventType: "INSERT" | "UPDATE" | "DELETE",
  record: unknown
): Promise<void> {
  const pool = getPool();

  // Find all enabled webhooks that match this table + event
  const { rows: webhooks } = await pool.query(
    `SELECT id, name, url, secret
     FROM betterbase_meta.webhooks
     WHERE table_name = $1
       AND $2 = ANY(events)
       AND enabled = TRUE`,
    [tableName, eventType]
  );

  if (webhooks.length === 0) return;

  // Send one event per matching webhook — Inngest fans them out in parallel
  await inngest.send(
    webhooks.map((webhook: any) => ({
      name: "betterbase/webhook.deliver" as const,
      data: {
        webhookId: webhook.id,
        webhookName: webhook.name,
        url: webhook.url,
        secret: webhook.secret ?? null,
        eventType,
        tableName,
        payload: record,
        attempt: 1,
      },
    }))
  );
}
```

**Acceptance criteria:**

- `POST /admin/projects/:id/webhooks/:webhookId/retry` returns immediately (202-style response) — no longer blocks waiting for HTTP delivery
- `POST /admin/projects/:id/webhooks/:webhookId/test` returns immediately
- Both endpoints send Inngest events; Inngest handles actual HTTP delivery
- `webhook-dispatcher.ts` exists and is ready for wiring into the realtime/CDC layer
- A `pending` delivery row is inserted immediately on retry so the dashboard reflects queued state
- Inngest's retry/backoff handles all failure recovery — no custom retry logic in route handlers
- Inngest dashboard (at `/inngest/` in self-hosted, at `app.inngest.com` in cloud) shows full delivery trace per function run

---

### Task ING-05 — Migrate Notification Rules to Inngest Fan-Out

**Depends on:** ING-04

**What it is:** Notification rules are currently stored in `betterbase_meta.notification_rules` but never evaluated — there is no trigger mechanism. Wire them into a metrics-polling Inngest cron function that evaluates all enabled rules every 5 minutes and fans out a notification event for each breach.

---

**Update file:** `packages/server/src/lib/inngest.ts`

Add the following import at the top:

```typescript
import { type GetEvents } from "inngest";
```

Add this new cron function **after** the `exportProjectUsers` function definition and **before** `allInngestFunctions`:

```typescript
// ─── Function: Notification Rule Poller (Cron) ───────────────────────────────

export const pollNotificationRules = inngest.createFunction(
  {
    id: "poll-notification-rules",
    retries: 1,
  },
  // Runs every 5 minutes
  { cron: "*/5 * * * *" },
  async ({ step }) => {
    // Step 1: Load all enabled rules
    const rules = await step.run("load-rules", async () => {
      const { getPool } = await import("./db");
      const pool = getPool();
      const { rows } = await pool.query(
        "SELECT * FROM betterbase_meta.notification_rules WHERE enabled = TRUE"
      );
      return rows;
    });

    if (rules.length === 0) return { evaluated: 0 };

    // Step 2: Load current metric values
    const metricValues = await step.run("load-metrics", async () => {
      const { getPool } = await import("./db");
      const pool = getPool();

      const [errorRate, responsetime] = await Promise.all([
        pool.query(`
          SELECT
            ROUND(
              COUNT(*) FILTER (WHERE status >= 500)::numeric /
              NULLIF(COUNT(*), 0) * 100,
              2
            ) AS value
          FROM betterbase_meta.request_logs
          WHERE created_at > NOW() - INTERVAL '5 minutes'
        `),
        pool.query(`
          SELECT ROUND(
            PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms)
          )::int AS value
          FROM betterbase_meta.request_logs
          WHERE created_at > NOW() - INTERVAL '5 minutes'
            AND duration_ms IS NOT NULL
        `),
      ]);

      return {
        error_rate:          parseFloat(errorRate.rows[0]?.value ?? "0"),
        response_time_p99:   parseInt(responsetime.rows[0]?.value ?? "0"),
        // storage_pct and auth_failures are placeholders for future metrics
        storage_pct:         0,
        auth_failures:       0,
      } as Record<string, number>;
    });

    // Step 3: Fan out — one event per rule that needs evaluation
    // Inngest processes these in parallel; each gets its own trace
    const eventsToSend = rules
      .map((rule: any) => ({
        name: "betterbase/notification.evaluate" as const,
        data: {
          ruleId:       rule.id,
          ruleName:     rule.name,
          metric:       rule.metric,
          threshold:    parseFloat(rule.threshold),
          channel:      rule.channel as "email" | "webhook",
          target:       rule.target,
          currentValue: metricValues[rule.metric] ?? 0,
        },
      }));

    if (eventsToSend.length > 0) {
      await inngest.send(eventsToSend);
    }

    return {
      evaluated: rules.length,
      breaches: eventsToSend.filter(
        (e) => e.data.currentValue >= e.data.threshold
      ).length,
    };
  }
);
```

**Update `allInngestFunctions`** at the bottom of `inngest.ts` to include the new cron function:

```typescript
export const allInngestFunctions = [
  deliverWebhook,
  evaluateNotificationRule,
  exportProjectUsers,
  pollNotificationRules,   // ← ADD THIS
];
```

---

**Also update:** `packages/server/src/routes/admin/notifications.ts`

Add the ability to **manually trigger** a rule evaluation for testing (useful in the dashboard):

```typescript
import { inngest } from "../../lib/inngest";

// Add this route AFTER the existing PATCH and DELETE routes:

// POST /admin/notifications/:id/test  — manually trigger evaluation of a single rule
notificationRoutes.post("/:id/test", async (c) => {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT * FROM betterbase_meta.notification_rules WHERE id = $1",
    [c.req.param("id")]
  );
  if (rows.length === 0) return c.json({ error: "Not found" }, 404);

  const rule = rows[0];

  await inngest.send({
    name: "betterbase/notification.evaluate",
    data: {
      ruleId:       rule.id,
      ruleName:     rule.name,
      metric:       rule.metric,
      threshold:    parseFloat(rule.threshold),
      channel:      rule.channel,
      target:       rule.target,
      currentValue: parseFloat(rule.threshold) + 1, // Artificially breach threshold for test
    },
  });

  return c.json({
    success: true,
    message: "Test notification queued via Inngest. Check the Inngest dashboard for trace.",
  });
});
```

**Acceptance criteria:**

- `pollNotificationRules` is a cron function that fires every 5 minutes automatically — no external scheduler needed
- Cron function appears in Inngest dashboard under "Functions" with a schedule display
- Fan-out: one `betterbase/notification.evaluate` event sent per enabled rule
- `evaluateNotificationRule` function receives each event independently — full trace per rule per evaluation cycle
- `POST /admin/notifications/:id/test` allows manual trigger from the dashboard for any rule
- Metric values `storage_pct` and `auth_failures` return `0` (stubbed) — documented in code as future work
- `error_rate` and `response_time_p99` use real data from `betterbase_meta.request_logs`
- Adding a new metric type requires: adding its key to `metricValues` in `load-metrics` step + adding it to the `metric` enum in `notifications.ts` — no other changes needed

---

## Execution Order Summary

```
Phase 1 — Infrastructure
  ING-01  Docker Compose services (self-hosted start + dev mode) + .env.example

Phase 2 — Server Integration
  ING-02  inngest.ts client + all function definitions + 011 migration
  ING-03  /api/inngest serve endpoint + env validation + Nginx proxy

Phase 3 — Feature Migration
  ING-04  Webhook delivery → Inngest (retry + test endpoints + dispatcher helper)
  ING-05  Notification rules → Inngest cron fan-out + manual test endpoint
```

**Total: 5 tasks across 3 phases.**

---

## Local Development Workflow

After this spec is implemented, local development works as follows:

```bash
# Terminal 1: Start Inngest dev server
docker compose -f docker-compose.dev.yml up -d
# Inngest dashboard now at: http://localhost:8288

# Terminal 2: Start BetterBase server (targets localhost:8288 automatically)
cd packages/server
INNGEST_BASE_URL=http://localhost:8288 bun run dev

# To test webhook delivery:
curl -X POST http://localhost:3001/admin/projects/:id/webhooks/:webhookId/test \
  -H "Authorization: Bearer <token>"
# → Check http://localhost:8288 to see the function run trace
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `INNGEST_BASE_URL` | No | _(uses api.inngest.com)_ | Inngest backend URL. Set to `http://inngest:8288` for self-hosted Docker, `http://localhost:8288` for local dev |
| `INNGEST_SIGNING_KEY` | Production only | `betterbase-dev-signing-key` | Verifies Inngest→BetterBase callbacks. Generate: `openssl rand -hex 32` |
| `INNGEST_EVENT_KEY` | Production only | `betterbase-dev-event-key` | Authenticates BetterBase→Inngest event sends. Generate: `openssl rand -hex 16` |
| `INNGEST_LOG_LEVEL` | No | `info` | Log verbosity for the Inngest Docker container |

---

## Dependencies Added

| Package | Added To | Purpose |
|---|---|---|
| `inngest@^3.0.0` | `packages/server/package.json` | Inngest TypeScript SDK — client, function builder, serve handler |

No other packages are required. The Inngest Docker image (`inngest/inngest:latest`) is pulled automatically by Docker Compose.

---

## New Files Created

| File | Purpose |
|---|---|
| `docker-compose.dev.yml` | Inngest dev server only — for local development |
| `packages/server/src/lib/inngest.ts` | Inngest client + all function definitions |
| `packages/server/src/lib/webhook-dispatcher.ts` | Helper for dispatching webhook events from CDC layer |
| `packages/server/migrations/011_inngest_support.sql` | `export_jobs` table for async CSV exports |

## Files Modified

| File | Change |
|---|---|
| `docker-compose.self-hosted.yml` | Add `inngest` service (production mode), `inngest_data` volume, server env vars |
| `docker/nginx/nginx.conf` | Add `/api/inngest` and `/inngest/` proxy locations |
| `.env.self-hosted.example` | Document `INNGEST_SIGNING_KEY`, `INNGEST_EVENT_KEY`, `INNGEST_LOG_LEVEL` |
| `packages/server/src/index.ts` | Add `serve()` endpoint registration |
| `packages/server/src/lib/env.ts` | Add Inngest env vars to schema |
| `packages/server/src/routes/admin/project-scoped/webhooks.ts` | Replace inline HTTP delivery with Inngest event dispatch |
| `packages/server/src/routes/admin/notifications.ts` | Add `POST /:id/test` manual trigger endpoint |

---

*End of specification. 5 tasks across 3 phases. Execute in listed order. Verify by starting the server, checking `GET /api/inngest` returns 200, then sending a test webhook event and confirming the trace appears in the Inngest dashboard at `http://localhost:8288`.*
