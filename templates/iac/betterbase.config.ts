import { defineConfig } from "@betterbase/core";

export default defineConfig({
  project: {
    name: "my-iac-project",
  },
  provider: {
    type: "postgres",
    connectionString: process.env.DATABASE_URL,
  },
});