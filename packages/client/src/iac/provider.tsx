import React, { createContext, useContext, useEffect, useRef, type ReactNode } from "react";

export interface BBFConfig {
	/** Base URL of the BetterBase server */
	url: string;
	/** Project slug — routes db queries to the right schema */
	projectSlug?: string;
	/** Token getter — called on each request */
	getToken?: () => string | null;
}

interface BBFContextValue {
	config: BBFConfig;
	ws: WebSocket | null;
	wsReady: boolean;
	getToken: (() => string | null) | undefined;
}

const BBFContext = createContext<BBFContextValue | null>(null);

export function BetterbaseProvider({
	config,
	children,
}: { config: BBFConfig; children: ReactNode }) {
	const wsRef = useRef<WebSocket | null>(null);
	const [wsReady, setWsReady] = React.useState(false);

	useEffect(() => {
		const wsUrl = `${config.url.replace(/^http/, "ws")}/bbf/ws?project=${config.projectSlug ?? "default"}`;
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
		<BBFContext.Provider value={{ config, ws: wsRef.current, wsReady, getToken: config.getToken }}>
			{children}
		</BBFContext.Provider>
	);
}

export function useBBFContext(): BBFContextValue {
	const ctx = useContext(BBFContext);
	if (!ctx) throw new Error("useBBFContext must be used inside <BetterbaseProvider>");
	return ctx;
}
