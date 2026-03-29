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
		const wsUrl = `${config.url.replace(/^http/, "ws")}/betterbase/ws?project=${config.projectSlug ?? "default"}`;
		const ws = new WebSocket(wsUrl);

		ws.onopen = () => {
			setWsReady(true);
		};
		ws.onclose = () => {
			setWsReady(false);
			// Reconnect after 3 seconds
			setTimeout(() => {
				wsRef.current = new WebSocket(wsUrl);
			}, 3_000);
		};

		wsRef.current = ws;

		// Handle pings
		ws.onmessage = (event) => {
			const msg = JSON.parse(event.data);
			if (msg.type === "ping") ws.send(JSON.stringify({ type: "pong" }));
		};

		return () => {
			ws.close();
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
