import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import { projectIaCRoutes } from "../src/routes/admin/project-scoped/iac";

const mockPool = {
	query: mock(() => Promise.resolve({ rows: [], fields: [] })),
};

mock.module("../src/lib/db", () => ({
	getPool: () => mockPool,
}));

describe("IaC Routes", () => {
	let app: Hono;

	beforeEach(() => {
		mockPool.query.mockClear();
		app = new Hono();
		app.use("/:projectId/*", async (c, next) => {
			c.set("project", { id: "proj-123", slug: "test-project" });
			await next();
		});
		app.route("/:projectId/iac", projectIaCRoutes);
	});

	describe("GET /:projectId/iac/schema", () => {
		it("should return schema with tables and columns", async () => {
			mockPool.query
				.mockResolvedValueOnce({
					rows: [{ table_name: "users" }, { table_name: "posts" }],
				})
				.mockResolvedValueOnce({
					rows: [
						{ column_name: "id", data_type: "uuid", is_nullable: "NO", column_default: null },
						{ column_name: "name", data_type: "text", is_nullable: "YES", column_default: null },
					],
				})
				.mockResolvedValueOnce({
					rows: [{ indexname: "users_pkey", indexdef: "CREATE PRIMARY KEY" }],
				});

			const res = await app.request("/proj-123/iac/schema");
			const body = await res.json();

			expect(res.status).toBe(200);
			expect(body.schema).toBeDefined();
		});

		it("should handle empty schema", async () => {
			mockPool.query.mockResolvedValueOnce({ rows: [] });

			const res = await app.request("/proj-123/iac/schema");
			const body = await res.json();

			expect(res.status).toBe(200);
			expect(body.schema).toEqual({});
		});
	});

	describe("GET /:projectId/iac/functions", () => {
		it("should return IaC functions", async () => {
			mockPool.query.mockResolvedValueOnce({
				rows: [
					{
						name: "getUser",
						kind: "query",
						path: "queries/users/getUser",
						module: "/app/bbf/queries/users.ts",
					},
					{
						name: "createPost",
						kind: "mutation",
						path: "mutations/posts/createPost",
						module: "/app/bbf/mutations/posts.ts",
					},
				],
			});

			const res = await app.request("/proj-123/iac/functions");
			const body = await res.json();

			expect(res.status).toBe(200);
			expect(body.functions).toHaveLength(2);
			expect(body.functions[0].kind).toBe("query");
			expect(body.functions[1].kind).toBe("mutation");
		});

		it("should handle empty functions", async () => {
			mockPool.query.mockResolvedValueOnce({ rows: [] });

			const res = await app.request("/proj-123/iac/functions");
			const body = await res.json();

			expect(res.status).toBe(200);
			expect(body.functions).toEqual([]);
		});
	});

	describe("GET /:projectId/iac/jobs", () => {
		it("should return scheduled jobs", async () => {
			mockPool.query.mockResolvedValueOnce({
				rows: [
					{
						id: "job-1",
						name: "cleanup",
						schedule: "* * * * *",
						function_path: "mutations/cleanup",
						status: "active",
						next_run: "2024-01-01",
						last_run: null,
					},
				],
			});

			const res = await app.request("/proj-123/iac/jobs");
			const body = await res.json();

			expect(res.status).toBe(200);
			expect(body.jobs).toHaveLength(1);
			expect(body.jobs[0].name).toBe("cleanup");
		});
	});

	describe("GET /:projectId/iac/realtime", () => {
		it("should return realtime stats", async () => {
			mockPool.query
				.mockResolvedValueOnce({ rows: [{ active_connections: "5" }] })
				.mockResolvedValueOnce({
					rows: [
						{ event_type: "INSERT", table_name: "users", count: "10", last_event: "2024-01-01" },
					],
				});

			const res = await app.request("/proj-123/iac/realtime");
			const body = await res.json();

			expect(res.status).toBe(200);
			expect(body.active_connections).toBe(5);
			expect(body.recent_events).toHaveLength(1);
		});
	});

	describe("POST /:projectId/iac/query", () => {
		it("should execute SELECT query", async () => {
			mockPool.query.mockResolvedValueOnce({
				rows: [{ id: "1", name: "Test" }],
				fields: [{ name: "id" }, { name: "name" }],
			});

			const res = await app.request("/proj-123/iac/query", {
				method: "POST",
				body: JSON.stringify({ sql: "SELECT * FROM users" }),
			});
			const body = await res.json();

			expect(res.status).toBe(200);
			expect(body.rows).toHaveLength(1);
			expect(body.columns).toEqual(["id", "name"]);
		});

		it("should reject non-SELECT queries", async () => {
			const res = await app.request("/proj-123/iac/query", {
				method: "POST",
				body: JSON.stringify({ sql: "INSERT INTO users VALUES (1)" }),
			});

			expect(res.status).toBe(403);
			expect((await res.json()).error).toContain("SELECT");
		});

		it("should reject empty SQL", async () => {
			const res = await app.request("/proj-123/iac/query", {
				method: "POST",
				body: JSON.stringify({ sql: "" }),
			});

			expect(res.status).toBe(400);
		});

		it("should handle query errors", async () => {
			mockPool.query.mockRejectedValueOnce(new Error('syntax error at or near "FROM"'));

			const res = await app.request("/proj-123/iac/query", {
				method: "POST",
				body: JSON.stringify({ sql: "SELECT * FORM users" }),
			});
			const body = await res.json();

			expect(res.status).toBe(400);
			expect(body.error).toBeDefined();
		});
	});
});
