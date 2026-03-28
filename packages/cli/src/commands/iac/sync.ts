import { join } from "path";
import { loadSerializedSchema, saveSerializedSchema, serializeSchema } from "@betterbase/core/iac";
import { diffSchemas, formatDiff } from "@betterbase/core/iac";
import { generateMigration } from "@betterbase/core/iac";
import { generateDrizzleSchema } from "@betterbase/core/iac";
import chalk from "chalk";
import { mkdir, readdir, writeFile } from "fs/promises";
import { error, info, success, warn } from "../../utils/logger";

export async function runIacSync(
	projectRoot: string,
	opts: { force?: boolean; silent?: boolean } = {},
) {
	const betterbaseDir = join(projectRoot, "betterbase");
	const schemaFile = join(betterbaseDir, "schema.ts");
	const prevFile = join(betterbaseDir, "_generated", "schema.json");
	const migrDir = join(projectRoot, "drizzle", "migrations");
	const drizzleOut = join(projectRoot, "src", "db", "schema.generated.ts");
	const genDir = join(betterbaseDir, "_generated");

	let schemaMod: any;
	try {
		schemaMod = await import(schemaFile);
	} catch (e: any) {
		if (!opts.silent) error(`Cannot load betterbase/schema.ts: ${e.message}`);
		throw new Error(`Cannot load betterbase/schema.ts: ${e.message}`);
	}

	const schema = schemaMod.default ?? schemaMod.schema;
	if (!schema?._tables) {
		if (!opts.silent) error("betterbase/schema.ts must export a default defineSchema(...)");
		throw new Error("betterbase/schema.ts must export a default defineSchema(...)");
	}

	const current = serializeSchema(schema);
	const previous = loadSerializedSchema(prevFile);

	const diff = diffSchemas(previous, current);

	if (diff.isEmpty) {
		if (!opts.silent) success("Schema is up to date. No changes detected.");
		return;
	}

	if (!opts.silent) {
		info("Pending schema changes:");
		console.log(formatDiff(diff));
	}

	if (diff.hasDestructive && !opts.force) {
		if (!opts.silent) {
			warn("Destructive changes detected. Re-run with --force to apply, or remove the changes.");
			warn(
				"Destructive operations:\n" +
					diff.changes
						.filter((c) => c.destructive)
						.map((c) => `  ⚠ ${c.type} ${c.table}${c.column ? "." + c.column : ""}`)
						.join("\n"),
			);
		}
		throw new Error("Destructive changes detected. Use --force to override.");
	}

	const existing = await readdir(migrDir).catch(() => [] as string[]);
	const seq = existing.filter((f) => f.endsWith(".sql")).length + 1;
	const label = "iac_auto";
	const migration = generateMigration(diff, seq, label);

	await mkdir(migrDir, { recursive: true });
	await writeFile(join(migrDir, migration.filename), migration.sql);
	if (!opts.silent) info(`Migration written: ${migration.filename}`);

	const drizzleCode = generateDrizzleSchema(current, "postgres");
	await writeFile(drizzleOut, drizzleCode);
	if (!opts.silent) info("Drizzle schema updated: src/db/schema.generated.ts");

	await mkdir(genDir, { recursive: true });
	await saveSerializedSchema(current, prevFile);

	if (!opts.silent) {
		info("Run the migration runner to apply changes to the database.");
		success("IaC sync complete.");
	}
}
