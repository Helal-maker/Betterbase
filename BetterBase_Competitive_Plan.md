# BetterBase Competitive Plan — Gap-Closing Edition

> Date: 2026-03-29  
> Purpose: This is **not** a greenfield strategy. It assumes BetterBase already implements most core platform capabilities and focuses only on remaining gaps to outperform Convex.

---

## 1) Reality check: what is already built

BetterBase already has broad platform scope implemented and documented:

- IaC schema/functions model
- Auth, Realtime, Storage, Serverless Functions
- Full-text + vector search
- RLS, branching, self-hosted deployment path

This plan avoids re-planning those fundamentals and focuses on adoption, trust, and migration leverage.

---

## 2) Working mode (required before each implementation)

Before writing code, capture this mini brief in the issue/PR:

1. **Goal delta** — what improves for users this week.
2. **Existing capability used** — which implemented feature we are building on.
3. **Gap to close** — the smallest missing part.
4. **Proof** — tests/benchmarks/docs updates required.
5. **Rollback** — how to revert safely.

If this brief is missing, implementation is not ready.

---

## 3) What we should *actually* do next to beat Convex

### Priority A — Migration dominance (wedge strategy)

Convex users will only move if migration is low-risk.

**Now build:**
- Compatibility scanner in `bb migrate from-convex`
- Per-function conversion report (converted/manual/blocker)
- Auto-generated TODO checklist for unsupported APIs

**Win condition:** A typical Convex project can estimate migration effort in minutes.

---

### Priority B — Proof over claims

The implementation exists; now we need undeniable credibility.

**Now build:**
- Public benchmark methodology + reproducible scripts
- CI gate that blocks merges on test/lint/typecheck failures
- “Production evidence” docs (backup/restore, incident drill, rollback walkthrough)

**Win condition:** Every major product claim maps to a measurable artifact.

---

### Priority C — Onboarding compression

Feature-rich products lose if time-to-success is slow.

**Now build:**
- `bb init` starter that includes auth + realtime + storage out-of-the-box
- `bb doctor` command for environment health + fix suggestions
- Guided CLI output with concrete next-step commands after each setup action

**Win condition:** New user goes from init to first realtime app flow in under 10 minutes.

---

## 4) 30-day execution board

### Week 1
- Finalize migration compatibility report format
- Add CI rule enforcement and branch protections

### Week 2
- Ship first version of Convex compatibility scanner
- Publish benchmark methodology doc

### Week 3
- Add `bb doctor` checks and actionable fixes
- Add migration case study template

### Week 4
- Publish 2 end-to-end migration examples
- Publish proof matrix mapping claims -> tests/docs/benchmarks

---

## 5) What to stop doing

- Rewriting broad strategy docs from scratch when features already exist
- Shipping claims without proof links
- Merging “works locally” changes without deterministic test coverage

---

## 6) KPI focus (weekly)

- Convex migration starts / completions
- Time-to-first-success (new project)
- Main-branch green rate
- p95 API latency (local and hosted)
- Number of claims backed by reproducible artifacts

If 2 KPIs regress for 2 consecutive weeks, pause roadmap expansion and fix core reliability/adoption blockers.
