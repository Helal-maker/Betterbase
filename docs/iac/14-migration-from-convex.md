# Migration from Convex to BetterBase

BetterBase provides a migration tool to help you move your Convex project to BetterBase. This guide covers the process end-to-end.

## Why Migrate?

| Convex Limitation | BetterBase Solution |
|-------------------|---------------------|
| Black box database | Full PostgreSQL access |
| No raw SQL | `ctx.db.execute()` for complex queries |
| No full-text search | Built-in PostgreSQL FTS |
| No vector search | pgvector with HNSW indexes |
| Vendor lock-in | Self-host or use BetterBase cloud |
| Expensive pricing | Open-source, free to self-host |

## Quick Migration

```bash
# Migrate your Convex project
bb migrate from-convex ./my-convex-project --output ./my-betterbase-project

cd my-betterbase-project
bun install
bb dev
```

The tool converts:
- Convex schema (`schema.ts`) → BetterBase schema (`bbf/schema.ts`)
- Convex validators (`v.*`) → BetterBase validators (`v.*`)
- Convex queries → BetterBase queries (`bbf/queries/`)
- Convex mutations → BetterBase mutations (`bbf/mutations/`)
- Convex actions → BetterBase actions (`bbf/actions/`)

## What Gets Converted

### Schema

**Convex:**
```typescript
import { defineSchema, defineTable } from "convex/server";

export default defineSchema({
  tasks: defineTable({
    text: v.string(),
    completed: v.boolean(),
  }).index("by_completed", ["completed"]),
});
```

**BetterBase:**
```typescript
import { defineSchema, defineTable, v } from "@betterbase/core/iac";

export default defineSchema({
  tasks: defineTable({
    text: v.string(),
    completed: v.boolean(),
  }).index("by_completed", ["completed"]),
});
```

### Validators

| Convex | BetterBase |
|--------|------------|
| `v.string()` | `v.string()` |
| `v.number()` | `v.number()` |
| `v.boolean()` | `v.boolean()` |
| `v.id("table")` | `v.id("table")` |
| `v.optional(v.string())` | `v.optional(v.string())` |
| `v.array(v.string())` | `v.array(v.string())` |

### Functions

**Convex queries:**
```typescript
export const getTasks = query({
  handler: async (ctx) => {
    return await ctx.db.query("tasks").collect();
  },
});
```

**BetterBase queries:**
```typescript
export const getTasks = query({
  handler: async (ctx) => {
    return await ctx.db.query("tasks").collect();
  },
});
```

## Manual Steps Required

After migration, you'll need to:

1. **Install dependencies:**
   ```bash
   bun add @betterbase/core @betterbase/client
   ```

2. **Sync database schema:**
   ```bash
   bb iac sync
   ```

3. **Review converted code** - Check for any edge cases the migration tool couldn't handle

4. **Update client code** - Replace Convex client with BetterBase client:
   ```typescript
   // Convex
   import { useQuery, useMutation } from "convex/react";

   // BetterBase
   import { useQuery, useMutation } from "@betterbase/client/iac";
   ```

5. **Configure database** - Set up your PostgreSQL connection in `betterbase.config.ts`

## Data Migration

Export your data from Convex and import to BetterBase:

### 1. Export from Convex

Use Convex's dashboard or API to export your data as JSON.

### 2. Import to BetterBase

```bash
# Convert to BetterBase format
bb iac import ./data.json --table tasks
```

Or use the API directly:

```typescript
// In a migration action
export const migrateData = action({
  args: { data: v.array(v.object({...})) },
  handler: async (ctx, { data }) => {
    for (const item of data) {
      await ctx.db.insert("tasks", item);
    }
  },
});
```

## Feature Comparison

| Feature | Convex | BetterBase |
|---------|--------|------------|
| Database | Black box | Full PostgreSQL |
| Raw SQL | ❌ | ✅ `ctx.db.execute()` |
| Full-text search | ❌ | ✅ `v.fullText()` |
| Vector search | Limited | ✅ `v.vector()` |
| Self-hosting | ❌ | ✅ Docker |
| Data export | Limited | ✅ Full JSON/SQL |

## Support

- GitHub Issues: https://github.com/betterbase/betterbase/issues
- Discord: https://discord.gg/betterbase
- Documentation: https://docs.betterbase.io
