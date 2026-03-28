import { join } from "path";
import { discoverFunctions, generateApiTypes } from "@betterbase/core/iac";
import { mkdir, writeFile } from "fs/promises";
import { info, success } from "../../utils/logger";

export async function runIacGenerate(projectRoot: string) {
	const betterbaseDir = join(projectRoot, "betterbase");
	const genDir = join(betterbaseDir, "_generated");

	info("Scanning betterbase/ for functions...");
	const fns = await discoverFunctions(betterbaseDir);
	info(`Found ${fns.length} functions.`);

	const apiTypes = generateApiTypes(fns);

	await mkdir(genDir, { recursive: true });
	await writeFile(join(genDir, "api.d.ts"), apiTypes);

	success(`Generated betterbase/_generated/api.d.ts (${fns.length} functions)`);
}
