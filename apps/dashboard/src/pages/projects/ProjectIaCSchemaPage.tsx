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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { QK } from "@/lib/query-keys";
import { useQuery } from "@tanstack/react-query";
import { Database, Key, ListOrdered, Table2 } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";

export default function ProjectIaCSchemaPage() {
	const { projectId } = useParams();
	const [selectedTable, setSelectedTable] = useState<string | null>(null);

	const { data, isLoading } = useQuery({
		queryKey: QK.projectDatabase(projectId!),
		queryFn: () => api.get<any>(`/admin/projects/${projectId}/iac/schema`),
	});

	if (isLoading) return <PageSkeleton />;

	const schema = data?.schema ?? {};
	const tables = Object.keys(schema);

	return (
		<div>
			<PageHeader title="IaC Schema" description="View your bbf/schema.ts tables and indexes" />

			<div className="px-8 pb-8">
				<Tabs defaultValue="tables">
					<TabsList>
						<TabsTrigger value="tables" className="flex items-center gap-1.5">
							<Table2 size={14} /> Tables
						</TabsTrigger>
						<TabsTrigger value="indexes" className="flex items-center gap-1.5">
							<ListOrdered size={14} /> Indexes
						</TabsTrigger>
					</TabsList>

					<TabsContent value="tables">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Database size={18} /> Tables ({tables.length})
								</CardTitle>
							</CardHeader>
							<CardContent>
								{tables.length === 0 ? (
									<p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
										No tables found. Add tables to bbf/schema.ts and run bb iac sync.
									</p>
								) : (
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Table Name</TableHead>
												<TableHead>Columns</TableHead>
												<TableHead>Indexes</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{tables.map((tableName) => {
												const table = schema[tableName];
												return (
													<TableRow
														key={tableName}
														className="cursor-pointer"
														onClick={() => setSelectedTable(tableName)}
													>
														<TableCell className="font-mono font-medium">{tableName}</TableCell>
														<TableCell>
															<Badge variant="secondary">{table.columns.length} columns</Badge>
														</TableCell>
														<TableCell>
															<Badge variant="outline">{table.indexes.length} indexes</Badge>
														</TableCell>
													</TableRow>
												);
											})}
										</TableBody>
									</Table>
								)}
							</CardContent>
						</Card>

						{selectedTable && schema[selectedTable] && (
							<Card className="mt-4">
								<CardHeader>
									<CardTitle className="font-mono text-sm">{selectedTable}</CardTitle>
								</CardHeader>
								<CardContent>
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Column</TableHead>
												<TableHead>Type</TableHead>
												<TableHead>Nullable</TableHead>
												<TableHead>Default</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{schema[selectedTable].columns.map((col: any) => (
												<TableRow key={col.column_name}>
													<TableCell className="font-mono">{col.column_name}</TableCell>
													<TableCell>
														<Badge variant="outline">{col.data_type}</Badge>
													</TableCell>
													<TableCell>{col.is_nullable}</TableCell>
													<TableCell className="text-xs font-mono">
														{col.column_default ?? "-"}
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</CardContent>
							</Card>
						)}
					</TabsContent>

					<TabsContent value="indexes">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<ListOrdered size={18} /> All Indexes
								</CardTitle>
							</CardHeader>
							<CardContent>
								{Object.entries(schema).map(([tableName, table]: [string, any]) =>
									table.indexes.map((idx: any) => (
										<div
											key={idx.indexname}
											className="flex items-center justify-between py-2 border-b last:border-0"
										>
											<div>
												<span className="font-mono text-sm">{idx.indexname}</span>
												<span className="text-xs ml-2" style={{ color: "var(--color-text-muted)" }}>
													on {tableName}
												</span>
											</div>
											<Badge variant="secondary" className="font-mono text-xs">
												{idx.indexdef}
											</Badge>
										</div>
									)),
								)}
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
 
