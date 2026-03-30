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
import { QK } from "@/lib/query-keys";
import { useQuery } from "@tanstack/react-query";
import { Activity, Clock, Play, Zap } from "lucide-react";
import { useParams } from "react-router";

export default function ProjectIaCFunctionsPage() {
	const { projectId } = useParams();

	const { data, isLoading } = useQuery({
		queryKey: QK.projectFunctions(projectId!),
		queryFn: () => api.get<any>(`/admin/projects/${projectId}/iac/functions`),
	});

	if (isLoading) return <PageSkeleton />;

	const functions = data?.functions ?? [];
	const queries = functions.filter((f: any) => f.kind === "query");
	const mutations = functions.filter((f: any) => f.kind === "mutation");
	const actions = functions.filter((f: any) => f.kind === "action");

	return (
		<div>
			<PageHeader title="IaC Functions" description="View your queries, mutations, and actions" />

			<div className="px-8 pb-8 space-y-6">
				{functions.length === 0 ? (
					<Card>
						<CardContent className="py-12 text-center">
							<Zap
								size={48}
								className="mx-auto mb-4"
								style={{ color: "var(--color-text-muted)" }}
							/>
							<p style={{ color: "var(--color-text-secondary)" }}>No IaC functions found</p>
							<p className="text-sm mt-2" style={{ color: "var(--color-text-muted)" }}>
								Add functions to bbf/queries/, bbf/mutations/, or bbf/actions/
							</p>
						</CardContent>
					</Card>
				) : (
					<>
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Activity size={18} /> Summary
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-3 gap-4">
									<div
										className="p-4 rounded-lg"
										style={{ background: "var(--color-surface-overlay)" }}
									>
										<div className="text-2xl font-bold">{queries.length}</div>
										<div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
											Queries
										</div>
									</div>
									<div
										className="p-4 rounded-lg"
										style={{ background: "var(--color-surface-overlay)" }}
									>
										<div className="text-2xl font-bold">{mutations.length}</div>
										<div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
											Mutations
										</div>
									</div>
									<div
										className="p-4 rounded-lg"
										style={{ background: "var(--color-surface-overlay)" }}
									>
										<div className="text-2xl font-bold">{actions.length}</div>
										<div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
											Actions
										</div>
									</div>
								</div>
							</CardContent>
						</Card>

						{queries.length > 0 && (
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<Zap size={18} /> Queries
									</CardTitle>
								</CardHeader>
								<CardContent>
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Name</TableHead>
												<TableHead>Path</TableHead>
												<TableHead>Module</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{queries.map((fn: any) => (
												<TableRow key={fn.name}>
													<TableCell className="font-medium">{fn.name}</TableCell>
													<TableCell className="font-mono text-sm">{fn.path}</TableCell>
													<TableCell
														className="text-sm"
														style={{ color: "var(--color-text-muted)" }}
													>
														{fn.module}
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</CardContent>
							</Card>
						)}

						{mutations.length > 0 && (
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<Play size={18} /> Mutations
									</CardTitle>
								</CardHeader>
								<CardContent>
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Name</TableHead>
												<TableHead>Path</TableHead>
												<TableHead>Module</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{mutations.map((fn: any) => (
												<TableRow key={fn.name}>
													<TableCell className="font-medium">{fn.name}</TableCell>
													<TableCell className="font-mono text-sm">{fn.path}</TableCell>
													<TableCell
														className="text-sm"
														style={{ color: "var(--color-text-muted)" }}
													>
														{fn.module}
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</CardContent>
							</Card>
						)}

						{actions.length > 0 && (
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<Clock size={18} /> Actions
									</CardTitle>
								</CardHeader>
								<CardContent>
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Name</TableHead>
												<TableHead>Path</TableHead>
												<TableHead>Module</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{actions.map((fn: any) => (
												<TableRow key={fn.name}>
													<TableCell className="font-medium">{fn.name}</TableCell>
													<TableCell className="font-mono text-sm">{fn.path}</TableCell>
													<TableCell
														className="text-sm"
														style={{ color: "var(--color-text-muted)" }}
													>
														{fn.module}
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</CardContent>
							</Card>
						)}
					</>
				)}
			</div>
		</div>
	);
}
 
