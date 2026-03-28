import { join } from "path";
import { type Subprocess, spawn } from "bun";
import chalk from "chalk";
import { error, info, success, warn } from "../../utils/logger";

export class ProcessManager {
	private _proc: Subprocess | null = null;
	private _projectRoot: string;
	private _restartCount = 0;
	private _restartCooldown = false;

	constructor(projectRoot: string) {
		this._projectRoot = projectRoot;
	}

	async start(): Promise<void> {
		if (this._proc) await this.stop();

		const entryPoint = join(this._projectRoot, "src", "index.ts");

		this._proc = spawn({
			cmd: ["bun", "run", entryPoint],
			cwd: this._projectRoot,
			env: { ...process.env, NODE_ENV: "development" },
			stdout: "pipe",
			stderr: "pipe",
			onExit: (proc, code, signal) => {
				if (code !== 0 && code !== null && !this._restartCooldown) {
					error(`[server] Process exited with code ${code}. Restarting...`);
					this._scheduleRestart(500);
				}
			},
		});

		// Pipe stdout with [server] prefix
		this._pipeStream(
			this._proc.stdout as ReadableStream<Uint8Array> | null,
			chalk.cyan("[server]"),
		);
		this._pipeStream(
			this._proc.stderr as ReadableStream<Uint8Array> | null,
			chalk.red("[server:err]"),
		);

		success(`[dev] Server started (restart #${this._restartCount})`);
	}

	async stop(): Promise<void> {
		if (!this._proc) return;
		this._proc.kill("SIGTERM");
		await this._proc.exited.catch(() => {});
		this._proc = null;
	}

	async restart(reason?: string): Promise<void> {
		if (this._restartCooldown) return;
		this._restartCooldown = true;
		setTimeout(() => {
			this._restartCooldown = false;
		}, 300);

		if (reason) info(`[dev] Restarting — ${reason}`);
		this._restartCount++;
		await this.start();
	}

	private _scheduleRestart(delayMs: number) {
		setTimeout(() => this.restart("process exited"), delayMs);
	}

	private _pipeStream(stream: ReadableStream<Uint8Array> | null, prefix: string) {
		if (!stream) return;
		const reader = stream.getReader();
		const decoder = new TextDecoder();
		const pump = () => {
			reader
				.read()
				.then(({ done, value }) => {
					if (done) return;
					const lines = decoder.decode(value).split("\n").filter(Boolean);
					lines.forEach((line) => console.log(`${prefix} ${line}`));
					pump();
				})
				.catch(() => {});
		};
		pump();
	}
}
