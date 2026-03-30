import chalk from "chalk";
import ora, { type Ora } from "ora";
import { sym } from "./logger";

export function createSpinner(text: string): Ora {
	return ora({
		text,
		color: "cyan",
		spinner: {
			interval: 80,
			frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
		},
	});
}

export async function withSpinner<T>(
	text: string,
	task: (spinner: Ora) => Promise<T>,
	opts?: { successText?: string; failText?: string },
): Promise<T> {
	const spinner = createSpinner(text).start();
	try {
		const result = await task(spinner);
		spinner.stopAndPersist({
			symbol: chalk.green(sym.success),
			text: opts?.successText ?? text,
		});
		return result;
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		spinner.stopAndPersist({
			symbol: chalk.red(sym.error),
			text: `${opts?.failText ?? text}: ${chalk.red(message)}`,
		});
		throw err;
	}
}
 
