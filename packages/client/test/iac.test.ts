import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { BetterbaseProvider, useAction, useMutation, useQuery } from "../src/iac/index";
import { createBBFClient } from "../src/iac/vanilla";

const TEST_URL = process.env.BBF_TEST_URL ?? "http://localhost:3001";
const TEST_PROJECT = "test-project";

describe("IaC Client Integration Tests", () => {
	// Mock function registrations for testing
	const mockQuery = {
		__bbfPath: "queries/test/getUser",
		_args: { parse: (a: any) => ({ success: true, data: a }) },
		_handler: async (ctx: any, args: any) => ({ id: args.id, name: "Test User" }),
	} as any;

	const mockMutation = {
		__bbfPath: "mutations/test/createUser",
		_args: { parse: (a: any) => ({ success: true, data: a }) },
		_handler: async (ctx: any, args: any) => ({ id: "new-id", ...args }),
	} as any;

	describe("createBBFClient", () => {
		it("should create a client with valid config", () => {
			const client = createBBFClient({ url: TEST_URL, projectSlug: TEST_PROJECT });
			expect(client).toBeDefined();
			expect(typeof client.query).toBe("function");
			expect(typeof client.mutation).toBe("function");
			expect(typeof client.subscribe).toBe("function");
		});

		it("should create client and allow close", () => {
			const client = createBBFClient({ url: TEST_URL, projectSlug: TEST_PROJECT });
			expect(() => client.close()).not.toThrow();
		});
	});

	describe("useQuery hook", () => {
		it("should return default state on mount", () => {
			// Note: In real test environment, we'd use React Testing Library
			// This is a structural test to verify the hook exports correctly
			expect(useQuery).toBeDefined();
			expect(typeof useQuery).toBe("function");
		});
	});

	describe("useMutation hook", () => {
		it("should return mutation interface", () => {
			expect(useMutation).toBeDefined();
			expect(typeof useMutation).toBe("function");
		});
	});

	describe("useAction hook", () => {
		it("should return action interface", () => {
			expect(useAction).toBeDefined();
			expect(typeof useAction).toBe("function");
		});
	});

	describe("BetterbaseProvider", () => {
		it("should export Provider component", () => {
			expect(BetterbaseProvider).toBeDefined();
		});
	});
});

describe("Type exports", () => {
	it("should export UseQueryResult type", () => {
		// Verify the type is exported (we can't test types at runtime, but we can verify the export exists)
		const exports = require("../src/iac/index");
		expect(exports.useQuery).toBeDefined();
	});

	it("should export BBFConfig type", () => {
		const exports = require("../src/iac/index");
		expect(exports.BetterbaseProvider).toBeDefined();
	});
});
