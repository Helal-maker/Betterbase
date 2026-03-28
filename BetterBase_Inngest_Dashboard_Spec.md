# BetterBase Inngest Dashboard Integration — Specification

> **For Kilo Code Orchestrator**
> Execute tasks in strict order. Each task lists its dependencies — do not begin a task until all listed dependencies are marked complete.

---

## Overview

This specification adds an Inngest Dashboard to the BetterBase admin UI, allowing users to:
- View all registered Inngest functions
- See recent function runs with status
- View run details (steps, timeline, output)
- Manually trigger test events
- Retry failed runs

The implementation uses server-side proxy routes to communicate with the Inngest API (self-hosted or cloud), ensuring proper authentication and avoiding CORS issues.

**4 tasks across 2 phases.**

---

## Phase 1 — Backend Routes

> Wires Inngest API into the server. IDG-01 must complete before IDG-02.

### Task IDG-01 — Create Inngest API Proxy Routes

**Depends on:** ING-05 (Inngest integration complete)

**What it is:** Creates server-side routes that proxy requests to the Inngest API. This allows the frontend to fetch function data, runs, and trigger events without exposing Inngest credentials directly to the browser.

---

**Create file:** `packages/server/src/routes/admin/inngest.ts`

```typescript
import { Hono } from "hono";
import { getPool } from "../../lib/db";
import { validateEnv } from "../../lib/env";
import { inngest } from "../../lib/inngest";

export const inngestAdminRoutes = new Hono();

const getInngestBaseUrl = (): string => {
  return process.env.INNGEST_BASE_URL ?? "https://api.inngest.com";
};

const getInngestHeaders = async (): Promise<HeadersInit> => {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT value FROM betterbase_meta.instance_settings WHERE key = 'inngest_api_key'"
  );
  const apiKey = rows[0]?.value ?? process.env.INNGEST_API_KEY ?? "";
  return {
    "Content-Type": "application/json",
    ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
  };
};

const getInngestEnv = async (): Promise<string | null> => {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT value FROM betterbase_meta.instance_settings WHERE key = 'inngest_env_id'"
  );
  return rows[0]?.value ?? null;
};

// GET /admin/inngest/functions — List all registered functions
inngestAdminRoutes.get("/functions", async (c) => {
  try {
    const baseUrl = getInngestBaseUrl();
    const headers = await getInngestHeaders();
    const envId = await getInngestEnv();

    const url = envId
      ? `${baseUrl}/v1/environments/${envId}/functions`
      : `${baseUrl}/v1/functions`;

    const res = await fetch(url, { headers });
    const data = await res.json();

    return c.json({ functions: data.functions ?? [] });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// GET /admin/inngest/functions/:id/runs — List recent runs for a function
inngestAdminRoutes.get("/functions/:id/runs", async (c) => {
  try {
    const functionId = c.req.param("id");
    const baseUrl = getInngestBaseUrl();
    const headers = await getInngestHeaders();
    const envId = await getInngestEnv();

    const limit = Math.min(Number.parseInt(c.req.query("limit") ?? "20"), 100);
    const status = c.req.query("status"); // pending, running, complete, failed

    const params = new URLSearchParams({ limit: String(limit) });
    if (status) params.append("status", status);

    const url = envId
      ? `${baseUrl}/v1/environments/${envId}/functions/${functionId}/runs?${params}`
      : `${baseUrl}/v1/functions/${functionId}/runs?${params}`;

    const res = await fetch(url, { headers });
    const data = await res.json();

    return c.json({ runs: data.runs ?? [] });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// GET /admin/inngest/runs/:runId — Get detailed run information
inngestAdminRoutes.get("/runs/:runId", async (c) => {
  try {
    const runId = c.req.param("runId");
    const baseUrl = getInngestBaseUrl();
    const headers = await getInngestHeaders();
    const envId = await getInngestEnv();

    const url = envId
      ? `${baseUrl}/v1/environments/${envId}/runs/${runId}`
      : `${baseUrl}/v1/runs/${runId}`;

    const res = await fetch(url, { headers });
    const data = await res.json();

    return c.json(data);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST /admin/inngest/functions/:id/test — Trigger test event
inngestAdminRoutes.post("/functions/:id/test", async (c) => {
  try {
    const functionId = c.req.param("id");

    // Map function ID to event name
    const functionEventMap: Record<string, string> = {
      "deliver-webhook": "betterbase/webhook.deliver",
      "evaluate-notification-rule": "betterbase/notification.evaluate",
      "export-project-users": "betterbase/export.users",
      "poll-notification-rules": "betterbase/notification.evaluate",
    };

    const eventName = functionEventMap[functionId];
    if (!eventName) {
      return c.json({ error: "Unknown function type" }, 400);
    }

    // Send test event via inngest client
    await inngest.send({
      name: eventName,
      data: {
        _test: true,
        triggeredAt: new Date().toISOString(),
      },
    });

    return c.json({
      success: true,
      message: `Test event "${eventName}" sent. Check Inngest dashboard for run details.`,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST /admin/inngest/runs/:runId/cancel — Cancel a running function
inngestAdminRoutes.post("/runs/:runId/cancel", async (c) => {
  try {
    const runId = c.req.param("runId");
    const baseUrl = getInngestBaseUrl();
    const headers = await getInngestHeaders();
    const envId = await getInngestEnv();

    const url = envId
      ? `${baseUrl}/v1/environments/${envId}/runs/${runId}/cancel`
      : `${baseUrl}/v1/runs/${runId}/cancel`;

    const res = await fetch(url, { method: "POST", headers });

    if (!res.ok) {
      const error = await res.text();
      return c.json({ error: `Failed to cancel run: ${error}` }, res.status);
    }

    return c.json({ success: true, message: "Run cancelled successfully" });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// GET /admin/inngest/status — Check Inngest connection status
inngestAdminRoutes.get("/status", async (c) => {
  try {
    const baseUrl = getInngestBaseUrl();
    const headers = await getInngestHeaders();

    const isSelfHosted = baseUrl !== "https://api.inngest.com";

    if (isSelfHosted) {
      // Self-hosted: check health endpoint
      const res = await fetch(`${baseUrl}/health`, { headers });
      const healthy = res.ok;

      return c.json({
        status: healthy ? "connected" : "error",
        mode: "self-hosted",
        url: baseUrl,
      });
    } else {
      // Cloud: check functions list
      const res = await fetch(`${baseUrl}/v1/functions`, { headers });
      const connected = res.ok;

      return c.json({
        status: connected ? "connected" : "error",
        mode: "cloud",
        url: baseUrl,
      });
    }
  } catch (err: any) {
    return c.json({
      status: "error",
      error: err.message,
    });
  }
});
```

