import { Hono } from "hono";
import { getPool } from "../../lib/db";

export const inngestAdminRoutes = new Hono();

const getInngestBaseUrl = (): string => {
	return process.env.INNGEST_BASE_URL ?? "https://api.inngest.com";
};

const getInngestHeaders = async (): Promise<HeadersInit> => {
	const pool = getPool();
	const { rows } = await pool.query(
		"SELECT value FROM betterbase_meta.instance_settings WHERE key = 'inngest_api_key'",
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
		"SELECT value FROM betterbase_meta.instance_settings WHERE key = 'inngest_env_id'",
	);
	return rows[0]?.value ?? null;
};

const isSelfHosted = (): boolean => {
	const baseUrl = getInngestBaseUrl();
	return baseUrl !== "https://api.inngest.com";
};

// GET /admin/inngest/status — Check Inngest connection status
inngestAdminRoutes.get("/status", async (c) => {
	try {
		const baseUrl = getInngestBaseUrl();

		if (isSelfHosted()) {
			const res = await fetch(`${baseUrl}/health`);
			const healthy = res.ok;

			return c.json({
				status: healthy ? "connected" : "error",
				mode: "self-hosted",
				url: baseUrl,
			});
		} else {
			const headers = await getInngestHeaders();
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

// GET /admin/inngest/functions — List all registered functions
inngestAdminRoutes.get("/functions", async (c) => {
	try {
		const baseUrl = getInngestBaseUrl();
		const headers = await getInngestHeaders();
		const envId = await getInngestEnv();

		if (isSelfHosted()) {
			// Self-hosted Inngest has different API structure
			// Return local functions from inngest.ts
			const { inngest, allInngestFunctions } = await import("../../lib/inngest");

			const functions = allInngestFunctions.map((fn) => ({
				id: fn.id,
				name: fn.id,
				status: "active",
				createdAt: new Date().toISOString(),
				triggers: [{ type: "event", event: `betterbase/${fn.id.split("-").pop()}` }],
			}));

			return c.json({ functions });
		}

		const url = envId ? `${baseUrl}/v1/environments/${envId}/functions` : `${baseUrl}/v1/functions`;

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
		const status = c.req.query("status");

		const params = new URLSearchParams({ limit: String(limit) });
		if (status) params.append("status", status);

		if (isSelfHosted()) {
			// Self-hosted: query from database webhook_deliveries
			const pool = getPool();
			const { rows } = await pool.query(
				`SELECT id, webhook_id as function_id, status, created_at as started_at, 
                delivered_at as ended_at, response_code, duration_ms
         FROM betterbase_meta.webhook_deliveries
         WHERE webhook_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
				[functionId, limit],
			);

			const runs = rows.map((r: any) => ({
				id: r.id,
				functionId: r.function_id,
				status: r.status === "success" ? "complete" : r.status === "pending" ? "pending" : "failed",
				startedAt: r.started_at,
				endedAt: r.ended_at,
				output: r.response_code ? `HTTP ${r.response_code} (${r.duration_ms}ms)` : null,
			}));

			return c.json({ runs });
		}

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

		if (isSelfHosted()) {
			// Self-hosted: get from database
			const pool = getPool();
			const { rows } = await pool.query(
				`SELECT * FROM betterbase_meta.webhook_deliveries WHERE id = $1`,
				[runId],
			);

			if (rows.length === 0) {
				return c.json({ error: "Run not found" }, 404);
			}

			const r = rows[0];
			return c.json({
				id: r.id,
				functionId: r.webhook_id,
				status: r.status === "success" ? "complete" : r.status,
				startedAt: r.created_at,
				endedAt: r.delivered_at,
				output: r.response_body,
				history: [{ name: "send-http-request", status: r.status, output: r.response_body }],
			});
		}

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

		const functionEventMap: Record<string, string> = {
			"deliver-webhook": "betterbase/webhook.deliver",
			"evaluate-notification-rule": "betterbase/notification.evaluate",
			"export-project-users": "betterbase/export.users",
			"poll-notification-rules": "betterbase/notification.evaluate",
		};

		const eventName = functionEventMap[functionId];
		if (!eventName) {
			// Try to derive from function ID
			const mapped = Object.entries(functionEventMap).find(([k]) => functionId.includes(k));
			if (mapped) {
				eventName = mapped[1];
			} else {
				return c.json({ error: "Unknown function type" }, 400);
			}
		}

		const { inngest } = await import("../../lib/inngest");
		await inngest.send({
			name: eventName,
			data: {
				_test: true,
				triggeredAt: new Date().toISOString(),
				source: "admin-dashboard",
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

		if (isSelfHosted()) {
			// Self-hosted: cannot cancel (webhooks are fire-and-forget from DB perspective)
			return c.json(
				{
					success: false,
					error: "Cannot cancel runs in self-hosted mode. Runs are synchronous.",
				},
				400,
			);
		}

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

// GET /admin/inngest/jobs — List export jobs (from DB)
inngestAdminRoutes.get("/jobs", async (c) => {
	try {
		const pool = getPool();
		const limit = Math.min(Number.parseInt(c.req.query("limit") ?? "20"), 100);

		const { rows } = await pool.query(
			`SELECT * FROM betterbase_meta.export_jobs
       ORDER BY created_at DESC
       LIMIT $1`,
			[limit],
		);

		return c.json({ jobs: rows });
	} catch (err: any) {
		return c.json({ error: err.message }, 500);
	}
});
