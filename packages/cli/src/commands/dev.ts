import { existsSync } from "fs";
import { join, relative } from "path";
import chalk from "chalk";
import { ContextGenerator } from "../utils/context-generator";
import { error, info, success, warn } from "../utils/logger";
import { ProcessManager } from "./dev/process-manager";
import { queryLog } from "./dev/query-log";
import { DevWatcher } from "./dev/watcher";
import { runIacGenerate } from "./iac/generate";
import { runIacSync } from "./iac/sync";

export async function runDevCommand(projectRoot: string) {
	const hasBetterBase = existsSync(join(projectRoot, "betterbase"));
	const hasIaC = hasBetterBase;

	// Print banner
	console.log(chalk.bold.cyan("\n  BetterBase Dev\n"));
	if (hasIaC) {
		info("IaC layer detected — betterbase/ will be watched for schema and function changes.");
	}

	// Enable query log in dev mode
	const enableQueryLog = process.env.QUERY_LOG === "true" || process.env.QUERY_LOG === "1";
	if (enableQueryLog) {
		queryLog.enable();
	}

	// --- Initial generation pass ---
	if (hasIaC) {
		info("[iac] Running initial sync...");
		await runIacSync(projectRoot, { force: false, silent: true }).catch((e: Error) =>
			warn(`[iac] Initial sync skipped: ${e.message}`),
		);
		await runIacGenerate(projectRoot).catch((e: Error) =>
			warn(`[iac] Initial generate skipped: ${e.message}`),
		);
	}

	// --- Start server process ---
	const pm = new ProcessManager(projectRoot);
	await pm.start();

	// --- Start context generator watcher (existing behavior) ---
	const ctxGen = new ContextGenerator();
	await ctxGen.generate(projectRoot).catch(() => {});

	// --- Start file watcher ---
	const watcher = new DevWatcher({ debounceMs: 150 });

	watcher.on(async (event) => {
		const label = chalk.dim(relative(projectRoot, event.path));

		switch (event.kind) {
			case "schema": {
				info(`[iac] Schema changed: ${label}`);
				const result = await runIacSync(projectRoot, { force: false, silent: false }).catch(
					(e: Error) => {
						warn(`[iac] ${e.message}`);
						return null;
					},
				);
				if (result !== null) {
					await pm.restart("schema synced");
				}
				break;
			}

			case "function": {
				info(`[iac] Function changed: ${label}`);
				await runIacGenerate(projectRoot).catch((e: Error) => warn(`[iac] ${e.message}`));
				await pm.restart("function file changed");
				break;
			}

			case "module": {
				info(`[server] Module changed: ${label}`);
				await pm.restart("module changed");
				break;
			}

			case "config": {
				info(`[config] betterbase.config.ts changed`);
				await pm.restart("config changed");
				break;
			}

			case "server": {
				// Standard server file change — restart without IaC steps
				await pm.restart(`${label} changed`);
				break;
			}
		}

		// Regenerate context on every change
		ctxGen.generate(projectRoot).catch(() => {});
	});

	watcher.start(projectRoot);

	// --- Graceful shutdown ---
	process.on("SIGINT", async () => {
		await shutdown();
		process.exit(0);
	});
	process.on("SIGTERM", async () => {
		await shutdown();
		process.exit(0);
	});

	async function shutdown() {
		info("[dev] Shutting down...");
		queryLog.disable();
		watcher.stop();
		await pm.stop();
	}

	// Return cleanup function for CLI handler
	return async () => {
		await shutdown();
	};
}
