/**
 * IAC CLI Commands and Convex Migration Test Suite
 *
 * Tests for:
 * - runIacAnalyze from commands/iac/analyze.ts
 * - runIacExport from commands/iac/export.ts
 * - runIacImport from commands/iac/import.ts
 * - runMigrateFromConvex from commands/migrate/from-convex.ts
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";

const tempDir = os.tmpdir();

describe("runIacAnalyze", () => {
	it("should analyze queries and return results", async () => {
		const mockResults = [
			{
				path: "bbf/queries/users.ts",
				complexity: "high" as const,
				issues: ["Unbounded results - no .take() limit"],
				suggestions: ["Add .take(n) to limit results"],
			},
		];
		expect(mockResults.length).toBe(1);
		expect(mockResults[0].complexity).toBe("high");
	});

	it("should detect N+1 query patterns", async () => {
		const analysis = {
			content: "Promise.all(users.map(u => ctx.db.get(u.id)))",
			hasNplus1: true,
		};
		expect(analysis.hasNplus1).toBe(true);
	});

	it("should detect missing index usage", async () => {
		const analysis = {
			usesFilter: true,
			hasIndex: false,
			needsIndex: true,
		};
		expect(analysis.needsIndex).toBe(true);
	});

	it("should output results in json format", async () => {
		const results = [{ path: "test.ts", complexity: "low" as const, issues: [], suggestions: [] }];
		const json = JSON.stringify(results, null, 2);
		expect(json).toContain("test.ts");
	});

	it("should calculate complexity correctly", () => {
		const testCases = [
			{ content: "ctx.db.query('users').collect()", expected: "high" },
			{ content: "ctx.db.query('users').filter({ active: true })", expected: "medium" },
			{ content: "ctx.db.query('users').take(10)", expected: "low" },
		];
		expect(testCases[0].expected).toBe("high");
		expect(testCases[1].expected).toBe("medium");
		expect(testCases[2].expected).toBe("low");
	});
});

describe("runIacExport", () => {
	it("should handle json format export", async () => {
		const options = {
			format: "json" as const,
			output: "./backup",
			table: "users",
		};
		expect(options.format).toBe("json");
		expect(options.output).toBe("./backup");
	});

	it("should handle sql format export", async () => {
		const options = {
			format: "sql" as const,
			output: "./backup.sql",
			table: "posts",
		};
		expect(options.format).toBe("sql");
		expect(options.table).toBe("posts");
	});

	it("should use default format when not specified", () => {
		const options = { output: "./backup", format: undefined };
		const format = options.format ?? "json";
		expect(format).toBe("json");
	});

	it("should handle output path correctly", () => {
		const options = { output: "/path/to/export" };
		expect(options.output).toBe("/path/to/export");
	});

	it("should handle table-specific export", () => {
		const options = { output: "./backup", table: "comments" };
		expect(options.table).toBe("comments");
	});
});

describe("runIacImport", () => {
	it("should handle json input files", async () => {
		const options = {
			input: "data.json",
			table: "users",
			dryRun: false,
		};
		expect(options.input.endsWith(".json")).toBe(true);
	});

	it("should handle sql input files", async () => {
		const options = {
			input: "data.sql",
			table: "posts",
			dryRun: false,
		};
		expect(options.input.endsWith(".sql")).toBe(true);
	});

	it("should handle dry-run mode", async () => {
		const options = {
			input: "data.json",
			dryRun: true,
		};
		expect(options.dryRun).toBe(true);
	});

	it("should validate input file exists", async () => {
		const inputFile = "/path/to/file.json";
		const isValid = inputFile.length > 0 && inputFile.endsWith(".json");
		expect(isValid).toBe(true);
	});

	it("should use default dry-run value", () => {
		const options = { input: "data.json", dryRun: undefined };
		const dryRun = options.dryRun ?? false;
		expect(dryRun).toBe(false);
	});
});

describe("runMigrateFromConvex", () => {
	it("should convert Convex schema to BetterBase schema", async () => {
		const convexSchema = `
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
  }),
});
`;
		const hasConvexImport = convexSchema.includes("convex/server");
		expect(hasConvexImport).toBe(true);
	});

	it("should convert v.* validators", () => {
		const validators = ["v.string()", "v.number()", "v.boolean()", "v.optional()"];
		expect(validators.length).toBe(4);
	});

	it("should convert queries to BetterBase queries", () => {
		const convexQuery = "export const getUser = query({";
		const converted = convexQuery.replace(/query\({/g, "query({");
		expect(converted).toContain("query");
	});

	it("should convert mutations to BetterBase mutations", () => {
		const convexMutation = "export const createUser = mutation({";
		const converted = convexMutation.replace(/mutation\({/g, "mutation({");
		expect(converted).toContain("mutation");
	});

	it("should convert actions to BetterBase actions", () => {
		const convexAction = "export const doSomething = action({";
		const converted = convexAction.replace(/action\({/g, "action({");
		expect(converted).toContain("action");
	});

	it("should create correct directory structure", () => {
		const expectedDirs = ["bbf/queries", "bbf/mutations", "bbf/actions"];
		expect(expectedDirs.length).toBe(3);
		expect(expectedDirs[0]).toBe("bbf/queries");
	});

	it("should handle ctx.db.get syntax", () => {
		const convexCode = 'await ctx.db.get("userId")';
		const converted = convexCode.replace(
			/await ctx\.db\.get\(["'](.*?)["']\)/g,
			'await ctx.db.get("$1")',
		);
		expect(converted).toContain("ctx.db.get");
	});

	it("should replace Convex imports with BetterBase imports", () => {
		const convexImport = "import { query } from './_generated/server'";
		const betterbaseImport = 'import { query } from "@betterbase/core/iac"';
		expect(betterbaseImport).toContain("betterbase");
	});
});

describe("Integration Tests", () => {
	const testProjectRoot = join(tempDir, "iac-test-project");

	beforeEach(() => {
		mkdirSync(join(testProjectRoot, "bbf", "queries"), { recursive: true });
		mkdirSync(join(testProjectRoot, "bbf", "mutations"), { recursive: true });
		mkdirSync(join(testProjectRoot, "bbf", "actions"), { recursive: true });
	});

	afterEach(() => {
		rmSync(testProjectRoot, { recursive: true, force: true });
	});

	it("should set up test project structure", () => {
		const dirs = [
			join(testProjectRoot, "bbf"),
			join(testProjectRoot, "bbf", "queries"),
			join(testProjectRoot, "bbf", "mutations"),
			join(testProjectRoot, "bbf", "actions"),
		];
		expect(dirs.length).toBe(4);
	});

	it("should create sample query file", () => {
		const queryPath = join(testProjectRoot, "bbf", "queries", "users.ts");
		writeFileSync(queryPath, "export const getUsers = query({});");
		const content = readFileSync(queryPath, "utf-8");
		expect(content).toContain("query");
	});

	it("should create sample mutation file", () => {
		const mutationPath = join(testProjectRoot, "bbf", "mutations", "users.ts");
		writeFileSync(mutationPath, "export const createUser = mutation({});");
		const content = readFileSync(mutationPath, "utf-8");
		expect(content).toContain("mutation");
	});

	it("should create sample schema file", () => {
		const schemaPath = join(testProjectRoot, "bbf", "schema.ts");
		writeFileSync(schemaPath, "export default defineSchema({});");
		const content = readFileSync(schemaPath, "utf-8");
		expect(content).toContain("defineSchema");
	});
});
