import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

export interface MigrateFromConvexOptions {
	inputPath: string;
	outputPath: string;
}

const logger = {
	info: (message: string) => console.log(message),
	success: (message: string) => console.log(`✅ ${message}`),
	error: (message: string) => console.error(message),
};

interface MigrationIssue {
	file: string;
	severity: "warning" | "blocker";
	pattern: string;
	message: string;
	suggestion: string;
}

interface ConversionStats {
	converted: number;
	issues: MigrationIssue[];
	files: ConvertedFileReport[];
}

interface ConvertedFileReport {
	file: string;
	kind: "query" | "mutation" | "action";
	status: "converted" | "manual-review";
	blockers: number;
	warnings: number;
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

	if (!existsSync(inputPath) || !statSync(inputPath).isDirectory()) {
		throw new Error(`Input path is not a directory: ${inputPath}`);
	}

	logger.info(`Migrating Convex project from ${inputPath}...`);
	logger.info(`Output will be in ${outputPath}`);

	// Create output directory
	mkdirSync(outputPath, { recursive: true });
	mkdirSync(join(outputPath, "betterbase", "queries"), { recursive: true });
	mkdirSync(join(outputPath, "betterbase", "mutations"), { recursive: true });
	mkdirSync(join(outputPath, "betterbase", "actions"), { recursive: true });

	let schemaConverted = false;

	// Find and convert schema
	const schemaFile = findFile(inputPath, "schema.ts");
	if (schemaFile) {
		const converted = convertSchema(readFileSync(schemaFile, "utf-8"));
		writeFileSync(join(outputPath, "betterbase", "schema.ts"), converted);
		logger.success("Converted schema.ts");
		schemaConverted = true;
	}

	const issues: MigrationIssue[] = [];
	const files: ConvertedFileReport[] = [];

	// Find and convert queries
	const queriesDir = join(inputPath, "queries");
	const queryStats = isDirectorySafe(queriesDir)
		? convertFunctionsDir(queriesDir, join(outputPath, "betterbase", "queries"), "query")
		: { converted: 0, issues: [], files: [] };
	issues.push(...queryStats.issues);
	files.push(...queryStats.files);

	// Find and convert mutations
	const mutationsDir = join(inputPath, "mutations");
	const mutationStats = isDirectorySafe(mutationsDir)
		? convertFunctionsDir(mutationsDir, join(outputPath, "betterbase", "mutations"), "mutation")
		: { converted: 0, issues: [], files: [] };
	issues.push(...mutationStats.issues);
	files.push(...mutationStats.files);

	// Find and convert actions
	const actionsDir = join(inputPath, "actions");
	const actionStats = isDirectorySafe(actionsDir)
		? convertFunctionsDir(actionsDir, join(outputPath, "betterbase", "actions"), "action")
		: { converted: 0, issues: [], files: [] };
	issues.push(...actionStats.issues);
	files.push(...actionStats.files);

	const migrationReport = {
		schemaConverted,
		counts: {
			queries: queryStats.converted,
			mutations: mutationStats.converted,
			actions: actionStats.converted,
		},
		issues,
		files,
	};

	const reportJsonPath = join(outputPath, "betterbase", "convex-migration-report.json");
	writeFileSync(reportJsonPath, JSON.stringify(migrationReport, null, 2));
	const reportMdPath = join(outputPath, "betterbase", "convex-migration-report.md");
	writeFileSync(reportMdPath, generateMigrationReportMarkdown(migrationReport));