---

**Add to instance settings table** — Create migration `015_inngest_settings.sql`:

```sql
-- Instance settings for Inngest configuration
ALTER TABLE betterbase_meta.instance_settings
ADD COLUMN IF NOT EXISTS key TEXT UNIQUE;

INSERT INTO betterbase_meta.instance_settings (key, value, description, created_at)
VALUES 
  ('inngest_api_key', '', 'API key for Inngest cloud (optional)', NOW()),
  ('inngest_env_id', '', 'Environment ID for Inngest (optional)', NOW()),
  ('inngest_mode', 'self-hosted', 'inngest mode: self-hosted or cloud', NOW())
ON CONFLICT (key) DO NOTHING;
```

---

**Update file:** `packages/server/src/routes/admin/index.ts`

Add the inngest routes to the admin router:

```typescript
import { inngestAdminRoutes } from "./inngest";

// ... existing routes ...

// Inngest administration
adminRouter.route("/inngest", inngestAdminRoutes);
```

---

**Acceptance criteria:**
- `GET /admin/inngest/status` returns connection status
- `GET /admin/inngest/functions` returns list of all Inngest functions
- `GET /admin/inngest/functions/:id/runs` returns recent runs with optional status filter
- `GET /admin/inngest/runs/:runId` returns detailed run information
- `POST /admin/inngest/functions/:id/test` triggers test event
- `POST /admin/inngest/runs/:runId/cancel` cancels running function
- Server proxies all requests to Inngest API without exposing credentials
- Self-hosted mode works without API key (uses internal Inngest URL)

---

## Phase 2 — Frontend Dashboard

> UI implementation. IDG-02 depends on IDG-01.

### Task IDG-02 — Create Inngest Dashboard Page

**Depends on:** IDG-01

**What it is:** Adds an Inngest Dashboard page to the admin UI that displays functions, runs, and run details.

---

