import type {
	ActionRegistration,
	MutationRegistration,
	QueryRegistration,
} from "@betterbase/core/iac";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBetterBaseContext } from "./provider";

// ─── Internal fetch helper ────────────────────────────────────────────────────

async function callBetterBase<T>(
	baseUrl: string,
	path: string,
	args: unknown,
	getToken?: () => string | null,
): Promise<T> {
	const token = getToken?.();
	const res = await fetch(`${baseUrl}/betterbase/${path}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		body: JSON.stringify({ args }),
	});

	if (!res.ok) {
		const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
		throw new Error((body as any).error ?? `HTTP ${res.status}`);
	}

	const { result } = await res.json();
	return result as T;
}

// ─── useQuery ────────────────────────────────────────────────────────────────

export type QueryStatus = "loading" | "success" | "error";

export interface UseQueryResult<T> {
	data: T | undefined;
	status: QueryStatus;
	isLoading: boolean;
	isError: boolean;
	error: Error | null;
	refetch: () => void;
}

export function useQuery<TReturn>(
	fn: QueryRegistration<any, TReturn>,
	args: Record<string, unknown> = {},
): UseQueryResult<TReturn> {
	const { config, ws, wsReady } = useBetterBaseContext();
	const path = (fn as any).__betterbasePath as string;
	const argsJson = useMemo(() => JSON.stringify(args), [args]);

	const [data, setData] = useState<TReturn | undefined>(undefined);
	const [status, setStatus] = useState<QueryStatus>("loading");
	const [error, setError] = useState<Error | null>(null);
	const abortRef = useRef<AbortController | null>(null);

	const fetchData = useCallback(async () => {
		abortRef.current?.abort();
		const ctrl = new AbortController();
		abortRef.current = ctrl;

		setStatus("loading");
		try {
			const result = await callBetterBase<TReturn>(
				config.url,
				path,
				JSON.parse(argsJson),
				config.getToken,
			);
			if (ctrl.signal.aborted) return;
			setData(result);
			setStatus("success");
			setError(null);
		} catch (e: any) {
			if (ctrl.signal.aborted) return;
			setError(e);
			setStatus("error");
		}
	}, [config.url, path, argsJson, config.getToken]);

	// Fetch on mount and args change
	useEffect(() => {
		fetchData();
	}, [fetchData]);

	// Subscribe to invalidations via WebSocket
	useEffect(() => {
		if (!ws || !wsReady) return;

		ws.send(JSON.stringify({ type: "subscribe", path, args: JSON.parse(argsJson) }));

		const handler = (event: MessageEvent) => {
			const msg = JSON.parse(event.data);
			if (msg.type === "invalidate" && msg.functionPath === path) {
				const msgArgsJson = JSON.stringify(msg.args);
				if (msgArgsJson === argsJson || msgArgsJson === "{}") {
					fetchData();
				}
			}
		};

		ws.addEventListener("message", handler);

		return () => {
			ws.removeEventListener("message", handler);
			if (ws.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify({ type: "unsubscribe", path, args: JSON.parse(argsJson) }));
			}
		};
	}, [ws, wsReady, path, argsJson, fetchData]);

	return {
		data,
		status,
		isLoading: status === "loading",
		isError: status === "error",
		error,
		refetch: fetchData,
	};
}

// ─── useMutation ─────────────────────────────────────────────────────────────

export interface UseMutationResult<TArgs, TReturn> {
	mutate: (args: TArgs) => Promise<TReturn>;
	mutateAsync: (args: TArgs) => Promise<TReturn>;
	isPending: boolean;
	isError: boolean;
	error: Error | null;
	reset: () => void;
	/** Optimistic data set immediately when mutation is called */
	optimisticData: TReturn | null;
}

export function useMutation<TReturn = void>(
	fn: MutationRegistration<any, TReturn>,
): UseMutationResult<Record<string, unknown>, TReturn> {
	const { config } = useBetterBaseContext();
	const path = (fn as any).__betterbasePath as string;
	const optimisticFn = (fn as any)._optimistic as
		| ((args: Record<string, unknown>) => TReturn)
		| undefined;

	const [isPending, setIsPending] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const [optimisticData, setOptimisticData] = useState<TReturn | null>(null);

	const mutateAsync = useCallback(
		async (args: Record<string, unknown>): Promise<TReturn> => {
			setIsPending(true);
			setError(null);

			// Set optimistic data immediately if optimistic function exists
			if (optimisticFn) {
				const optData = optimisticFn(args) as TReturn;
				setOptimisticData(optData);
			}

			try {
				const result = await callBetterBase<TReturn>(config.url, path, args, config.getToken);
				// Replace optimistic data with real result
				setOptimisticData(result);
				return result;
			} catch (e: any) {
				setError(e);
				// Keep optimistic data visible but indicate error
				// Optionally you could revert by calling setOptimisticData(null)
				throw e;
			} finally {
				setIsPending(false);
			}
		},
		[config.url, path, config.getToken, optimisticFn],
	);

	const mutate = useCallback(
		(args: Record<string, unknown>) => {
			mutateAsync(args).catch(() => {}); // fire-and-forget variant
			return mutateAsync(args);
		},
		[mutateAsync],
	);

	const reset = useCallback(() => {
		setError(null);
		setOptimisticData(null);
	}, []);

	return {
		mutate,
		mutateAsync,
		isPending,
		isError: error !== null,
		error,
		reset,
		optimisticData,
	};
}

// ─── useAction ────────────────────────────────────────────────────────────────

export function useAction<TReturn = void>(
	fn: ActionRegistration<any, TReturn>,
): UseMutationResult<Record<string, unknown>, TReturn> {
	const { config } = useBetterBaseContext();
	const path = (fn as any).__betterbasePath as string;

	// Actions follow the same client pattern as mutations
	const mutationFn = { ...fn, __betterbasePath: path } as unknown as MutationRegistration<
		any,
		TReturn
	>;
	return useMutation(mutationFn);
}
