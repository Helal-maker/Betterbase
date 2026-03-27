# Writing Functions

Functions are the API of your BetterBase app. There are three kinds.

## Queries — read data

```typescript
// bbf/queries/users.ts
import { query } from "@betterbase/core/iac";
import { v } from "@betterbase/core/iac";

export const getUser = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    return ctx.db.get("users", args.id);
  },
});
```

- Read-only. `ctx.db` is a `DatabaseReader` — no insert/patch/delete.
- Real-time by default — clients automatically re-fetch when data changes.

## Mutations — write data

```typescript
// bbf/mutations/users.ts
import { mutation } from "@betterbase/core/iac";
import { v } from "@betterbase/core/iac";

export const createUser = mutation({
  args: { name: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    return ctx.db.insert("users", args);
  },
});
```

- Can read and write. `ctx.db` is a `DatabaseWriter`.
- Writes automatically invalidate subscribed queries.

## Actions — side effects

```typescript
// bbf/actions/email.ts
import { action } from "@betterbase/core/iac";
import { v } from "@betterbase/core/iac";

export const sendWelcomeEmail = action({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(api.queries.users.getUser, { id: args.userId });
    await sendEmail(user.email, "Welcome!");
  },
});
```

- Can call external APIs, run queries, schedule mutations.
- Not transactional — use mutations for DB writes inside actions.

## `ctx` reference

| Property | Queries | Mutations | Actions |
|---|---|---|---|
| `ctx.db` | `DatabaseReader` | `DatabaseWriter` | — |
| `ctx.auth.userId` | ✓ | ✓ | ✓ |
| `ctx.storage` | read-only | read-write | read-write |
| `ctx.scheduler` | — | ✓ | ✓ |
| `ctx.runQuery()` | — | — | ✓ |
| `ctx.runMutation()` | — | — | ✓ |

## `ctx.db` API

```typescript
// Read
await ctx.db.get("users", id)                     // by ID, returns doc or null
await ctx.db.query("users")                       // starts a query builder
  .filter("email", "eq", "alice@example.com")
  .order("desc")
  .take(20)
  .collect()                                      // → T[]
  .first()                                        // → T | null
  .unique()                                       // → T | null (throws if >1)

// Write (mutations only)
await ctx.db.insert("users", { name: "Alice" })   // → id string
await ctx.db.patch("users", id, { name: "Bob" })  // partial update
await ctx.db.replace("users", id, data)           // full replace
await ctx.db.delete("users", id)                  // delete
```