**Add to instance settings** — `apps/dashboard/src/lib/types.ts`:

```typescript
// Inngest types
export interface InngestFunction {
  id: string;
  name: string;
  status: "active" | "paused";
  createdAt: string;
  triggers: { type: string; event?: string; cron?: string }[];
}

export interface InngestRun {
  id: string;
  functionId: string;
  status: "pending" | "running" | "complete" | "failed";
  startedAt: string;
  endedAt?: string;
  output?: string;
  error?: string;
}

export interface InngestStatus {
  status: "connected" | "error";
  mode: "self-hosted" | "cloud";
  url: string;
  error?: string;
}
```

---

**Create API client** — `apps/dashboard/src/lib/inngest-client.ts`:

```typescript
const API_BASE = "/admin/inngest";

export const inngestApi = {
  getStatus: () => fetch(`${API_BASE}/status`).then(r => r.json()),

  getFunctions: () => 
    fetch(`${API_BASE}/functions`).then(r => r.json()),

  getFunctionRuns: (functionId: string, status?: string) => {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    return fetch(`${API_BASE}/functions/${functionId}/runs?${params}`).then(r => r.json());
  },

  getRun: (runId: string) => 
    fetch(`${API_BASE}/runs/${runId}`).then(r => r.json()),

  triggerTest: (functionId: string) => 
    fetch(`${API_BASE}/functions/${functionId}/test`, { method: "POST" }).then(r => r.json()),

  cancelRun: (runId: string) => 
    fetch(`${API_BASE}/runs/${runId}/cancel`, { method: "POST" }).then(r => r.json()),
};
```

---

**Create Inngest Dashboard page** — `apps/dashboard/src/pages/admin/InngestDashboardPage.tsx`:

