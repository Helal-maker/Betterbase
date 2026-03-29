import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { z } from "zod";
import { getPool } from "../../../lib/db";
import { inngest } from "../../../lib/inngest";

export const projectWebhookRoutes = new Hono();

// GET /admin/projects/:id/webhooks
projectWebhookRoutes.get("/", async (c) => {
	const pool = getPool();
	const { rows } = await pool.query(
		`SELECT w.*,
            COUNT(wd.id)::int AS total_deliveries,
            COUNT(wd.id) FILTER (WHERE wd.status = 'success')::int AS successful_deliveries,
            MAX(wd.created_at) AS last_delivery_at
     FROM betterbase_meta.webhooks w
     LEFT JOIN betterbase_meta.webhook_deliveries wd ON wd.webhook_id = w.id
     GROUP BY w.id ORDER BY w.created_at DESC`,
	);
	return c.json({ webhooks: rows });
});

// GET /admin/projects/:id/webhooks/:webhookId/deliveries
projectWebhookRoutes.get("/:webhookId/deliveries", async (c) => {
	const pool = getPool();
	const limit = Math.min(Number.parseInt(c.req.query("limit") ?? "50"), 200);
	const offset = Number.parseInt(c.req.query("offset") ?? "0");

	const { rows } = await pool.query(
		`SELECT id, event_type, status, response_code, duration_ms, attempt_count, created_at, delivered_at
     FROM betterbase_meta.webhook_deliveries
     WHERE webhook_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
		[c.req.param("webhookId"), limit, offset],
	);

	return c.json({ deliveries: rows, limit, offset });
});

// GET /admin/projects/:id/webhooks/:webhookId/deliveries/:deliveryId
projectWebhookRoutes.get("/:webhookId/deliveries/:deliveryId", async (c) => {
	const pool = getPool();
	const { rows } = await pool.query(
		"SELECT * FROM betterbase_meta.webhook_deliveries WHERE id = $1 AND webhook_id = $2",
		[c.req.param("deliveryId"), c.req.param("webhookId")],
	);
	if (rows.length === 0) return c.json({ error: "Not found" }, 404);
	return c.json({ delivery: rows[0] });
});

// POST /admin/projects/:id/webhooks/:webhookId/retry
projectWebhookRoutes.post("/:webhookId/retry", async (c) => {
	const pool = getPool();
	const { rows: webhooks } = await pool.query(
		"SELECT * FROM betterbase_meta.webhooks WHERE id = $1",
		[c.req.param("webhookId")],
	);
	if (webhooks.length === 0) return c.json({ error: "Webhook not found" }, 404);

	const webhook = webhooks[0];

	// Get the latest FAILED delivery to use its payload for retry
	const { rows: lastDelivery } = await pool.query(
		`SELECT id, payload, attempt_count FROM betterbase_meta.webhook_deliveries
     WHERE webhook_id = $1 AND status = 'failed'
     ORDER BY created_at DESC LIMIT 1`,
		[webhook.id],
	);

	// If no failed delivery exists, return error
	if (lastDelivery.length === 0) {
		return c.json(
			{
				error: "No failed delivery found to retry. Ensure a delivery has previously failed.",
			},
			400,
		);
	}

	const failedDelivery = lastDelivery[0];
	const payload = failedDelivery.payload ?? {};
	const attempt = (failedDelivery.attempt_count ?? 0) + 1;

	// Insert a pending delivery record FIRST so we can track it
	// Then include the delivery ID in the event for the worker to update
	const { rows: newDelivery } = await pool.query(
		`INSERT INTO betterbase_meta.webhook_deliveries
       (webhook_id, event_type, payload, status, attempt_count)
     VALUES ($1, 'RETRY', $2, 'pending', $3)
     RETURNING id`,
		[webhook.id, JSON.stringify(payload), attempt],
	);

	const deliveryId = newDelivery[0].id;

	// Send event to Inngest with delivery ID included
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
			deliveryId, // Include so worker can update the specific row
		},
	});

	return c.json({
		success: true,
		message:
			"Retry queued via Inngest. Delivery will be attempted with automatic backoff on failure.",
	});
});

// POST /admin/projects/:id/webhooks/:webhookId/test
projectWebhookRoutes.post("/:webhookId/test", async (c) => {
	const pool = getPool();
	const { rows } = await pool.query("SELECT * FROM betterbase_meta.webhooks WHERE id = $1", [
		c.req.param("webhookId"),
	]);
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
