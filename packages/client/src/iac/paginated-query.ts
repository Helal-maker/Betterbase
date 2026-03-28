import type { QueryRegistration } from "@betterbase/core/iac";
import { useCallback, useEffect, useState } from "react";
import { useBetterBaseContext } from "./provider";

export interface UsePaginatedQueryResult<T> {
	results: T[];
	status: "loading" | "success" | "error";
	pageSize: number;
	loadMore: () => void;
	isLoading: boolean;
	isDone: boolean;
}

/**
 * Cursor-based paginated query hook.
 *
 * The query function must accept `{ cursor: string | null, numItems: number }` args
 * and return `{ page: T[], isDone: boolean, cursor: string | null }`.
 */
export function usePaginatedQuery<T>(
	fn: QueryRegistration<any, { page: T[]; isDone: boolean; cursor: string | null }>,
	baseArgs: Record<string, unknown>,
	opts: { initialNumItems?: number } = {},
): UsePaginatedQueryResult<T> {
	const { config, getToken } = useBetterBaseContext();
	const path = (fn as any).__betterbasePath as string;
	const numItems = opts.initialNumItems ?? 10;

	const [results, setResults] = useState<T[]>([]);
	const [cursor, setCursor] = useState<string | null>(null);
	const [isDone, setIsDone] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

	const loadPage = useCallback(
		async (cursorVal: string | null) => {
			setIsLoading(true);
			try {
				const token = getToken?.();
				const res = await fetch(`${config.url}/betterbase/${path}`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						...(token ? { Authorization: `Bearer ${token}` } : {}),
					},
					body: JSON.stringify({ args: { ...baseArgs, cursor: cursorVal, numItems } }),
				});
				const { result } = await res.json();
				setResults((prev) => (cursorVal === null ? result.page : [...prev, ...result.page]));
				setCursor(result.cursor);
				setIsDone(result.isDone);
				setStatus("success");
			} catch {
				setStatus("error");
			} finally {
				setIsLoading(false);
			}
		},
		[config.url, path, getToken, baseArgs, numItems],
	);

	// Initial load
	useEffect(() => {
		loadPage(null);
	}, [loadPage]);

	const loadMore = useCallback(() => {
		if (!isDone && !isLoading) {
			loadPage(cursor);
		}
	}, [isDone, isLoading, cursor, loadPage]);

	return { results, status, pageSize: numItems, loadMore, isLoading, isDone };
}