	const blockerCount = issues.filter((issue) => issue.severity === "blocker").length;
	const warningCount = issues.filter((issue) => issue.severity === "warning").length;
	const manualReviewCount = files.filter((file) => file.status === "manual-review").length;

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
5. Review compatibility report: ${reportJsonPath}

Compatibility summary:
- Blockers: ${blockerCount}
- Warnings: ${warningCount}
- Files requiring manual review: ${manualReviewCount}

See docs/iac/migration-from-convex.md for detailed guide.
  `);
}

function findFile(dir: string, filename: string): string | null {
	if (!isDirectorySafe(dir)) return null;

	for (const entry of readdirSync(dir)) {
		const fullPath = join(dir, entry);
		if (statSync(fullPath).isFile() && entry === filename) {
			return fullPath;
		}
	}
	return null;
}

function isDirectorySafe(path: string): boolean {
	return existsSync(path) && statSync(path).isDirectory();
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

function convertFunctionsDir(
	inputDir: string,
	outputDir: string,
	kind: "query" | "mutation" | "action",
): ConversionStats {
	const files = readdirSync(inputDir);
	const issues: MigrationIssue[] = [];
	const fileReports: ConvertedFileReport[] = [];
	let convertedCount = 0;

	for (const file of files) {
		const inputPath = join(inputDir, file);
		if (!statSync(inputPath).isFile() || !file.endsWith(".ts")) continue;

		const content = readFileSync(inputPath, "utf-8");
		const filePath = `${kind}s/${file}`;
		const fileIssues = scanCompatibilityIssues(content, filePath);
		issues.push(...fileIssues);
		const converted = convertFunction(content, kind);
		const outputName = file.replace(".ts", ".ts");
		writeFileSync(join(outputDir, outputName), converted);
		const blockers = fileIssues.filter((issue) => issue.severity === "blocker").length;
		const warnings = fileIssues.filter((issue) => issue.severity === "warning").length;
		fileReports.push({
			file: filePath,
			kind,
			status: blockers > 0 || warnings > 0 ? "manual-review" : "converted",
			blockers,
			warnings,
		});
		convertedCount += 1;
	}

	logger.success(`Converted ${convertedCount} ${kind}s`);
	return { converted: convertedCount, issues, files: fileReports };
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

function scanCompatibilityIssues(content: string, file: string): MigrationIssue[] {
	const rules: Array<{
		regex: RegExp;
		pattern: string;
		severity: "warning" | "blocker";
		message: string;
		suggestion: string;
	}> = [
		{
			regex: /\bhttpAction\s*\(/,
			pattern: "httpAction()",
			severity: "blocker",
			message: "Convex httpAction is not auto-converted.",
			suggestion: "Recreate this endpoint as a BetterBase function or route handler manually.",
		},
		{
			regex: /\bcronJobs\s*\(/,
			pattern: "cronJobs()",
			severity: "blocker",
			message: "Convex cron jobs are not auto-converted.",
			suggestion: "Recreate schedules with BetterBase cron or your workflow scheduler.",
		},
		{
			regex: /\bctx\.scheduler\./,
			pattern: "ctx.scheduler.*",
			severity: "warning",
			message: "Convex scheduler API usage requires manual migration review.",
			suggestion: "Map this to BetterBase actions/workflows and re-test behavior.",
		},
		{
			regex: /\binternal(Query|Mutation|Action)\s*\(/,
			pattern: "internalQuery/internalMutation/internalAction",
			severity: "warning",
			message: "Internal Convex functions may need explicit access-control redesign.",
			suggestion: "Review visibility and auth boundaries after conversion.",
		},
	];

	return rules
		.filter((rule) => rule.regex.test(content))
		.map((rule) => ({
			file,
			severity: rule.severity,
			pattern: rule.pattern,
			message: rule.message,
			suggestion: rule.suggestion,
		}));
}

function generateMigrationReportMarkdown(report: {
	schemaConverted: boolean;
	counts: { queries: number; mutations: number; actions: number };
	issues: MigrationIssue[];
	files?: ConvertedFileReport[];
}): string {
	const blockerCount = report.issues.filter((issue) => issue.severity === "blocker").length;
	const warningCount = report.issues.filter((issue) => issue.severity === "warning").length;

	const issuesSection =
		report.issues.length === 0
			? "No compatibility issues detected automatically."
			: report.issues
					.map(
						(issue) =>
							`- [${issue.severity.toUpperCase()}] \`${issue.file}\` — ${issue.message}\n  - Pattern: \`${issue.pattern}\`\n  - Suggestion: ${issue.suggestion}`,
					)
					.join("\n");

	const fileReviewSection =
		report.files && report.files.length > 0
			? [
					"| File | Kind | Status | Blockers | Warnings |",
					"|------|------|--------|----------|----------|",
					...report.files.map(
						(file) =>
							`| \`${file.file}\` | ${file.kind} | ${file.status} | ${file.blockers} | ${file.warnings} |`,
					),
				].join("\n")
			: "No function files were converted.";

	return `# Convex Migration Compatibility Report

## Conversion Summary

- Schema converted: ${report.schemaConverted ? "yes" : "no"}
- Queries converted: ${report.counts.queries}
- Mutations converted: ${report.counts.mutations}
- Actions converted: ${report.counts.actions}

## Compatibility Findings

- Blockers: ${blockerCount}
- Warnings: ${warningCount}

${issuesSection}

## File-Level Conversion Status

${fileReviewSection}
`;
}
