import { Hono } from "hono";
import { getPool } from "../../../lib/db";

export const projectIaCRoutes = new Hono();

function schemaName(project: { slug: string }) {
	return `project_${project.slug}`;
}

// GET /admin/projects/:id/iac/schema
// Returns the IaC schema (tables, columns, indexes)
projectIaCRoutes.get("/schema", async (c) => {
	const pool = getPool();
	const project = c.get("project") as { id: string; slug: string };
	const s = schemaName(project);

	// Get all tables in the project schema
	const { rows: tables } = await pool.query(
		`SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = $1 AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
		[s],
	);

	// For each table, get columns and indexes
	const schema: Record<string, { columns: any[]; indexes: any[] }> = {};

	for (const table of tables) {
		const tableName = table.table_name;

		// Get columns
		const { rows: columns } = await pool.query(
			`SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = $2
          ORDER BY ordinal_position`,
			[s, tableName],
		);

		// Get indexes
		const { rows: indexes } = await pool.query(
			`SELECT indexname, indexdef
          FROM pg_indexes
          WHERE schemaname = $1 AND tablename = $2`,
			[s, tableName],
		);

		schema[tableName] = { columns, indexes };
	}

	return c.json({ schema });
});

// GET /admin/projects/:id/iac/functions
// Returns all IaC functions (queries, mutations, actions)
projectIaCRoutes.get("/functions", async (c) => {
	const pool = getPool();
	const project = c.get("project") as { id: string; slug: string };

	// Get registered functions from the functions table
	const { rows } = await pool.query(
		`SELECT name, kind, path, module, created_at, updated_at
       FROM betterbase_meta.iac_functions
       WHERE project_id = $1
       ORDER BY kind, path`,
		[project.id],
	);

	return c.json({ functions: rows });
});

// GET /admin/projects/:id/iac/jobs
// Returns scheduled cron jobs
projectIaCRoutes.get("/jobs", async (c) => {
	const pool = getPool();
	const project = c.get("project") as { id: string; slug: string };

	const { rows } = await pool.query(
		`SELECT id, name, schedule, function_path, status, next_run, last_run
       FROM betterbase_meta.iac_scheduled_jobs
       WHERE project_id = $1
       ORDER BY name`,
		[project.id],
	);

	return c.json({ jobs: rows });
});

// GET /admin/projects/:id/iac/realtime
// Returns realtime connection stats
projectIaCRoutes.get("/realtime", async (c) => {
	const pool = getPool();
	const project = c.get("project") as { id: string; slug: string };

	// Get active connections count
	const { rows: connections } = await pool.query(
		`SELECT count(*) as active_connections
       FROM betterbase_meta.iac_realtime_connections
       WHERE project_id = $1 AND connected = true`,
		[project.id],
	);

	// Get recent events
	const { rows: events } = await pool.query(
		`SELECT event_type, table_name, count(*) as count, max(created_at) as last_event
       FROM betterbase_meta.iac_realtime_events
       WHERE project_id = $1 AND created_at > NOW() - INTERVAL '1 hour'
       GROUP BY event_type, table_name`,
		[project.id],
	);

	return c.json({
		active_connections: Number.parseInt(connections[0]?.active_connections ?? "0"),
		recent_events: events,
	});
});

// POST /admin/projects/:id/iac/query
// Execute raw SQL query
projectIaCRoutes.post("/query", async (c) => {
	const pool = getPool();
	const project = c.get("project") as { id: string; slug: string };
	const s = schemaName(project);

	const { sql, params } = await c.req.json<{ sql: string; params?: unknown[] }>();

	if (!sql?.trim()) {
		return c.json({ error: "SQL query required" }, 400);
	}

	// Security: only SELECT queries allowed
	const upperSql = sql.trim().toUpperCase();
	if (!upperSql.startsWith("SELECT")) {
		return c.json({ error: "Only SELECT queries allowed" }, 403);
	}

	try {
		const { rows, fields } = await pool.query(sql, params ?? []);

		return c.json({
			columns: fields.map((f) => f.name),
			rows,
			row_count: rows.length,
		});
	} catch (err: any) {
		return c.json({ error: err.message }, 400);
	}
});
