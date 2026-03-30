import chalk from "chalk";

const IS_UNICODE =
	process.platform !== "win32" || Boolean(process.env.CI) || Boolean(process.env.WT_SESSION);

export const sym = {
	success: IS_UNICODE ? "✓" : "+",
	error: IS_UNICODE ? "✗" : "x",
	warn: IS_UNICODE ? "⚠" : "!",
	info: IS_UNICODE ? "◆" : "*",
	arrow: IS_UNICODE ? "→" : "->",
	bullet: IS_UNICODE ? "•" : "-",
	tree: IS_UNICODE ? "├─" : "|-",
	treeLast: IS_UNICODE ? "└─" : "\\-",
	dot: IS_UNICODE ? "·" : ".",
};

export function success(msg: string): void {
	console.log(`${chalk.green(sym.success)} ${msg}`);
}

export function error(msg: string, hint?: string): void {
	console.error(`${chalk.red(sym.error)} ${chalk.red(msg)}`);
	if (hint) {
		console.error(`  ${chalk.dim(hint)}`);
	}
}

export function warn(msg: string): void {
	console.warn(`${chalk.yellow(sym.warn)} ${chalk.yellow(msg)}`);
}

export function info(msg: string): void {
	console.log(`${chalk.cyan(sym.info)} ${msg}`);
}

export function dim(msg: string): void {
	console.log(chalk.dim(msg));
}

export function step(n: number, total: number, msg: string): void {
	const badgeValue = chalk.bgCyan.black(` ${n}/${total} `);
	console.log(`${badgeValue} ${msg}`);
}

export function section(title: string): void {
	console.log("");
	console.log(chalk.bold(chalk.white(title)));
	console.log(chalk.dim("─".repeat(Math.min(title.length + 2, 60))));
}

export function keyValue(key: string, value: string, opts?: { secret?: boolean }): void {
	const displayed = opts?.secret ? chalk.dim("••••••••") : chalk.cyan(value);
	console.log(`  ${chalk.dim(key.padEnd(22))} ${displayed}`);
}

export function tree(items: string[]): void {
	items.forEach((item, i) => {
		const isLast = i === items.length - 1;
		const prefix = isLast ? sym.treeLast : sym.tree;
		console.log(`  ${chalk.dim(prefix)} ${item}`);
	});
}

export function blank(): void {
	console.log("");
}

export function banner(version: string): void {
	console.log("");
	console.log(chalk.bold(chalk.white("  betterbase")) + chalk.dim(` v${version}`));
	console.log(chalk.dim("  AI-native Backend-as-a-Service"));
	console.log("");
}

export function box(title: string, lines: { label: string; value: string }[]): void {
	const width = 60;
	const border = chalk.dim("─".repeat(width));
	console.log("");
	console.log(chalk.dim("┌") + border + chalk.dim("┐"));
	console.log(chalk.dim("│") + chalk.bold(` ${title}`).padEnd(width + 9) + chalk.dim("│"));
	console.log(chalk.dim("├") + border + chalk.dim("┤"));
	for (const line of lines) {
		const label = chalk.dim(line.label.padEnd(18));
		const value = chalk.cyan(line.value);
		const content = ` ${label} ${value}`;
		console.log(chalk.dim("│") + content.padEnd(width + 12) + chalk.dim("│"));
	}
	console.log(chalk.dim("└") + border + chalk.dim("┘"));
	console.log("");
}

export function badge(text: string, color: "green" | "red" | "yellow" | "blue" | "dim"): string {
	const map = {
		green: chalk.bgGreen.black,
		red: chalk.bgRed.white,
		yellow: chalk.bgYellow.black,
		blue: chalk.bgBlue.white,
		dim: chalk.bgGray.white,
	};
	return map[color](` ${text} `);
}

export function done(startMs: number, msg?: string): void {
	const elapsed = ((Date.now() - startMs) / 1000).toFixed(2);
	console.log(`\n${chalk.green(sym.success)} ${msg ?? "Done"} ${chalk.dim(`(${elapsed}s)`)}`);
}
