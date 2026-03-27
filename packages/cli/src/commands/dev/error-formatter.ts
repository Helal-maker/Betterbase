import { ZodError } from "zod";
import chalk from "chalk";

export function formatDevError(err: unknown, context: string): string {
  if (err instanceof ZodError) {
    const lines = [chalk.red(`  ✗ Validation error in ${context}`)];
    for (const issue of err.issues) {
      const path = issue.path.length ? issue.path.join(".") : "root";
      lines.push(`    ${chalk.dim(path)}: ${chalk.yellow(issue.message)}`);
    }
    return lines.join("\n");
  }

  if (err instanceof Error) {
    // Highlight the first relevant stack frame
    const relevant = err.stack
      ?.split("\n")
      .find(l => l.includes("bbf/") || l.includes("src/modules"));
    return [
      chalk.red(`  ✗ ${context}: ${err.message}`),
      relevant ? chalk.dim(`    ${relevant.trim()}`) : "",
    ].filter(Boolean).join("\n");
  }

  return chalk.red(`  ✗ ${context}: ${String(err)}`);
}

/** Pretty-print a schema diff for the dev console */
export function formatDiffForDev(changes: { type: string; table: string; column?: string; destructive: boolean }[]): string {
  return changes.map(c => {
    const icon   = c.destructive ? chalk.red("⚠") : chalk.green("+");
    const detail = c.column ? `${c.table}.${c.column}` : c.table;
    return `  ${icon} ${chalk.dim(c.type.replace("_", " ").toLowerCase())} ${chalk.white(detail)}`;
  }).join("\n");
}