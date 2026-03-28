import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import * as logger from "../../utils/logger";

export interface MigrateFromConvexOptions {
	inputPath: string;
	outputPath: string;
}

/**
 * Migrate a Convex project to BetterBase
 *
 * This tool converts:
 * - Convex schema (schema.ts) -> BetterBase schema (betterbase/schema.ts)
 * - Convex validators (v.*) -> BetterBase validators (v.*)
 * - Convex functions (queries/mutations/actions) -> BetterBase functions
 */
export async function runMigrateFromConvex(options: MigrateFromConvexOptions): Promise<void> {
	const { inputPath, outputPath } = options;

	if (!statSync(inputPath).isDirectory()) {
		logger.error(`Input path is not a directory: ${inputPath}`);
		return;
	}

	logger.info(`Migrating Convex project from ${inputPath}...`);
	logger.info(`Output will be in ${outputPath}`);

	// Create output directory
	mkdirSync(outputPath, { recursive: true });
	mkdirSync(join(outputPath, "betterbase", "queries"), { recursive: true });
	mkdirSync(join(outputPath, "betterbase", "mutations"), { recursive: true });
	mkdirSync(join(outputPath, "betterbase", "actions"), { recursive: true });

	// Find and convert schema
	const schemaFile = findFile(inputPath, "schema.ts");
	if (schemaFile) {
		const converted = convertSchema(readFileSync(schemaFile, "utf-8"));
		writeFileSync(join(outputPath, "betterbase", "schema.ts"), converted);
		logger.success("Converted schema.ts");
	}

	// Find and convert queries
	const queriesDir = join(inputPath, "queries");
	if (statSync(queriesDir).isDirectory()) {
		convertFunctionsDir(queriesDir, join(outputPath, "betterbase", "queries"), "query");
	}

	// Find and convert mutations
	const mutationsDir = join(inputPath, "mutations");
	if (statSync(mutationsDir).isDirectory()) {
		convertFunctionsDir(mutationsDir, join(outputPath, "betterbase", "mutations"), "mutation");
	}

	// Find and convert actions
	const actionsDir = join(inputPath, "actions");
	if (statSync(actionsDir).isDirectory()) {
		convertFunctionsDir(actionsDir, join(outputPath, "betterbase", "actions"), "action");
	}

	console.log(`
✅ Convex Migration Complete!

Converted files are in: ${outputPath}

Key changes made:
- Convex v.* validators -> BetterBase v.*
- Convex query/mutation/action -> BetterBase query/mutation/action  
- ctx.db.query() syntax preserved
- ctx.runQuery/ctx.runMutation -> ctx.runQuery/ctx.runMutation

Manual steps required:
1. Review the generated schema and adjust types if needed
2. Install dependencies: bun add @betterbase/core @betterbase/client
3. Run bb iac sync to create database tables
4. Test your functions

See docs/iac/migration-from-convex.md for detailed guide.
  `);
}

function findFile(dir: string, filename: string): string | null {
	for (const entry of readdirSync(dir)) {
		const fullPath = join(dir, entry);
		if (statSync(fullPath).isFile() && entry === filename) {
			return fullPath;
		}
	}
	return null;
}

function convertSchema(convexSchema: string): string {
	// Convert Convex schema to BetterBase schema
	let converted = convexSchema;

	// Replace import statements
	converted = converted.replace(/from 'convex\/server'/g, 'from "@betterbase/core/iac"');
	converted = converted.replace(
		/import { defineSchema, defineTable } from 'convex\/server'/g,
		'import { defineSchema, defineTable } from "@betterbase/core/iac"',
	);

	// Replace v.* validators
	converted = converted.replace(/v\.number\(\)/g, "v.number()");
	converted = converted.replace(/v\.string\(\)/g, "v.string()");
	converted = converted.replace(/v\.boolean\(\)/g, "v.boolean()");
	converted = converted.replace(/v\.id\((".*?")\)/g, "v.id($1)");
	converted = converted.replace(/v\.optional\((.*?)\)/g, "v.optional($1)");
	converted = converted.replace(/v\.array\((.*?)\)/g, "v.array($1)");

	// Add default export if missing
	if (!converted.includes("export default")) {
		converted = converted.replace(/defineSchema\({/g, "export default defineSchema({");
	}

	return `import { defineSchema, defineTable, v } from "@betterbase/core/iac";\n\n${converted}`;
}

function convertFunctionsDir(inputDir: string, outputDir: string, kind: string): void {
	const files = readdirSync(inputDir);

	for (const file of files) {
		const inputPath = join(inputDir, file);
		if (!statSync(inputPath).isFile() || !file.endsWith(".ts")) continue;

		const content = readFileSync(inputPath, "utf-8");
		const converted = convertFunction(content, kind);
		const outputName = file.replace(".ts", ".ts");
		writeFileSync(join(outputDir, outputName), converted);
	}

	logger.success(`Converted ${files.filter((f) => f.endsWith(".ts")).length} ${kind}s`);
}

function convertFunction(convexCode: string, kind: string): string {
	let converted = convexCode;

	// Replace imports
	converted = converted.replace(
		/import.*from '\.\/\_generated\/server'/g,
		`import { ${kind} } from "@betterbase/core/iac";`,
	);
	converted = converted.replace(
		/import.*from 'convex\/values'/g,
		'import { v } from "@betterbase/core/iac";',
	);

	// Replace function definitions
	if (kind === "query") {
		converted = converted.replace(/export const (\w+) = query\({/g, "export const $1 = query({");
	} else if (kind === "mutation") {
		converted = converted.replace(
			/export const (\w+) = mutation\({/g,
			"export const $1 = mutation({",
		);
	} else if (kind === "action") {
		converted = converted.replace(/export const (\w+) = action\({/g, "export const $1 = action({");
	}

	// Replace ctx.runQuery/ctx.runMutation
	converted = converted.replace(/ctx\.runQuery\(api\./g, "ctx.runQuery(api.");
	converted = converted.replace(/ctx\.runMutation\(api\./g, "ctx.runMutation(api.");

	// Replace ctx.db.get with proper syntax
	converted = converted.replace(/await ctx\.db\.get\(["'](.*?)["']\)/g, 'await ctx.db.get("$1")');

	return `import { ${kind}, v } from "@betterbase/core/iac";\n\n${converted}`;
}
