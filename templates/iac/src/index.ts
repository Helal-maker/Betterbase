import { Hono } from "hono";
import { cors } from "hono/cors";
import { bbfRouter } from "@betterbase/server/routes/bbf";
import { discoverFunctions, setFunctionRegistry } from "@betterbase/core/iac";
import { join } from "path";

const app = new Hono();
app.use("*", cors());

// Discover and register bbf/ functions on startup
const fns = await discoverFunctions(join(process.cwd(), "bbf"));
setFunctionRegistry(fns);

// Mount the bbf router — this is your entire API surface
app.route("/bbf", bbfRouter);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

export default { port: 3000, fetch: app.fetch };