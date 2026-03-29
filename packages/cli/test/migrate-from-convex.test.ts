import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "bun:test";

import { runMigrateFromConvex } from "../src/commands/migrate/from-convex";

const tempDirs: string[] = [];

function createTempProject(prefix: string): string {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	tempDirs.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("runMigrateFromConvex compatibility report", () => {
	it("creates report files even when query/mutation/action directories are missing", async () => {
		const inputPath = createTempProject("bb-convex-input-");
		const outputPath = createTempProject("bb-convex-output-");

		writeFileSync(
			join(inputPath, "schema.ts"),
			`import { defineSchema, defineTable } from 'convex/server';\nexport default defineSchema({});`,
		);

		await runMigrateFromConvex({ inputPath, outputPath });

		const reportPath = join(outputPath, "betterbase", "convex-migration-report.json");
		const report = JSON.parse(readFileSync(reportPath, "utf-8")) as {
			schemaConverted: boolean;
			counts: { queries: number; mutations: number; actions: number };
			issues: Array<{ severity: string }>;
			files: Array<{ status: string }>;
		};

		expect(report.schemaConverted).toBe(true);
		expect(report.counts.queries).toBe(0);
		expect(report.counts.mutations).toBe(0);
		expect(report.counts.actions).toBe(0);
		expect(report.issues).toHaveLength(0);
		expect(report.files).toHaveLength(0);
	});

	it("detects compatibility blockers and warnings in converted functions", async () => {
		const inputPath = createTempProject("bb-convex-input-");
		const outputPath = createTempProject("bb-convex-output-");
		const actionsDir = join(inputPath, "actions");
		mkdirSync(actionsDir, { recursive: true });

		writeFileSync(
			join(actionsDir, "jobs.ts"),
			`
export const schedule = action({
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(1000, api.jobs.doWork, {});
  }
});

export const http = httpAction(async () => {
  return new Response("ok");
});
`,
		);

		await runMigrateFromConvex({ inputPath, outputPath });

		const reportPath = join(outputPath, "betterbase", "convex-migration-report.json");
		const report = JSON.parse(readFileSync(reportPath, "utf-8")) as {
			issues: Array<{ severity: "warning" | "blocker"; pattern: string }>;
			files: Array<{ file: string; status: "converted" | "manual-review"; blockers: number }>;
		};

		expect(report.issues.some((issue) => issue.pattern === "httpAction()")).toBe(true);
		expect(report.issues.some((issue) => issue.pattern === "ctx.scheduler.*")).toBe(true);
		expect(report.issues.some((issue) => issue.severity === "blocker")).toBe(true);
		expect(report.issues.some((issue) => issue.severity === "warning")).toBe(true);
		expect(report.files).toHaveLength(1);
		expect(report.files[0]?.file).toBe("actions/jobs.ts");
		expect(report.files[0]?.status).toBe("manual-review");
		expect((report.files[0]?.blockers ?? 0) > 0).toBe(true);
	});
});
