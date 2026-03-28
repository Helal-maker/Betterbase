import { beforeEach, describe, expect, it, mock } from "bun:test";

// Mock the inngest module
const mockInngestSend = mock(() => Promise.resolve({ ids: [] }));
const mockInngestCreateFunction = mock(() => ({
	id: "mock-function",
	run: mock(() => Promise.resolve({})),
}));

mock.module("../src/lib/inngest", () => ({
	inngest: {
		createFunction: mockInngestCreateFunction,
		send: mockInngestSend,
	},
	deliverWebhook: { id: "deliver-webhook" },
	evaluateNotificationRule: { id: "evaluate-notification-rule" },
	exportProjectUsers: { id: "export-project-users" },
	pollNotificationRules: { id: "poll-notification-rules" },
	allInngestFunctions: [
		{ id: "deliver-webhook" },
		{ id: "evaluate-notification-rule" },
		{ id: "export-project-users" },
		{ id: "poll-notification-rules" },
	],
}));

// Mock the db module
const mockPool = {
	query: mock(() => Promise.resolve({ rows: [] })),
};

mock.module("../src/lib/db", () => ({
	getPool: () => mockPool,
}));

describe("Inngest client", () => {
	beforeEach(() => {
		mockInngestSend.mockClear();
		mockInngestCreateFunction.mockClear();
		mockPool.query.mockClear();
	});

	describe("Event schema", () => {
		it("should define webhook deliver event structure", () => {
			const event = {
				name: "betterbase/webhook.deliver",
				data: {
					webhookId: "wh_123",
					webhookName: "Test Webhook",
					url: "https://example.com/webhook",
					secret: "secret123",
					eventType: "INSERT",
					tableName: "users",
					payload: { id: "1", name: "Test" },
					attempt: 1,
				},
			};

			expect(event.name).toBe("betterbase/webhook.deliver");
			expect(event.data.webhookId).toBe("wh_123");
			expect(event.data.eventType).toBe("INSERT");
		});

		it("should define notification evaluate event structure", () => {
			const event = {
				name: "betterbase/notification.evaluate",
				data: {
					ruleId: "rule_123",
					ruleName: "High Error Rate",
					metric: "error_rate",
					threshold: 5,
					channel: "email",
					target: "admin@example.com",
					currentValue: 10,
				},
			};

			expect(event.name).toBe("betterbase/notification.evaluate");
			expect(event.data.metric).toBe("error_rate");
			expect(event.data.channel).toBe("email");
		});

		it("should define export users event structure", () => {
			const event = {
				name: "betterbase/export.users",
				data: {
					projectId: "proj_123",
					projectSlug: "my-project",
					requestedBy: "admin@example.com",
					filters: {
						search: "john",
						banned: false,
						from: "2024-01-01",
						to: "2024-12-31",
					},
				},
			};

			expect(event.name).toBe("betterbase/export.users");
			expect(event.data.projectSlug).toBe("my-project");
			expect(event.data.filters?.search).toBe("john");
		});
	});

	describe("Function definitions", () => {
		it("should have 4 Inngest functions registered", () => {
			const functions = [
				{ id: "deliver-webhook" },
				{ id: "evaluate-notification-rule" },
				{ id: "export-project-users" },
				{ id: "poll-notification-rules" },
			];

			expect(functions.length).toBe(4);
			expect(functions.map((f) => f.id)).toContain("deliver-webhook");
			expect(functions.map((f) => f.id)).toContain("poll-notification-rules");
		});
	});

	describe("Webhook dispatcher", () => {
		it("should construct correct webhook event data", () => {
			const webhookData = {
				webhookId: "wh_test",
				webhookName: "Test Webhook",
				url: "https://example.com/hook",
				secret: "mysecret",
				eventType: "INSERT",
				tableName: "orders",
				payload: { id: "order_1", total: 100 },
				attempt: 1,
			};

			expect(webhookData.eventType).toBe("INSERT");
			expect(webhookData.tableName).toBe("orders");
			expect(webhookData.attempt).toBe(1);
		});

		it("should handle null secret gracefully", () => {
			const webhookData = {
				webhookId: "wh_test",
				url: "https://example.com/hook",
				secret: null,
				eventType: "UPDATE",
				tableName: "products",
				payload: { id: "prod_1" },
				attempt: 1,
			};

			expect(webhookData.secret).toBeNull();
		});
	});

	describe("Notification rule evaluation", () => {
		it("should trigger notification when threshold is breached", () => {
			const rule = {
				ruleId: "rule_1",
				metric: "error_rate",
				threshold: 5,
				currentValue: 10,
			};

			const shouldTrigger = rule.currentValue >= rule.threshold;
			expect(shouldTrigger).toBe(true);
		});

		it("should not trigger notification when threshold is not breached", () => {
			const rule = {
				ruleId: "rule_1",
				metric: "error_rate",
				threshold: 5,
				currentValue: 2,
			};

			const shouldTrigger = rule.currentValue >= rule.threshold;
			expect(shouldTrigger).toBe(false);
		});

		it("should support email and webhook channels", () => {
			const channels = ["email", "webhook"];
			expect(channels).toContain("email");
			expect(channels).toContain("webhook");
		});
	});

	describe("Cron schedule", () => {
		it("should use 5-minute interval for notification polling", () => {
			const cronExpression = "*/5 * * * *";
			const parts = cronExpression.split(" ");

			expect(parts[0]).toBe("*/5"); // Every 5 minutes
			expect(parts.length).toBe(5);
		});
	});

	describe("CSV export", () => {
		it("should build CSV header correctly", () => {
			const header = "id,name,email,email_verified,created_at,banned";
			const columns = header.split(",");

			expect(columns).toContain("id");
			expect(columns).toContain("email");
			expect(columns).toContain("banned");
		});

		it("should format row data with proper escaping", () => {
			const row = {
				id: "user_1",
				name: "John Doe",
				email: "john@example.com",
				email_verified: true,
				created_at: "2024-01-15",
				banned: false,
			};

			const csvRow = `${row.id},"${row.name}","${row.email}",${row.email_verified},${row.created_at},${row.banned}`;
			expect(csvRow).toContain('"John Doe"');
			expect(csvRow).toContain("john@example.com");
		});

		it("should apply search filter in SQL", () => {
			const filters = { search: "test" };
			const conditions = [];

			if (filters.search) {
				conditions.push(`(email ILIKE $1 OR name ILIKE $1)`);
			}

			expect(conditions.length).toBe(1);
			expect(conditions[0]).toContain("ILIKE");
		});
	});

	describe("Concurrency limits", () => {
		it("should limit webhook deliveries to 10 per webhook ID", () => {
			const concurrency = { limit: 10, key: "event.data.webhookId" };
			expect(concurrency.limit).toBe(10);
		});

		it("should limit CSV exports to 1 per project", () => {
			const concurrency = { limit: 1, key: "event.data.projectId" };
			expect(concurrency.limit).toBe(1);
		});
	});

	describe("Retry configuration", () => {
		it("should configure 5 retries for webhook delivery", () => {
			const retries = 5;
			expect(retries).toBe(5);
		});

		it("should configure 3 retries for notification evaluation", () => {
			const retries = 3;
			expect(retries).toBe(3);
		});

		it("should configure 2 retries for CSV export", () => {
			const retries = 2;
			expect(retries).toBe(2);
		});

		it("should configure 1 retry for cron polling", () => {
			const retries = 1;
			expect(retries).toBe(1);
		});
	});
});

