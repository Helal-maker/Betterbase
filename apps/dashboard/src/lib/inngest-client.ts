const API_BASE = "/admin/inngest";

// Helper to handle fetch responses with error checking
async function fetchInngest<T>(url: string, options?: RequestInit): Promise<T> {
	const res = await fetch(url, options);
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw new Error(data.error ?? `HTTP ${res.status}`);
	}
	return data as T;
}

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
	error?: string;
}

export const inngestApi = {
	getStatus: () => fetchInngest<InngestStatus>(`${API_BASE}/status`),

	getFunctions: () => fetchInngest<{ functions: InngestFunction[] }>(`${API_BASE}/functions`),

	getFunctionRuns: (functionId: string, status?: string) => {
		const params = new URLSearchParams();
		if (status) params.append("status", status);
		return fetchInngest<{ runs: InngestRun[] }>(
			`${API_BASE}/functions/${functionId}/runs?${params}`,
		);
	},

	getRun: (runId: string) => fetchInngest<any>(`${API_BASE}/runs/${runId}`),

	triggerTest: (functionId: string) =>
		fetchInngest<{ success: boolean; message: string }>(
			`${API_BASE}/functions/${functionId}/test`,
			{ method: "POST" },
		),

	cancelRun: (runId: string) =>
		fetchInngest<{ success: boolean; message?: string }>(`${API_BASE}/runs/${runId}/cancel`, {
			method: "POST",
		}),

	getJobs: () => fetchInngest<{ jobs: any[] }>(`${API_BASE}/jobs`),
};
 
