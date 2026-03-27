import path from "node:path";

const moduleDir = import.meta.dir;
const outdir = path.resolve(moduleDir, "../dist");

// Build main index
const entrypoint = path.resolve(moduleDir, "index.ts");

const esmResult = await Bun.build({
	entrypoints: [entrypoint],
	outdir,
	target: "browser",
	format: "esm",
	minify: false,
	sourcemap: "external",
	naming: "index.js",
	external: ["@betterbase/core", "@betterbase/shared", "better-auth"],
});

if (!esmResult.success) {
	console.error(`ESM build failed: ${esmResult.logs.map((log) => log.toString()).join("\n")}`);
	process.exit(1);
}

const cjsResult = await Bun.build({
	entrypoints: [entrypoint],
	outdir,
	target: "node",
	format: "cjs",
	minify: false,
	sourcemap: "external",
	naming: "index.cjs",
	external: ["@betterbase/core", "@betterbase/shared", "better-auth"],
});

if (!cjsResult.success) {
	console.error(`CJS build failed: ${cjsResult.logs.map((log) => log.toString()).join("\n")}`);
	process.exit(1);
}

// Build IaC module
const iacEntrypoint = path.resolve(moduleDir, "iac/index.ts");
const iacOutdir = path.resolve(outdir, "iac");

// Ensure iac directory exists
await Bun.write(path.resolve(iacOutdir, ".gitkeep"), "");

const iacResult = await Bun.build({
	entrypoints: [iacEntrypoint],
	outdir: iacOutdir,
	target: "browser",
	format: "esm",
	minify: false,
	sourcemap: "external",
	naming: "index.js",
	external: ["@betterbase/core", "react", "react-dom"],
});

if (!iacResult.success) {
	console.error(`IaC build failed: ${iacResult.logs.map((log) => log.toString()).join("\n")}`);
	process.exit(1);
}

const proc = Bun.spawn(
	["bunx", "tsc", "--project", "tsconfig.json", "--emitDeclarationOnly", "--outDir", outdir],
	{
		cwd: path.resolve(moduleDir, ".."),
		stdout: "inherit",
		stderr: "inherit",
	},
);

const exitCode = await proc.exited;
if (exitCode !== 0) {
	console.error("TypeScript declaration generation failed");
	process.exit(1);
}

console.log("✅ Build complete!");
