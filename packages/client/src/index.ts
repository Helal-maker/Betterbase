export { createClient, BetterBaseClient } from "./client";
export { QueryBuilder } from "./query-builder";
export { AuthClient } from "./auth";
export { RealtimeClient } from "./realtime";
export { Storage, StorageBucketClient } from "./storage";
export {
	BetterBaseError,
	NetworkError,
	AuthError,
	ValidationError,
} from "./errors";

export type {
	BetterBaseConfig,
	BetterBaseResponse,
	QueryOptions,
	RealtimeCallback,
	RealtimeSubscription,
} from "./types";

export type {
	UploadOptions,
	SignedUrlOptions,
	StorageFile,
	UploadResult,
	PublicUrlResult,
	SignedUrlResult,
	RemoveResult,
} from "./storage";

export type { User, Session } from "./auth";

// IaC exports
export { BetterbaseProvider, useBBFContext, type BBFConfig } from "./iac/provider";
export {
	useQuery,
	useMutation,
	useAction,
	type UseQueryResult,
	type UseMutationResult,
} from "./iac/hooks";
export { usePaginatedQuery, type UsePaginatedQueryResult } from "./iac/paginated-query";
export { createBBFClient, type VanillaBBFClient } from "./iac/vanilla";
