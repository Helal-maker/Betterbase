import { getPool } from "./db";
import { inngest } from "./inngest";

/**
 * Called by the database change listener (or webhooks integrator) when a
 * table mutation event fires. Looks up all matching enabled webhooks and
 * dispatches one Inngest event per webhook.
 *
 * Note: The secret is NOT included in the event payload for security.
 * The deliverWebhook function will look up the secret from the database
 * when signing the outbound request.
 */
export async function dispatchWebhookEvents(
	tableName: string,
	eventType: "INSERT" | "UPDATE" | "DELETE",
	record: unknown,
): Promise<void> {
	const pool = getPool();

	// Find all enabled webhooks that match this table + event
	// Note: We DON'T include secret in the event payload - it's looked up at delivery time
	const { rows: webhooks } = await pool.query(
		`SELECT id, name, url
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
				secret: null, // Secret looked up at delivery time for security
					eventType,
					tableName,
					payload: record,
				},
			})),
		);
}
