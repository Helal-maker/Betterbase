# BetterBase IaC — Introduction

BetterBase IaC is a Convex-inspired layer that lets you define your **data model** and **server functions** in TypeScript, inside a `bbf/` directory. The CLI handles schema migrations automatically.

## Why IaC?

| Old pattern | IaC pattern |
|---|---|
| Write Drizzle schema manually | Define tables with `defineSchema()` and `v.*` validators |
| Write Hono routes | Write `query()`, `mutation()`, `action()` functions |
| Run `drizzle-kit push` manually | Run `bb iac sync` (or let `bb dev` do it) |
| Fetch from client with raw `fetch()` | Use `useQuery()` / `useMutation()` hooks |

## Quick start

```bash
bb init my-app --iac
cd my-app
bun install
bb dev
```

Your server is running. Add a table, add a function, the client updates automatically.