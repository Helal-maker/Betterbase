import { join } from "path";
import { discoverFunctions, generateApiTypes } from "@betterbase/core/iac";
import { mkdir, writeFile } from "fs/promises";
import { info, success } from "../../utils/logger";

export async function runIacGenerate(projectRoot: string) {
	const bbfDir = join(projectRoot, "bbf");
	const genDir = join(bbfDir, "_generated");

	info("Scanning bbf/ for functions...");
	const fns = await discoverFunctions(bbfDir);
	info(`Found ${fns.length} functions.`);

	const apiTypes = generateApiTypes(fns);

	await mkdir(genDir, { recursive: true });
	await writeFile(join(genDir, "api.d.ts"), apiTypes);

	success(`Generated bbf/_generated/api.d.ts (${fns.length} functions)`);
}
