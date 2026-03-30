import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Activity, Wifi, WifiOff } from "lucide-react";
import { useParams } from "react-router";

export default function ProjectIaCRealtimePage() {
	const { projectId } = useParams();

	const { data, isLoading, refetch } = useQuery({
		queryKey: ["iac-realtime", projectId],
		queryFn: () => api.get<any>(`/admin/projects/${projectId}/iac/realtime`),
		refetchInterval: 5000,
	});

	if (isLoading) return <PageSkeleton />;

	const activeConnections = data?.active_connections ?? 0;
	const recentEvents = data?.recent_events ?? [];

	return (
		<div>
			<PageHeader title="Realtime Connections" description="Monitor live WebSocket connections" />

			<div className="px-8 pb-8 space-y-6">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Activity size={18} /> Connection Stats
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-2 gap-4">
							<div
								className="p-4 rounded-lg"
								style={{ background: "var(--color-surface-overlay)" }}
							>
								<div className="flex items-center gap-2 mb-2">
									<Wifi size={16} style={{ color: "var(--color-success)" }} />
									<span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
										Active Connections
									</span>
								</div>
								<div className="text-3xl font-bold">{activeConnections}</div>
							</div>
							<div
								className="p-4 rounded-lg"
								style={{ background: "var(--color-surface-overlay)" }}
							>
								<div className="flex items-center gap-2 mb-2">
									<Activity size={16} style={{ color: "var(--color-info)" }} />
									<span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
										Events (last hour)
									</span>
								</div>
								<div className="text-3xl font-bold">
									{recentEvents.reduce((sum: number, e: any) => sum + Number.parseInt(e.count), 0)}
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Activity size={18} /> Recent Events
						</CardTitle>
					</CardHeader>
					<CardContent>
						{recentEvents.length === 0 ? (
							<p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
								No events in the last hour
							</p>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Event Type</TableHead>
										<TableHead>Table</TableHead>
										<TableHead>Count</TableHead>
										<TableHead>Last Event</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{recentEvents.map((event: any) => (
										<TableRow key={`${event.event_type}-${event.table_name}`}>
											<TableCell>
												<Badge
													variant={
														event.event_type === "INSERT"
															? "default"
															: event.event_type === "UPDATE"
																? "outline"
																: "secondary"
													}
												>
													{event.event_type}
												</Badge>
											</TableCell>
											<TableCell className="font-mono">{event.table_name}</TableCell>
											<TableCell>{event.count}</TableCell>
											<TableCell className="text-sm">
												{event.last_event ? new Date(event.last_event).toLocaleString() : "-"}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<WifiOff size={18} /> How it works
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
							Realtime subscriptions are automatically enabled for all queries. Clients connect via
							WebSocket and receive live updates when data changes.
						</p>
						<div className="mt-4 text-sm space-y-2" style={{ color: "var(--color-text-muted)" }}>
							<p>
								<code className="font-mono">ws://localhost:3001/bbf/ws</code> — WebSocket endpoint
							</p>
							<p>
								Clients subscribe to tables and receive <code className="font-mono">INSERT</code>,{" "}
								<code className="font-mono">UPDATE</code>, <code className="font-mono">DELETE</code>{" "}
								events
							</p>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
 
