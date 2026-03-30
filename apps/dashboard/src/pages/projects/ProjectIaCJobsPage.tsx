import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Clock, Pause, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";
import { toast } from "sonner";

export default function ProjectIaCJobsPage() {
	const { projectId } = useParams();
	const [pauseId, setPauseId] = useState<string | null>(null);

	const { data, isLoading, refetch } = useQuery({
		queryKey: ["iac-jobs", projectId],
		queryFn: () => api.get<any>(`/admin/projects/${projectId}/iac/jobs`),
	});

	if (isLoading) return <PageSkeleton />;

	const jobs = data?.jobs ?? [];

	const formatSchedule = (schedule: string) => {
		const parts = schedule.split(" ");
		if (parts.length === 5) {
			return `${parts[1]}/${parts[0]} ${parts[2]}:${parts[4]} * ${parts[3]}`;
		}
		return schedule;
	};

	return (
		<div>
			<PageHeader title="Scheduled Jobs" description="View and manage cron jobs from bbf/cron.ts" />

			<div className="px-8 pb-8">
				{jobs.length === 0 ? (
					<Card>
						<CardContent className="py-12 text-center">
							<Clock
								size={48}
								className="mx-auto mb-4"
								style={{ color: "var(--color-text-muted)" }}
							/>
							<p style={{ color: "var(--color-text-secondary)" }}>No scheduled jobs</p>
							<p className="text-sm mt-2" style={{ color: "var(--color-text-muted)" }}>
								Add cron jobs to bbf/cron.ts and run bb iac sync
							</p>
						</CardContent>
					</Card>
				) : (
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Clock size={18} /> Cron Jobs ({jobs.length})
							</CardTitle>
						</CardHeader>
						<CardContent>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Name</TableHead>
										<TableHead>Schedule</TableHead>
										<TableHead>Function</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Next Run</TableHead>
										<TableHead>Last Run</TableHead>
										<TableHead>Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{jobs.map((job: any) => (
										<TableRow key={job.id}>
											<TableCell className="font-medium">{job.name}</TableCell>
											<TableCell>
												<Badge variant="outline" className="font-mono">
													{job.schedule}
												</Badge>
											</TableCell>
											<TableCell className="font-mono text-sm">{job.function_path}</TableCell>
											<TableCell>
												<Badge variant={job.status === "active" ? "default" : "secondary"}>
													{job.status}
												</Badge>
											</TableCell>
											<TableCell className="text-sm">
												{job.next_run ? new Date(job.next_run).toLocaleString() : "-"}
											</TableCell>
											<TableCell className="text-sm">
												{job.last_run ? new Date(job.last_run).toLocaleString() : "-"}
											</TableCell>
											<TableCell>
												<div className="flex gap-2">
													<Button
														variant="ghost"
														size="icon"
														onClick={() => {
															setPauseId(job.id);
															toast.success(
																`Job ${job.status === "active" ? "paused" : "resumed"}`,
															);
														}}
													>
														{job.status === "active" ? <Pause size={14} /> : <Play size={14} />}
													</Button>
												</div>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				)}
			</div>
		</div>
	);
}
 
