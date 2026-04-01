import { AuthGuard } from "@/components/auth/AuthGuard";
import { SetupGuard } from "@/components/auth/SetupGuard";
import { AppLayout } from "@/layouts/AppLayout";
import type { RouteObject } from "react-router";

import { PageSkeleton } from "@/components/ui/PageSkeleton";
// Lazy imports for code splitting
import { Suspense, lazy } from "react";

const wrap = (Component: React.LazyExoticComponent<any>) => (
	<Suspense fallback={<PageSkeleton />}>
		<Component />
	</Suspense>
);

// Pages
const SetupPage = lazy(() => import("@/pages/SetupPage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const OverviewPage = lazy(() => import("@/pages/OverviewPage"));
const ObservabilityPage = lazy(() => import("@/pages/ObservabilityPage"));
const MetricsPage = lazy(() => import("@/pages/MetricsPage"));
const ProjectsPage = lazy(() => import("@/pages/projects/ProjectsPage"));
const ProjectDetailPage = lazy(() => import("@/pages/projects/ProjectDetailPage"));
const ProjectLayout = lazy(() => import("@/pages/projects/ProjectLayout"));
const ProjectObservabilityPage = lazy(() => import("@/pages/projects/ProjectObservabilityPage"));
const ProjectUsersPage = lazy(() => import("@/pages/projects/users/ProjectUsersPage"));
const ProjectUserPage = lazy(() => import("@/pages/projects/users/ProjectUserPage"));
const ProjectAuthPage = lazy(() => import("@/pages/projects/ProjectAuthPage"));
const ProjectDatabasePage = lazy(() => import("@/pages/projects/ProjectDatabasePage"));
const ProjectRealtimePage = lazy(() => import("@/pages/projects/ProjectRealtimePage"));
const ProjectEnvPage = lazy(() => import("@/pages/projects/ProjectEnvPage"));
const ProjectWebhooksPage = lazy(() => import("@/pages/projects/ProjectWebhooksPage"));
const ProjectFunctionsPage = lazy(() => import("@/pages/projects/ProjectFunctionsPage"));
// IaC Pages
const ProjectIaCSchemaPage = lazy(() => import("@/pages/projects/ProjectIaCSchemaPage"));
const ProjectIaCFunctionsPage = lazy(() => import("@/pages/projects/ProjectIaCFunctionsPage"));
const ProjectIaCJobsPage = lazy(() => import("@/pages/projects/ProjectIaCJobsPage"));
const ProjectIaCRealtimePage = lazy(() => import("@/pages/projects/ProjectIaCRealtimePage"));
const ProjectIaCQueryPage = lazy(() => import("@/pages/projects/ProjectIaCQueryPage"));
const StoragePage = lazy(() => import("@/pages/StoragePage"));
const StorageBucketPage = lazy(() => import("@/pages/StorageBucketPage"));
const LogsPage = lazy(() => import("@/pages/LogsPage"));
const AuditPage = lazy(() => import("@/pages/AuditPage"));
const TeamPage = lazy(() => import("@/pages/TeamPage"));
const SettingsPage = lazy(() => import("@/pages/settings/SettingsPage"));
const SmtpPage = lazy(() => import("@/pages/settings/SmtpPage"));
const NotificationsPage = lazy(() => import("@/pages/settings/NotificationsPage"));
const ApiKeysPage = lazy(() => import("@/pages/settings/ApiKeysPage"));
const InngestDashboardPage = lazy(() => import("@/pages/settings/InngestDashboardPage"));
const WebhookDeliveriesPage = lazy(() => import("@/pages/WebhookDeliveriesPage"));
const FunctionInvocationsPage = lazy(() => import("@/pages/FunctionInvocationsPage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));

export const routes: RouteObject[] = [
	// Setup — only accessible before any admin exists
	{ path: "/setup", element: <SetupGuard>{wrap(SetupPage)}</SetupGuard> },

	// Auth
	{ path: "/login", element: wrap(LoginPage) },

	// App — all routes behind auth guard
	{
		element: (
			<AuthGuard>
				<AppLayout />
			</AuthGuard>
		),
		children: [
			{ index: true, element: wrap(OverviewPage) },
			{ path: "observability", element: wrap(ObservabilityPage) },
			{ path: "metrics", element: wrap(MetricsPage) },
			{ path: "projects", element: wrap(ProjectsPage) },
			{
				path: "projects/:projectId",
				element: wrap(ProjectLayout),
				children: [
					{ index: true, element: wrap(ProjectDetailPage) },
					{ path: "observability", element: wrap(ProjectObservabilityPage) },
					{ path: "users", element: wrap(ProjectUsersPage) },
					{ path: "users/:userId", element: wrap(ProjectUserPage) },
					{ path: "auth", element: wrap(ProjectAuthPage) },
					{ path: "database", element: wrap(ProjectDatabasePage) },
					{ path: "realtime", element: wrap(ProjectRealtimePage) },
					{ path: "env", element: wrap(ProjectEnvPage) },
					{ path: "webhooks", element: wrap(ProjectWebhooksPage) },
					{ path: "functions", element: wrap(ProjectFunctionsPage) },
					{ path: "iac/schema", element: wrap(ProjectIaCSchemaPage) },
					{ path: "iac/functions", element: wrap(ProjectIaCFunctionsPage) },
					{ path: "iac/jobs", element: wrap(ProjectIaCJobsPage) },
					{ path: "iac/realtime", element: wrap(ProjectIaCRealtimePage) },
					{ path: "iac/query", element: wrap(ProjectIaCQueryPage) },
				],
			},
			{ path: "webhooks/:webhookId/deliveries", element: wrap(WebhookDeliveriesPage) },
			{ path: "functions/:functionId/invocations", element: wrap(FunctionInvocationsPage) },
			{ path: "storage", element: wrap(StoragePage) },
			{ path: "storage/:bucketName", element: wrap(StorageBucketPage) },
			{ path: "logs", element: wrap(LogsPage) },
			{ path: "audit", element: wrap(AuditPage) },
			{ path: "team", element: wrap(TeamPage) },
			{ path: "settings", element: wrap(SettingsPage) },
			{ path: "settings/smtp", element: wrap(SmtpPage) },
			{ path: "settings/notifications", element: wrap(NotificationsPage) },
			{ path: "settings/api-keys", element: wrap(ApiKeysPage) },
			{ path: "settings/inngest", element: wrap(InngestDashboardPage) },
		],
	},
	{ path: "*", element: wrap(NotFoundPage) },
];
