# Defining Your Schema

Your data model lives in `bbf/schema.ts`. You never write SQL.

## Basic example

```typescript
import { defineSchema, defineTable, v } from "@betterbase/core/iac";

export default defineSchema({
  users: defineTable({
    name:  v.string(),
    email: v.string(),
    role:  v.union(v.literal("admin"), v.literal("member")),
    plan:  v.optional(v.union(v.literal("free"), v.literal("pro"))),
  })
  .uniqueIndex("by_email", ["email"]),

  posts: defineTable({
    title:     v.string(),
    body:      v.string(),
    authorId:  v.id("users"),
    published: v.boolean(),
  })
  .index("by_author",    ["authorId"])
  .index("by_published", ["published", "_createdAt"]),
});
```

## Validators (`v.*`)

| Validator | TypeScript type | SQL type |
|---|---|---|
| `v.string()` | `string` | `TEXT` |
| `v.number()` | `number` | `REAL` |
| `v.boolean()` | `boolean` | `BOOLEAN` |
| `v.int64()` | `bigint` | `BIGINT` |
| `v.id("users")` | `string` (branded) | `TEXT` |
| `v.optional(v.string())` | `string \| undefined` | `TEXT` (nullable) |
| `v.array(v.string())` | `string[]` | `JSONB` |
| `v.object({...})` | object | `JSONB` |
| `v.union(v.literal("a"), v.literal("b"))` | `"a" \| "b"` | `TEXT` |
| `v.datetime()` | `string` (ISO 8601) | `TIMESTAMPTZ` |

## System fields

Every document automatically gets:
- `_id` — unique string ID (nanoid)
- `_createdAt` — `Date`
- `_updatedAt` — `Date` (updated by `ctx.db.patch`)

## Indexes

```typescript
.index("by_email", ["email"])            // standard index
.uniqueIndex("by_email", ["email"])      // unique constraint
.searchIndex("by_title", {              // full-text (future)
  searchField: "title",
  filterFields: ["published"],
})
```

## Applying changes

```bash
bb iac diff    # preview what would change
bb iac sync    # apply changes (generates SQL migration + Drizzle schema)
```

Destructive changes (DROP TABLE, DROP COLUMN, type changes) require `--force`:

```bash
bb iac sync --force
```