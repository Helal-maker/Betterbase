import { EventSchemas, Inngest } from "inngest";

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
					`Webhook delivery failed: HTTP ${res.status} from ${url} — ${responseBody.slice(0, 200)}`,
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
				],
			);
		});

		return {
			success: true,
			webhookId,
			httpStatus: deliveryResult.httpStatus,
			durationMs: deliveryResult.durationMs,
		};
	},
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
					"SELECT * FROM betterbase_meta.smtp_config WHERE id = 'singleton' AND enabled = TRUE",
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
	},
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
				params,
			);
			return rows;
		});

		// Step 2: Build CSV
		const csv = await step.run("build-csv", async () => {
			const header = "id,name,email,email_verified,created_at,banned\n";
			const body = rows
				.map(
					(r: any) =>
						`${r.id},"${r.name}","${r.email}",${r.email_verified},${r.created_at},${r.banned}`,
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
				[projectId, requestedBy, rows.length, csv],
			);
		});

		return { projectId, rowCount: rows.length, requestedBy };
	},
);

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
				"SELECT * FROM betterbase_meta.notification_rules WHERE enabled = TRUE",
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
				error_rate: Number.parseFloat(errorRate.rows[0]?.value ?? "0"),
				response_time_p99: Number.parseInt(responsetime.rows[0]?.value ?? "0"),
				// storage_pct and auth_failures are placeholders for future metrics
				storage_pct: 0,
				auth_failures: 0,
			} as Record<string, number>;
		});

		// Step 3: Fan out — one event per rule that needs evaluation
		// Inngest processes these in parallel; each gets its own trace
		const eventsToSend = rules.map((rule: any) => ({
			name: "betterbase/notification.evaluate" as const,
			data: {
				ruleId: rule.id,
				ruleName: rule.name,
				metric: rule.metric,
				threshold: Number.parseFloat(rule.threshold),
				channel: rule.channel as "email" | "webhook",
				target: rule.target,
				currentValue: metricValues[rule.metric] ?? 0,
			},
		}));

		if (eventsToSend.length > 0) {
			await inngest.send(eventsToSend);
		}

		return {
			evaluated: rules.length,
			breaches: eventsToSend.filter((e) => e.data.currentValue >= e.data.threshold).length,
		};
	},
);

// ─── All functions (used in serve() registration) ────────────────────────────

export const allInngestFunctions = [
	deliverWebhook,
	evaluateNotificationRule,
	exportProjectUsers,
	pollNotificationRules,
];
