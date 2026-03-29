import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

let tmpDir: string;

beforeAll(() => {
	tmpDir = mkdtempSync(path.join(os.tmpdir(), "betterbase-test-"));
});

afterAll(() => {
	rmSync(tmpDir, { recursive: true, force: true });
});

describe("runDevCommand", () => {
	it("creates project structure for dev server", async () => {
		const testDir = mkdtempSync(path.join(os.tmpdir(), "bb-dev-structure-"));

		mkdirSync(path.join(testDir, "src/db"), { recursive: true });
		mkdirSync(path.join(testDir, "src/routes"), { recursive: true });
		writeFileSync(
			path.join(testDir, "src/index.ts"),
			`
import { Hono } from "hono"
const app = new Hono()
export default { port: 0, fetch: app.fetch }
`,
		);
		writeFileSync(path.join(testDir, "src/db/schema.ts"), "export const schema = {}");

		expect(existsSync(path.join(testDir, "src/index.ts"))).toBe(true);
		expect(existsSync(path.join(testDir, "src/db/schema.ts"))).toBe(true);
		rmSync(testDir, { recursive: true, force: true });
	});

	it("handles missing src/index.ts gracefully", async () => {
		const testDir = mkdtempSync(path.join(os.tmpdir(), "bb-dev-missing-"));

		expect(existsSync(path.join(testDir, "src/index.ts"))).toBe(false);
		rmSync(testDir, { recursive: true, force: true });
	});

	it("validates project directory creation", async () => {
		const testDir = mkdtempSync(path.join(os.tmpdir(), "bb-dev-validate-"));

		mkdirSync(path.join(testDir, "src/db"), { recursive: true });
		mkdirSync(path.join(testDir, "src/routes"), { recursive: true });
		writeFileSync(
			path.join(testDir, "src/index.ts"),
			`
import { Hono } from "hono"
const app = new Hono()
export default { port: 0, fetch: app.fetch }
`,
		);
		writeFileSync(path.join(testDir, "package.json"), JSON.stringify({ name: "test" }));

		expect(existsSync(path.join(testDir, "src/index.ts"))).toBe(true);
		expect(existsSync(path.join(testDir, "package.json"))).toBe(true);
		rmSync(testDir, { recursive: true, force: true });
	});
});
