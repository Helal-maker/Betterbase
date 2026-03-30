<div align="center">

# Betterbase

**Enterprise Backend Platform for Product Teams**

*AI-native backend development with IaC workflows, realtime APIs, auth, storage, and deployment flexibility.*

[Documentation](./docs/README.md) • [Self Hosting](./SELF_HOSTED.md) • [Contributing](./CONTRIBUTING.md) • [Notice](./NOTICE.md)

</div>

---

## Executive Summary

Betterbase is an enterprise-ready backend platform designed for teams that need to move fast without sacrificing governance, security posture, or infrastructure portability.

It combines:

- **Developer velocity** with Bun + TypeScript workflows.
- **Backend consistency** through Infrastructure-as-Code patterns.
- **Operational control** through self-hosted and cloud-capable deployment modes.
- **Scalable architecture** across authentication, database access, storage, realtime, and background automation.

If your organization wants a modern backend platform with strong engineering ergonomics and clear pathways to production hardening, Betterbase is built for that mission.

---

## Who Betterbase Is For

Betterbase is optimized for:

- **Platform Engineering teams** building internal developer platforms.
- **Product Engineering teams** shipping SaaS features rapidly.
- **Enterprise organizations** requiring policy-driven architecture and auditable change management.
- **Teams migrating from fragmented backend stacks** to a unified, opinionated foundation.

---

## Core Capabilities

### 1) Infrastructure-as-Code (IaC) Application Layer

Model backend behavior in TypeScript with a structured pattern for:

- Schema definitions (`defineSchema`, `defineTable`)
- Queries and mutations
- Actions and scheduled jobs
- Module-level organization for larger codebases

### 2) Data Platform

- SQL-first architecture
- Migration workflows
- Full-text and vector search options
- Provider-aware behavior with documented rollout limitations and capabilities

### 3) Auth and Access Control

- BetterAuth-based authentication workflows
- Session and provider integrations
- Row-level access patterns and security-oriented practices

### 4) Realtime and API Surfaces

- Realtime subscriptions
- REST and GraphQL support
- SDK-first integration model for frontend and service clients

### 5) Async and Event Workloads

- Webhooks
- Background functions
- Durable orchestration through Inngest-compatible flows

### 6) Deployment Flexibility

- Local development
- Docker and containerized deployments
- Self-hosted enterprise topology options

---

## Architecture at a Glance

```text
Clients (Web, Mobile, Services)
        │
        ▼
 Betterbase Runtime Layer
 ├─ Auth + Sessions
 ├─ API Surface (REST/GraphQL)
 ├─ Realtime
 ├─ Function Runtime
 ├─ Storage Integration
 └─ IaC-Defined Data Access
        │
        ▼
 Database Providers (SQLite/PostgreSQL/MySQL/libSQL)
        │
        ▼
 Operations Layer (Migrations, Monitoring, Deployment, Automation)
```

For detailed architecture and module mapping, start here:

1. [`NOTICE.md`](./NOTICE.md)
2. [`CODEBASE_MAP.md`](./CODEBASE_MAP.md)
3. [`docs/README.md`](./docs/README.md)
4. [`docs/guides/provider-capabilities-and-rollout.md`](./docs/guides/provider-capabilities-and-rollout.md)

---

## Quick Start (IaC Workflow)

### Prerequisites

- Bun (recommended runtime/package manager)
- Docker (recommended for production-like local testing)

### Bootstrap a Project

```bash
bun install -g @betterbase/cli
bb init my-app
cd my-app
bun install
bb dev
```

### Typical Project Layout

```text
my-app/
├── betterbase/
│   ├── schema.ts
│   ├── queries/
│   ├── mutations/
│   ├── actions/
│   └── cron.ts
├── betterbase.config.ts
└── package.json
```

### Sample Schema (TypeScript)

```ts
import { defineSchema, defineTable, v } from "@betterbase/core/iac"

export const schema = defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
  }).uniqueIndex("by_email", ["email"]),
})
```

---

## Enterprise Operating Model

### Governance and Change Management

- IaC-centered definitions support repeatable, reviewable backend changes.
- Migration and config workflows can be integrated into CI/CD controls.
- Repository-level standards support branch-driven release discipline.

### Security Posture

- Auth integration patterns with provider-level controls.
- Row-level access strategies for tenant and user isolation.
- Guidance for security and production hardening in dedicated docs.

### Reliability and Observability

- Designed for structured monitoring and operational playbooks.
- Deployment and scaling guides included for production planning.
- Supports separation of concerns between product feature teams and platform operations.

---

## Documentation Map

### Getting Started

- [`docs/getting-started/installation.md`](./docs/getting-started/installation.md)
- [`docs/getting-started/quick-start.md`](./docs/getting-started/quick-start.md)
- [`docs/getting-started/your-first-project.md`](./docs/getting-started/your-first-project.md)

### IaC Documentation

- [`docs/iac/01-introduction.md`](./docs/iac/01-introduction.md)
- [`docs/iac/02-schema.md`](./docs/iac/02-schema.md)
- [`docs/iac/03-functions.md`](./docs/iac/03-functions.md)
- [`docs/iac/14-migration-from-convex.md`](./docs/iac/14-migration-from-convex.md)

### Core and Features

- [`docs/core/overview.md`](./docs/core/overview.md)
- [`docs/features/database.md`](./docs/features/database.md)
- [`docs/features/authentication.md`](./docs/features/authentication.md)
- [`docs/features/realtime.md`](./docs/features/realtime.md)
- [`docs/features/storage.md`](./docs/features/storage.md)

### APIs and Clients

- [`docs/api-reference/cli-commands.md`](./docs/api-reference/cli-commands.md)
- [`docs/api-reference/rest-api.md`](./docs/api-reference/rest-api.md)
- [`docs/api-reference/graphql-api.md`](./docs/api-reference/graphql-api.md)
- [`docs/api-reference/client-sdk.md`](./docs/api-reference/client-sdk.md)

### Production Guidance

- [`docs/guides/deployment.md`](./docs/guides/deployment.md)
- [`docs/guides/security-best-practices.md`](./docs/guides/security-best-practices.md)
- [`docs/guides/monitoring.md`](./docs/guides/monitoring.md)
- [`docs/guides/scaling.md`](./docs/guides/scaling.md)
- [`docs/guides/production-checklist.md`](./docs/guides/production-checklist.md)

---

## Deployment Modes

- **Local Development:** Fast feedback loops for application development.
- **Containerized:** Docker-based workflows for reproducible environments.
- **Self-Hosted Enterprise:** Internal infrastructure with security/compliance controls.

For implementation details, see:

- [`SELF_HOSTED.md`](./SELF_HOSTED.md)
- [`docs/docker-setup.md`](./docs/docker-setup.md)
- [`docker-compose.production.yml`](./docker-compose.production.yml)

---

## Repository Structure

```text
betterbase/
├── apps/                  # runnable apps and test projects
├── packages/              # core packages (cli, client, core)
├── templates/             # scaffolding templates
├── docs/                  # full documentation portal
├── docker-compose*.yml    # deployment/topology manifests
└── turbo.json             # monorepo task orchestration
```

---

## Development and Contribution

Please read:

- [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- [`docs/README.md`](./docs/README.md)

Typical local workflow:

```bash
bun install
bun run build
bun test
bun run lint
```

---

## Product Positioning

Betterbase is built to serve as a **future-facing enterprise backend foundation**: opinionated where it accelerates teams, flexible where organizations need control.

In short: **developer speed, enterprise guardrails, production portability.**

