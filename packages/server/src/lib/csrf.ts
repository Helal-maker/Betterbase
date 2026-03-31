import type { Context, MiddlewareHandler } from "hono";

const CSRF_COOKIE_NAME = "csrf-token";
const CSRF_HEADER_NAME = "x-csrf-token";

/** Extract a cookie value from the Cookie header */
function getCookie(req: Request, name: string): string | null {
	const cookieHeader = req.headers.get("cookie");
	if (!cookieHeader) return null;
	const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
	return match ? decodeURIComponent(match[1]) : null;
}

const CSRF_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

const csrfMiddleware: MiddlewareHandler = async (c: Context, next) => {
	const path = new URL(c.req.url).pathname;
	const method = c.req.method;

	const isSafeMethod = method === "GET" || method === "HEAD" || method === "OPTIONS";
	const isHealthCheck = path === "/health";
	const isInngest = path === "/api/inngest";
	const isWebSocket = path === "/betterbase/ws" && c.req.header("Upgrade") === "websocket";
	const isSetupCheck = path === "/admin/auth/setup/check";

	if (isSafeMethod || isHealthCheck || isInngest || isWebSocket || isSetupCheck) {
		if (!isSafeMethod) {
			await next();
			return;
		}

		let token = getCookie(c.req.raw, CSRF_COOKIE_NAME);
		const tokenExpiry = c.req.header("X-CSRF-Token-Expiry");

		if (!token || !tokenExpiry || Number(tokenExpiry) < Date.now()) {
			token = crypto.randomUUID();
			const expiry = Date.now() + CSRF_TOKEN_EXPIRY_MS;
			c.header(
				"Set-Cookie",
				`${CSRF_COOKIE_NAME}=${token}; SameSite=Strict; Path=/; Max-Age=86400`,
			);
			c.header("X-CSRF-Token-Expiry", expiry.toString());
		}

		await next();
		return;
	}

	const cookieToken = getCookie(c.req.raw, CSRF_COOKIE_NAME);
	const headerToken = c.req.header(CSRF_HEADER_NAME);

	if (!cookieToken || !headerToken) {
		return new Response("CSRF token missing", { status: 403 });
	}

	if (cookieToken !== headerToken) {
		return new Response("CSRF token mismatch", { status: 403 });
	}

	await next();
};

export { csrfMiddleware };
