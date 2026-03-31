import React, { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import type { BetterBaseConfig } from "../types";

export type BetterBaseReactConfig = BetterBaseConfig & {
	/** Project slug — routes db queries to the right schema */
	projectSlug?: string;
	/** Token getter — called on each request */
	getToken?: () => string | null;
};

interface BetterBaseContextValue {
	config: BetterBaseReactConfig;
	ws: WebSocket | null;
	wsReady: boolean;
	getToken: (() => string | null) | undefined;
}

const BetterBaseContext = createContext<BetterBaseContextValue | null>(null);

export function BetterbaseProvider({
	config,
	children,
}: { config: BetterBaseReactConfig; children: ReactNode }) {
	const wsRef = useRef<WebSocket | null>(null);
	const [wsReady, setWsReady] = React.useState(false);

	useEffect(() => {
		let timeoutId: ReturnType<typeof setTimeout> | null = null;
		let isCleaned = false;
		let reconnectDelayMs = 3_000;
		const maxReconnectDelayMs = 30_000;

		function connect() {
			if (isCleaned) return;
			const wsUrl = `${config.url.replace(/^http/, "ws")}/betterbase/ws?project=${config.projectSlug ?? "default"}`;
			const ws = new WebSocket(wsUrl);
			wsRef.current = ws;

			ws.onopen = () => {
				if (!isCleaned) {
					setWsReady(true);
					reconnectDelayMs = 3_000;
				}
			};
			ws.onerror = (err) => {
				if (isCleaned) return;
				console.error("WebSocket error", err);
				setWsReady(false);
				timeoutId = setTimeout(connect, reconnectDelayMs);
				reconnectDelayMs = Math.min(reconnectDelayMs * 2, maxReconnectDelayMs);
			};
			ws.onclose = () => {
				if (isCleaned) return;
				setWsReady(false);
				timeoutId = setTimeout(connect, reconnectDelayMs);
				reconnectDelayMs = Math.min(reconnectDelayMs * 2, maxReconnectDelayMs);
			};

			ws.onmessage = (event) => {
				try {
					const msg = JSON.parse(event.data);
					if (msg.type === "ping") ws.send(JSON.stringify({ type: "pong" }));
				} catch {
					return;
				}
			};
		}

		connect();

		return () => {
			isCleaned = true;
			if (timeoutId !== null) clearTimeout(timeoutId);
			wsRef.current?.close();
		};
	}, [config.url, config.projectSlug]);

	return (
		<BetterBaseContext.Provider
			value={{ config, ws: wsRef.current, wsReady, getToken: config.getToken }}
		>
			{children}
		</BetterBaseContext.Provider>
	);
}

export function useBetterBaseContext(): BetterBaseContextValue {
	const ctx = useContext(BetterBaseContext);
	if (!ctx) throw new Error("useBetterBaseContext must be used inside <BetterbaseProvider>");
	return ctx;
}
