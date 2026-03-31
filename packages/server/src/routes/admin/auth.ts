import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Context, MiddlewareHandler } from "hono";
import { z } from "zod";
import {
	extractBearerToken,
	signAdminToken,
	verifyAdminToken,
	verifyPassword,
} from "../../lib/auth";
import { getPool } from "../../lib/db";

// ─── Simple in-memory rate limiter ─────────────────────────────────────────
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_ATTEMPTS = 5;

function loginRateLimiter(c: Context): Response | null {
	const ip = c.req.header("X-Real-IP") || "unknown";
	const now = Date.now();
	const entry = loginAttempts.get(ip);

	if (entry && entry.resetAt > now) {
		if (entry.count >= RATE_LIMIT_MAX_ATTEMPTS) {
			return c.json({ error: "Too many login attempts. Please try again in 15 minutes." }, 429);
		}
		entry.count++;
	} else {
		loginAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
	}
	return null;
}

// ─── Auth Routes ───────────────────────────────────────────────────────────
export const authRoutes = new Hono();

// POST /admin/auth/login
authRoutes.post(
	"/login",
	zValidator(
		"json",
		z.object({
			email: z.string().email(),
			password: z.string().min(1),
		}),
	),
	async (c) => {
		// Rate limit check
		const rateLimitResponse = loginRateLimiter(c);
		if (rateLimitResponse) return rateLimitResponse;

		const { email, password } = c.req.valid("json");
		const pool = getPool();

		const { rows } = await pool.query(
			"SELECT id, email, password_hash FROM betterbase_meta.admin_users WHERE email = $1",
			[email],
		);
		if (rows.length === 0) {
			return c.json({ error: "Invalid credentials" }, 401);
		}

		const admin = rows[0];
		const valid = await verifyPassword(password, admin.password_hash);
		if (!valid) {
			return c.json({ error: "Invalid credentials" }, 401);
		}

		const token = await signAdminToken(admin.id);
		return c.json({ token, admin: { id: admin.id, email: admin.email } });
	},
);

// GET /admin/auth/me  (requires token)
authRoutes.get("/me", async (c) => {
	const token = extractBearerToken(c.req.header("Authorization"));
	if (!token) return c.json({ error: "Unauthorized" }, 401);

	const payload = await verifyAdminToken(token);
	if (!payload) return c.json({ error: "Unauthorized" }, 401);

	const pool = getPool();
	const { rows } = await pool.query(
		"SELECT id, email, created_at FROM betterbase_meta.admin_users WHERE id = $1",
		[payload.sub],
	);
	if (rows.length === 0) return c.json({ error: "Unauthorized" }, 401);

	return c.json({ admin: rows[0] });
});

// POST /admin/auth/logout  (client-side token discard — stateless)
authRoutes.post("/logout", (c) => c.json({ success: true }));

// POST /admin/auth/setup  — available only before first admin is created
authRoutes.post(
	"/setup",
	zValidator(
		"json",
		z.object({
			email: z.string().email(),
			password: z.string().min(8),
		}),
	),
	async (c) => {
		const pool = getPool();

		// Check if any admin exists
		const { rows } = await pool.query(
			"SELECT COUNT(*)::int as count FROM betterbase_meta.admin_users",
		);
		if (rows[0].count > 0) {
			return c.json({ error: "Setup already complete" }, 410);
		}

		const { email, password } = c.req.valid("json");
		const { hashPassword, signAdminToken: signToken } = await import("../../lib/auth");
		const { nanoid } = await import("nanoid");

		const passwordHash = await hashPassword(password);
		const { rows: newAdmin } = await pool.query(
			"INSERT INTO betterbase_meta.admin_users (id, email, password_hash) VALUES ($1, $2, $3) RETURNING id, email",
			[nanoid(), email, passwordHash],
		);

		const token = await signToken(newAdmin[0].id);
		return c.json(
			{
				message: "Admin account created. Save your token — log in with `bb login`.",
				admin: newAdmin[0],
				token,
			},
			201,
		);
	},
);
