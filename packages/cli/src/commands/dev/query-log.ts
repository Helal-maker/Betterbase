/**
 * BetterBase Dev Mode Query Log
 *
 * Shows queries executed during development with timing and warnings.
 */

import chalk from "chalk";

export interface QueryLogEntry {
	timestamp: Date;
	kind: "query" | "mutation" | "action";
	path: string;
	duration: number;
	success: boolean;
	error?: string;
}

export class QueryLog {
	private entries: QueryLogEntry[] = [];
	private enabled = false;
	private maxEntries = 100;

	enable(): void {
		this.enabled = true;
		console.log(chalk.dim("\n[query-log] Enabled query logging\n"));
	}

	disable(): void {
		this.enabled = false;
		this.printSummary();
	}

	log(entry: Omit<QueryLogEntry, "timestamp">): void {
		if (!this.enabled) return;

		const fullEntry: QueryLogEntry = {
			...entry,
			timestamp: new Date(),
		};

		this.entries.push(fullEntry);
		if (this.entries.length > this.maxEntries) {
			this.entries.shift();
		}

		this.printEntry(fullEntry);
	}

	private printEntry(entry: QueryLogEntry): void {
		const icon = entry.success ? chalk.green("✓") : chalk.red("✗");
		const kindIcon = entry.kind === "query" ? "Q" : entry.kind === "mutation" ? "M" : "A";
		const durationStr = `${entry.duration}ms`;
		const durationColor =
			entry.duration > 500 ? chalk.yellow : entry.duration > 1000 ? chalk.red : chalk.dim;

		const line = [
			chalk.dim(`[${entry.timestamp.toLocaleTimeString()}]`),
			chalk.blue(kindIcon),
			icon,
			chalk.white(entry.path),
			durationColor(durationStr),
		].join(" ");

		console.log(line);

		if (entry.error) {
			console.log(chalk.red(`  Error: ${entry.error}`));
		}

		// Warn about slow queries
		if (entry.duration > 1000 && entry.success) {
			console.log(chalk.yellow("  ⚠ Slow query - consider adding an index"));
		}
	}

	private printSummary(): void {
		if (this.entries.length === 0) return;

		const total = this.entries.length;
		const successful = this.entries.filter((e) => e.success).length;
		const failed = total - successful;
		const avgDuration = this.entries.reduce((sum, e) => sum + e.duration, 0) / this.entries.length;
		const slow = this.entries.filter((e) => e.duration > 1000).length;

		console.log(chalk.dim("\n" + "═".repeat(60)));
		console.log(chalk.bold("Query Log Summary"));
		console.log(
			chalk.dim("  Total:") +
				` ${total} | ` +
				chalk.green("✓ OK:") +
				` ${successful} | ` +
				chalk.red("✗ Failed:") +
				` ${failed}`,
		);
		console.log(
			chalk.dim("  Avg:") +
				` ${Math.round(avgDuration)}ms | ` +
				chalk.yellow("⚠ Slow:") +
				` ${slow}`,
		);
		console.log(chalk.dim("═".repeat(60) + "\n"));
	}

	getEntries(): QueryLogEntry[] {
		return [...this.entries];
	}

	clear(): void {
		this.entries = [];
	}
}

// Singleton instance for global access
export const queryLog = new QueryLog();

