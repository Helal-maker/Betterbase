# Provider Capabilities, Limitations, and Rollout Plan

This guide standardizes how BetterBase should handle every supported database provider in multi-tenant projects.

It has three goals:

1. **Make limitations explicit** so users understand tradeoffs before choosing a provider.
2. **Define a consistent implementation plan** so API and Dashboard UX behave predictably.
3. **Enforce API/UI parity** so any capability can be configured by API first and optionally through UI.

## Source of Truth in Current Codebase

Current core provider adapters:

- `neon`
- `turso`
- `planetscale`
- `supabase`
- `postgres`
- `managed` (placeholder, not yet supported)

See provider resolution and supported-provider list in code:

- `packages/core/src/providers/index.ts`
- `packages/core/src/providers/types.ts`
- `packages/core/src/config/schema.ts`

## Capability Matrix (Current Behavior)

> Important: this matrix reflects the current implementation in the repository.

| Provider | Connect Requirement | SQL Dialect | RLS | GraphQL | CDC/Event Feed | Branching in `core/branching` |
|---|---|---|---|---|---|---|
| Postgres | `connectionString` | Postgres | ✅ | ✅ | ✅ LISTEN/NOTIFY | ✅ |
| Neon | `connectionString` | Postgres | ✅ | ✅ | ⚠️ Limited/polling fallback | ✅ |
| Supabase | `connectionString` | Postgres | ✅ | ✅ | ✅ LISTEN/NOTIFY | ✅ |
| Turso | `url` + `authToken` | SQLite/libSQL | ❌ | ❌ | ✅ SQL-heuristic wrapper | ❌ |
| PlanetScale | `connectionString` | MySQL | ❌ | ❌ | ❌ (no-op callback) | ❌ |
| Managed | no DB connection | N/A | N/A | N/A | N/A | Placeholder only |

## Provider-by-Provider Strategy

### 1) Postgres

**Status:** Most complete baseline.

**What to maximize now**
- Use Postgres as the reference implementation for secure multi-tenancy.
- RLS-first design for row isolation and role-based access.
- CDC-backed webhooks/realtime patterns.

**Known limitations**
- None material in current adapter path.

### 2) Neon

**Status:** Production-ready for multi-tenant with serverless posture.

**What to maximize now**
- Same policy model as Postgres (RLS + SQL policy templates).
- Keep API behavior identical to Postgres provider where possible.

**Known limitations**
- CDC path is marked as limited and includes polling fallback.
- For higher-fidelity event streams, support external CDC connectors as an optional advanced mode.

### 3) Supabase

**Status:** Strong parity with Postgres in current adapter design.

**What to maximize now**
- Reuse Postgres policy templates.
- Keep auth-context-to-policy mapping explicit in API.

**Known limitations**
- No major adapter-level gaps in current code.

### 4) Turso

**Status:** Good for edge/distributed workloads, but fewer security primitives.

**What to maximize now**
- Use application-level tenant enforcement middleware (strict owner/tenant filters).
- Add aggressive guardrails for updates/deletes to prevent unscoped writes.

**Known limitations**
- No native RLS in adapter contract.
- GraphQL support marked false in adapter.
- Branching unsupported in current branching module.

### 5) PlanetScale

**Status:** Serverless MySQL path with clear capability gaps.

**What to maximize now**
- Application-enforced tenant guards (required `tenant_id` filters).
- Strong policy DSL in BetterBase API + generated query constraints.
- Safe SQL access with tenant-context binding only.

**Known limitations**
- No RLS in adapter contract.
- No GraphQL in adapter contract.
- CDC callback is a no-op placeholder.
- Branching unsupported by current branching module implementation.

### 6) Managed (Future)

**Status:** Declared in schema and provider union but intentionally not supported yet.

**What to maximize now**
- Keep explicit docs stating this is roadmap-only.
- Return deterministic errors and migration guidance.

## Implementation Blueprint (All Providers)

### Phase A: Provider Capability Registry (single source)

Create/maintain a central capability registry consumed by:

- API validation
- Dashboard forms
- CLI hints
- Docs generation

Example capability keys:

- `supportsRLS`
- `supportsGraphQL`
- `supportsBranching`
- `supportsCDC`
- `supportsTenantGuardrails`

### Phase B: Multi-Tenant Guardrail Engine

Implement a provider-agnostic guardrail engine for API paths:

- Require tenant context for configured protected tables.
- Reject unscoped writes in strict mode.
- Auto-inject tenant filters in generated query builders.
- Include bypass scopes for service-role maintenance jobs (audited).

This is the path to maximum user control while remaining safe on providers without native RLS.

### Phase C: API-first Contract (UI as client)

Every configurable behavior must exist in API first:

- `POST /projects/:id/provider/capabilities` (read-only introspection)
- `POST /projects/:id/security/tenant-mode`
- `POST /projects/:id/security/table-policies`
- `POST /projects/:id/query-governance`
- `POST /projects/:id/branching/config`

Dashboard should call these APIs directly. No UI-only settings.

### Phase D: Provider-specific Advanced Integrations

- PlanetScale: add provider-native branch workflow integration path.
- Neon/Supabase/Postgres: expose optional advanced CDC tuning and replay tooling.
- Turso: expand deterministic CDC mapping and conflict/retry policy controls.

### Phase E: Queue and Workflow Interop

- Keep Inngest as the default workflow/queue runtime in BetterBase environments.
- Add provider-aware retry/idempotency defaults for event handlers.
- Document framework bridges (including Laravel apps) via HTTP/webhook/event contracts until a first-class adapter exists.
- Require that queue configuration and visibility are API-driven (Dashboard consumes same APIs).

## Documentation Requirements (for release readiness)

For each provider, docs must include:

1. Setup requirements (required env vars).
2. Capability matrix values.
3. Security model (native RLS vs app-enforced).
4. Branching behavior.
5. Realtime/CDC behavior.
6. Example tenant policy configuration.
7. "Known limitations" and recommended mitigations.

## API/UI Parity Checklist

Use this checklist before shipping new provider features:

- [ ] Capability visible via API.
- [ ] Same capability configurable in Dashboard.
- [ ] CLI has discovery/help command for capability.
- [ ] Docs include exact limitation language.
- [ ] API returns actionable error messages per provider.
- [ ] Audit logs capture policy and governance changes.

## Suggested External References (Official Docs)

Use these during implementation and validation:

- PostgreSQL docs: https://www.postgresql.org/docs/current/
- Neon docs: https://neon.tech/docs
- Supabase docs: https://supabase.com/docs
- Turso docs: https://docs.turso.tech
- PlanetScale docs: https://planetscale.com/docs
- Drizzle ORM docs: https://orm.drizzle.team/docs/overview

## Notes for Product and Engineering

- Be explicit with users when a provider uses **application-enforced** tenancy rather than **database-native** tenancy.
- Keep behavior deterministic: same request should yield same policy enforcement regardless of UI or SDK path.
- Prefer secure defaults (`strict` tenant mode on create).

## Related Internal Docs

- `docs/core/providers.md`
- `docs/core/config.md`
- `docs/core/branching.md`
- `docs/core/auto-rest.md`
- `docs/features/database.md`
- `docs/features/rls.md`
