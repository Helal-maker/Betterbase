# BetterBase Notice / Backbone Index

> Last updated: 2026-03-30

This is the **backbone file** for the BetterBase repository.
It gives owners, contributors, and agents a single entry point to understand the project and navigate quickly.

---

## 1) What BetterBase Is

BetterBase is an AI-native Backend-as-a-Service platform built as a monorepo.
It provides database APIs, auth, realtime, storage, webhooks, functions, and IaC workflows with Bun-first tooling.

---

## 2) Canonical Project Entry Points

Read these in order:

1. [`README.md`](./README.md) — product overview and quick start.
2. [`CODEBASE_MAP.md`](./CODEBASE_MAP.md) — detailed architecture and package map.
3. [`docs/README.md`](./docs/README.md) — complete docs navigation.
4. [`docs/guides/provider-capabilities-and-rollout.md`](./docs/guides/provider-capabilities-and-rollout.md) — provider limitations + rollout strategy.
5. [`SELF_HOSTED.md`](./SELF_HOSTED.md) — self-host deployment playbook.

---

## 3) Repository Index (Top-Level)

- `apps/` — runnable applications (dashboard).
- `packages/` — core libraries (`core`, `client`, `shared`, etc.).
- `docs/` — end-user and developer documentation.
- `templates/` — starter templates.
- `docker-compose*.yml` / `Dockerfile*` — runtime and deployment definitions.
- `README.md` / `CODEBASE_MAP.md` / `NOTICE.md` — core orientation docs.

---

## 4) Multi-Tenant Provider Limitations (Must Read)

Provider capabilities are **not identical**. Multi-tenant behavior must be adapted per provider.

### Current provider limitations snapshot

| Provider | Tenant isolation model | RLS | Branching in core | CDC/event behavior | Notes |
|---|---|---|---|---|---|
| Postgres | DB-native + app guardrails | ✅ | ✅ | ✅ LISTEN/NOTIFY | Best baseline for strict tenancy |
| Neon | DB-native + app guardrails | ✅ | ✅ | ⚠️ limited/polling fallback | Use external CDC connectors for high-fidelity streams |
| Supabase | DB-native + app guardrails | ✅ | ✅ | ✅ LISTEN/NOTIFY | Postgres-compatible model |
| Turso | App-enforced tenancy | ❌ | ❌ | ✅ SQL heuristic CDC wrapper | Enforce strict tenant filters in API |
| PlanetScale | App-enforced tenancy | ❌ | ❌ | ❌ no-op callback | Enforce strict tenant filters + scoped writes |
| Managed | N/A | N/A | N/A | N/A | Placeholder; not available yet |

### Mandatory handling rules

1. API-first capabilities (UI must consume API, not create UI-only behavior).
2. If provider has no native RLS, enforce tenant guardrails at application/API layer.
3. Block unscoped writes in strict multi-tenant mode.
4. Surface limitation warnings in both docs and UI.
5. Use provider-specific rollout sequencing based on capability gaps.

Canonical guide:

- [`docs/guides/provider-capabilities-and-rollout.md`](./docs/guides/provider-capabilities-and-rollout.md)

---

## 5) Documentation Ownership Rules

When behavior changes in code, update at least:

- `README.md` (if product-facing behavior changed)
- `CODEBASE_MAP.md` (if architecture/package map changed)
- Relevant guide(s) in `docs/`
- `NOTICE.md` if entry points or backbone structure changed

---

## 6) API and Dashboard Parity Rule

Any new feature that can be configured in Dashboard must also be available via API.
Dashboard acts as an API client, not a separate source of truth.

---

## 7) Queue / Background Workflow Limitations

BetterBase currently documents and integrates background workflows around **Inngest**.

- Preferred queue/workflow path: Inngest-backed jobs and event workflows.
- Self-hosted and local options are available through Inngest runtime configuration.
- There is currently no first-class Laravel Queue adapter documented in this repository.

Handling guidance:

1. For Laravel-based systems, integrate using HTTP/webhook/event bridge patterns first.
2. Require idempotency keys and retry-safe handlers across queue boundaries.
3. Keep queue configuration API-driven and documented per provider environment.

---

## 8) Current Snapshot Notice

This file is an orientation index, not a replacement for detailed docs.
For implementation details and current constraints, always verify against:

- `packages/*` source
- `docs/core/*`
- `docs/guides/provider-capabilities-and-rollout.md`
