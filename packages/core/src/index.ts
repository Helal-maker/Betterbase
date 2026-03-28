export { defineConfig, BetterBaseConfigSchema } from "./config/schema";
export type { BetterBaseConfig } from "./config/schema";
export type { ProviderAdapter, ProviderConfig } from "./providers/types";
export { mountAutoRest } from "./auto-rest";
export type { AutoRestOptions, DrizzleDB, DrizzleTable } from "./auto-rest";

// Storage
export * from "./storage";

// Webhooks
export * from "./webhooks";

// Vector search
export * from "./vector";

// Branching / Preview environments
export * from "./branching";

// Functions
export * from "./functions";

// Logging
export { logger, createRequestLogger, logSlowQuery, logError, logSuccess } from "./logger";

// Realtime (Channel Manager)
export * from "./realtime";

// IaC Layer
export * from "./iac";
export * from "./iac/realtime/subscription-tracker";
export * from "./iac/realtime/invalidation-manager";
export * from "./iac/realtime/table-dep-inferrer";
export * from "./iac/storage/storage-ctx";
