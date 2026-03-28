import { getPool } from "./db";
import { inngest } from "./inngest";

/**
 * Called by the database change listener (or webhooks integrator) when a
 * table mutation event fires. Looks up all matching enabled webhooks and
 * dispatches one Inngest event per webhook.
 */
export async function dispatchWebhookEvents(
	tableName: string,
	eventType: "INSERT" | "UPDATE" | "DELETE",
	record: unknown,
): Promise<void> {
	const pool = getPool();

	// Find all enabled webhooks that match this table + event
	const { rows: webhooks } = await pool.query(
		`SELECT id, name, url, secret
     FROM betterbase_meta.webhooks
     WHERE table_name = $1
       AND $2 = ANY(events)
       AND enabled = TRUE`,
		[tableName, eventType],
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
		})),
	);
}
