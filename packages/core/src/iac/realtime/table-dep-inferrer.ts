/**
 * Statically infer which tables a query handler reads from.
 *
 * Strategy: regex-scan the handler's `.toString()` source for patterns like:
 *   ctx.db.get("users", ...)
 *   ctx.db.query("posts")
 *
 * This is best-effort — complex dynamic access falls back to ["*"] (wildcard).
 */
export function inferTableDependencies(handler: Function): string[] {
  const src    = handler.toString();
  const tables: Set<string> = new Set();

  // Match ctx.db.get("tableName", ...) or ctx.db.query("tableName")
  const GET_PATTERN   = /ctx\.db\.(?:get|query)\(\s*["'`]([a-zA-Z_][a-zA-Z0-9_]*)["'`]/g;
  const QUERY_PATTERN = /\.query\(\s*["'`]([a-zA-Z_][a-zA-Z0-9_]*)["'`]/g;

  let match: RegExpExecArray | null;
  while ((match = GET_PATTERN.exec(src))   !== null) tables.add(match[1]);
  while ((match = QUERY_PATTERN.exec(src)) !== null) tables.add(match[1]);

  // If nothing found or handler uses dynamic keys, fall back to wildcard
  return tables.size > 0 ? [...tables] : ["*"];
}

/**
 * Build a table → [functionPaths] map from the function registry.
 * Used to efficiently route invalidations server-side without scanning all subs.
 */
export function buildTableFunctionIndex(
  fns: { path: string; kind: string; handler: any }[]
): Map<string, string[]> {
  const index = new Map<string, string[]>();

  for (const fn of fns) {
    if (fn.kind !== "query") continue;
    const tables = inferTableDependencies(fn.handler._handler);
    for (const table of tables) {
      if (!index.has(table)) index.set(table, []);
      index.get(table)!.push(fn.path);
    }
  }

  return index;
}