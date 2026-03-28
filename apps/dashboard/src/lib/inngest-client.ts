const API_BASE = "/admin/inngest";

export interface InngestStatus {
	status: "connected" | "error";
	mode: "self-hosted" | "cloud";
	url: string;
	error?: string;
}

export interface InngestFunction {
	id: string;
	name: string;
	status: "active" | "paused";
	createdAt: string;
	triggers: { type: string; event?: string; cron?: string }[];
}

export interface InngestRun {
	id: string;
	functionId: string;
	status: "pending" | "running" | "complete" | "failed";
	startedAt: string;
	endedAt?: string;
	output?: string;
}

export const inngestApi = {
	getStatus: () => fetch(`${API_BASE}/status`).then((r) => r.json() as Promise<InngestStatus>),

	getFunctions: () =>
		fetch(`${API_BASE}/functions`).then((r) => r.json()) as Promise<{
			functions: InngestFunction[];
		}>,

	getFunctionRuns: (functionId: string, status?: string) => {
		const params = new URLSearchParams();
		if (status) params.append("status", status);
		return fetch(`${API_BASE}/functions/${functionId}/runs?${params}`).then((r) =>
			r.json(),
		) as Promise<{ runs: InngestRun[] }>;
	},

	getRun: (runId: string) => fetch(`${API_BASE}/runs/${runId}`).then((r) => r.json()),

	triggerTest: (functionId: string) =>
		fetch(`${API_BASE}/functions/${functionId}/test`, { method: "POST" }).then((r) => r.json()),

	cancelRun: (runId: string) =>
		fetch(`${API_BASE}/runs/${runId}/cancel`, { method: "POST" }).then((r) => r.json()),

	getJobs: () => fetch(`${API_BASE}/jobs`).then((r) => r.json()),
};
