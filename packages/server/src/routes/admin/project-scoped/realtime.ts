import { subscriptionTracker } from "@betterbase/core";
import { Hono } from "hono";
import { getWSStats } from "../../../routes/bbf/ws";

export const projectRealtimeRoutes = new Hono();

// GET /admin/projects/:id/realtime/stats
projectRealtimeRoutes.get("/stats", async (c) => {
	const wsStats = getWSStats();

	return c.json({
		connected_clients: wsStats.clients,
		active_subscriptions: subscriptionTracker.size,
		active_channels: wsStats.channels.length,
		channels: wsStats.channels,
		subscription_paths: subscriptionTracker.getActivePaths(),
	});
});
