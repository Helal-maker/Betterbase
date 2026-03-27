/**
 * BetterBase IaC Error Classes
 *
 * Provides improved error messages with suggestions for common issues.
 */

export class IaCError extends Error {
	constructor(
		message: string,
		public readonly code: string,
		public readonly suggestion?: string,
		public readonly docsUrl?: string,
	) {
		super(message);
		this.name = "IaCError";
	}

	toJSON() {
		return {
			name: this.name,
			message: this.message,
			code: this.code,
			suggestion: this.suggestion,
			docsUrl: this.docsUrl,
		};
	}
}

export class ValidationError extends IaCError {
	constructor(message: string, suggestion?: string) {
		super(message, "VALIDATION_ERROR", suggestion, "https://docs.betterbase.io/iac/validators");
		this.name = "ValidationError";
	}
}

export class DatabaseError extends IaCError {
	constructor(message: string, suggestion?: string) {
		super(message, "DATABASE_ERROR", suggestion, "https://docs.betterbase.io/iac/database");
		this.name = "DatabaseError";
	}
}

export class AuthError extends IaCError {
	constructor(message: string, suggestion?: string) {
		super(message, "AUTH_ERROR", suggestion, "https://docs.betterbase.io/auth");
		this.name = "AuthError";
	}
}

export class NotFoundError extends IaCError {
	constructor(resource: string, suggestion?: string) {
		super(
			`${resource} not found`,
			"NOT_FOUND",
			suggestion ?? `Check if the ${resource.toLowerCase()} exists in your schema`,
		);
		this.name = "NotFoundError";
	}
}

/**
 * Format an error for display in the client
 */
export function formatError(error: unknown): {
	message: string;
	code?: string;
	suggestion?: string;
	docsUrl?: string;
} {
	if (error instanceof IaCError) {
		return error.toJSON();
	}

	if (error instanceof Error) {
		// Provide suggestions based on common error patterns
		const suggestion = getSuggestionForError(error);
		return {
			message: error.message,
			suggestion,
		};
	}

	return { message: "An unknown error occurred" };
}

function getSuggestionForError(error: Error): string | undefined {
	const message = error.message.toLowerCase();

	if (message.includes("relation") && message.includes("does not exist")) {
		return "Run 'bb iac sync' to create the missing table in your database";
	}

	if (message.includes("permission") || message.includes("denied")) {
		return "Check your RLS policies or authentication in bbf/schema.ts";
	}

	if (message.includes("timeout") || message.includes("timed out")) {
		return "Consider adding an index or optimizing your query";
	}

	if (message.includes("invalid utf")) {
		return "Check for invalid characters in your data";
	}

	if (message.includes("null") && message.includes("not null")) {
		return "Provide a value for the required field or make it optional in your schema";
	}

	return undefined;
}