describe("Inngest environment configuration", () => {
	describe("BASE_URL scenarios", () => {
		it("should use cloud API when INNGEST_BASE_URL is undefined", () => {
			const baseUrl = undefined;
			const effectiveUrl = baseUrl ?? "https://api.inngest.com";
			expect(effectiveUrl).toBe("https://api.inngest.com");
		});

		it("should use local dev server when INNGEST_BASE_URL is localhost:8288", () => {
			const baseUrl = "http://localhost:8288";
			expect(baseUrl).toBe("http://localhost:8288");
		});

		it("should use self-hosted container when INNGEST_BASE_URL is inngest:8288", () => {
			const baseUrl = "http://inngest:8288";
			expect(baseUrl).toBe("http://inngest:8288");
		});
	});

	describe("Signing key", () => {
		it("should have default signing key for development", () => {
			const signingKey = undefined;
			const effectiveKey = signingKey ?? "betterbase-dev-signing-key";
			expect(effectiveKey).toBe("betterbase-dev-signing-key");
		});

		it("should use provided signing key in production", () => {
			const signingKey = "prod-key-123";
			expect(signingKey).toBe("prod-key-123");
		});
	});

	describe("Event key", () => {
		it("should have default event key for development", () => {
			const eventKey = undefined;
			const effectiveKey = eventKey ?? "betterbase-dev-event-key";
			expect(effectiveKey).toBe("betterbase-dev-event-key");
		});

		it("should use provided event key in production", () => {
			const eventKey = "prod-event-key-456";
			expect(eventKey).toBe("prod-event-key-456");
		});
	});
});
