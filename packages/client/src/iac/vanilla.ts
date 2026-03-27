import type {
	ActionRegistration,
	MutationRegistration,
	QueryRegistration,
} from "@betterbase/core/iac";

export interface VanillaBBFClient {
	/** Call a query function and return the result */
	query<TReturn>(
		fn: QueryRegistration<any, TReturn>,
		args: Record<string, unknown>,
	): Promise<TReturn>;

	/** Call a mutation function */
	mutation<TReturn>(
		fn: MutationRegistration<any, TReturn>,
		args: Record<string, unknown>,
	): Promise<TReturn>;

	/** Call an action function */
	action<TReturn>(
		fn: ActionRegistration<any, TReturn>,
		args: Record<string, unknown>,
	): Promise<TReturn>;

	/** Subscribe to invalidations for a query (non-React, returns unsubscribe fn) */
	subscribe(
		fn: QueryRegistration<any, unknown>,
		args: Record<string, unknown>,
		onChange: () => void,
	): () => void;

	/** Close the WebSocket connection */
	close(): void;
}

export function createBBFClient(opts: {
	url: string;
	projectSlug?: string;
	getToken?: () => string | null;
}): VanillaBBFClient {
	const { url, projectSlug = "default", getToken } = opts;
	let ws: WebSocket | null = null;
	const listeners = new Map<string, Set<() => void>>();

	function getWS(): WebSocket {
		if (ws?.readyState === WebSocket.OPEN) return ws;
		const wsUrl = `${url.replace(/^http/, "ws")}/bbf/ws?project=${projectSlug}`;
		ws = new WebSocket(wsUrl);
		ws.onmessage = (event) => {
			const msg = JSON.parse(event.data);
			if (msg.type === "ping") ws?.send(JSON.stringify({ type: "pong" }));
			if (msg.type === "invalidate") {
				const key = msg.functionPath;
				for (const fn of listeners.get(key) ?? []) {
					fn();
				}
			}
		};
		return ws;
	}

	async function call(kind: string, fn: any, args: unknown): Promise<unknown> {
		const path = fn.__bbfPath ?? "unknown";
		const token = getToken?.();
		const res = await fetch(`${url}/bbf/${path}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(token ? { Authorization: `Bearer ${token}` } : {}),
			},
			body: JSON.stringify({ args }),
		});
		if (!res.ok) {
			const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
			throw new Error((body as any).error);
		}
		return (await res.json()).result;
	}

	return {
		query: (fn, args) => call("queries", fn, args) as any,
		mutation: (fn, args, onOptimistic?: (data: unknown) => void) => {
			// Call optimistic handler immediately if provided
			if (onOptimistic && fn._optimistic) {
				const optimisticData = fn._optimistic(args);
				onOptimistic(optimisticData);
			}
			return call("mutations", fn, args) as any;
		},
		action: (fn, args) => call("actions", fn, args) as any,

		subscribe(fn, args, onChange) {
			const path = (fn as any).__bbfPath ?? "unknown";
			if (!listeners.has(path)) listeners.set(path, new Set());
			listeners.get(path)!.add(onChange);

			const socket = getWS();
			if (socket.readyState === WebSocket.OPEN) {
				socket.send(JSON.stringify({ type: "subscribe", path, args }));
			} else {
				socket.addEventListener(
					"open",
					() => {
						socket.send(JSON.stringify({ type: "subscribe", path, args }));
					},
					{ once: true },
				);
			}

			return () => {
				listeners.get(path)?.delete(onChange);
				ws?.send(JSON.stringify({ type: "unsubscribe", path, args }));
			};
		},

		close() {
			ws?.close();
		},
	};
}