```typescript
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { inngestApi } from "../../lib/inngest-client";
import { PageHeader } from "../../components/PageHeader";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "../../components/ui/table";
import { 
  Tabs, TabsContent, TabsList, TabsTrigger 
} from "../../components/ui/tabs";
import { 
  AlertCircle, CheckCircle, Clock, PlayCircle, XCircle, Loader2 
} from "lucide-react";

export function InngestDashboardPage() {
  const [selectedFunction, setSelectedFunction] = useState<string | null>(null);
  const [runStatusFilter, setRunStatusFilter] = useState<string>("");

  // Connection status
  const { data: status } = useQuery({
    queryKey: ["inngest-status"],
    queryFn: inngestApi.getStatus,
    refetchInterval: 30000,
  });

  // Functions list
  const { data: functionsData, isLoading: functionsLoading } = useQuery({
    queryKey: ["inngest-functions"],
    queryFn: inngestApi.getFunctions,
    refetchInterval: 60000,
  });

  // Runs for selected function
  const { data: runsData, isLoading: runsLoading } = useQuery({
    queryKey: ["inngest-runs", selectedFunction, runStatusFilter],
    queryFn: () => inngestApi.getFunctionRuns(selectedFunction!, runStatusFilter),
    enabled: !!selectedFunction,
    refetchInterval: 10000,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "complete":
      case "active":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "running":
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "success" | "error" | "warning" | "info" | "default"> = {
      complete: "success",
      active: "success",
      failed: "error",
      running: "info",
      pending: "warning",
      paused: "default",
    };
    return <Badge variant={variants[status] ?? "default"}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Inngest Dashboard" 
        description="Monitor and manage background workflows"
      />

      {/* Connection Status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Connection Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {status?.status === "connected" ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-sm">
                  Connected to Inngest ({status.mode}) — {status.url}
                </span>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 text-red-500" />
                <span className="text-sm text-red-500">
                  {status?.error ?? "Unable to connect to Inngest"}
                </span>
                <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                  Retry
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="functions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="functions">Functions</TabsTrigger>
          <TabsTrigger value="runs" disabled={!selectedFunction}>
            Runs {selectedFunction && `(${(runsData?.runs ?? []).length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="functions">
          <Card>
            <CardHeader>
              <CardTitle>Registered Functions</CardTitle>
            </CardHeader>
            <CardContent>
              {functionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Function</TableHead>
                      <TableHead>Triggers</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {functionsData?.functions?.map((fn: any) => (
                      <TableRow key={fn.id}>
                        <TableCell className="font-medium">{fn.name}</TableCell>
                        <TableCell>
                          {fn.triggers?.map((t: any) => (
                            <Badge key={t.type} variant="outline" className="mr-1">
                              {t.event ?? t.cron ?? t.type}
                            </Badge>
                          ))}
                        </TableCell>
                        <TableCell>{getStatusBadge(fn.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setSelectedFunction(fn.id)}
                            >
                              View Runs
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => inngestApi.triggerTest(fn.id)}
                            >
                              <PlayCircle className="w-4 h-4 mr-1" />
                              Test
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!functionsData?.functions || functionsData.functions.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No functions registered. Functions are created automatically when defined in the server.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="runs">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Function Runs</CardTitle>
              <div className="flex gap-2">
                <select 
                  className="border rounded px-2 py-1 text-sm"
                  value={runStatusFilter}
                  onChange={(e) => setRunStatusFilter(e.target.value)}
                >
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="running">Running</option>
                  <option value="complete">Complete</option>
                  <option value="failed">Failed</option>
                </select>
                <Button variant="outline" size="sm" onClick={() => setSelectedFunction(null)}>
                  Back to Functions
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {runsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Run ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Ended</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runsData?.runs?.map((run: any) => (
                      <TableRow key={run.id}>
                        <TableCell className="font-mono text-xs">{run.id.slice(0, 8)}...</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(run.status)}
                            {getStatusBadge(run.status)}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(run.startedAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm">
                          {run.endedAt ? new Date(run.endedAt).toLocaleString() : "—"}
                        </TableCell>
                        <TableCell>
                          {run.status === "running" && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => inngestApi.cancelRun(run.id)}
                            >
                              Cancel
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!runsData?.runs || runsData.runs.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No runs found for this function.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

**Add route** — Update `apps/dashboard/src/App.tsx`:

```typescript
import { InngestDashboardPage } from "./pages/admin/InngestDashboardPage";

// Add to routes:
{
  path: "/admin/inngest",
  element: <InngestDashboardPage />,
},
```

---

**Add navigation link** — Update `apps/dashboard/src/components/admin/Sidebar.tsx`:

```typescript
// Add to navItems:
{
  title: "Inngest",
  href: "/admin/inngest",
  icon: Activity,
}
```

---

**Acceptance criteria:**
- Dashboard shows connection status (connected/error) with mode indicator
- Functions tab displays all registered Inngest functions with triggers and status
- Each function shows "View Runs" and "Test" action buttons
- Runs tab filters by status (pending, running, complete, failed)
- Running runs show "Cancel" button
- Test button triggers event and shows confirmation
- Auto-refresh for status (30s) and functions (60s), runs (10s)
- Empty states for no functions and no runs
- Uses existing UI components (Card, Table, Badge, Tabs)
- Responsive layout

---

## Execution Order Summary

```
Phase 1 — Backend Routes
  IDG-01  Inngest API proxy routes + instance settings

Phase 2 — Frontend Dashboard
  IDG-02  Inngest Dashboard page + routing + nav
```

**Total: 2 tasks across 2 phases.**

---

## Dependencies

| Package | Added To | Purpose |
|---------|----------|---------|
| `lucide-react` | `apps/dashboard` | Icons (CheckCircle, XCircle, Loader2, etc.) |

---

## New Files Created

| File | Purpose |
|------|---------|
| `packages/server/src/routes/admin/inngest.ts` | Inngest API proxy routes |
| `packages/server/migrations/015_inngest_settings.sql` | Inngest instance settings |
| `apps/dashboard/src/lib/inngest-client.ts` | Inngest API client |
| `apps/dashboard/src/pages/admin/InngestDashboardPage.tsx` | Dashboard UI |

## Files Modified

| File | Change |
|------|--------|
| `packages/server/src/routes/admin/index.ts` | Register inngest routes |
| `apps/dashboard/src/lib/types.ts` | Add Inngest types |
| `apps/dashboard/src/App.tsx` | Add route |
| `apps/dashboard/src/components/admin/Sidebar.tsx` | Add nav link |

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `INNGEST_BASE_URL` | No | Defaults to `https://api.inngest.com` |
| `INNGEST_API_KEY` | Cloud only | API key for Inngest cloud |
| `INNGEST_SIGNING_KEY` | Yes (production) | Already configured |

---

*End of specification. 2 tasks across 2 phases.*