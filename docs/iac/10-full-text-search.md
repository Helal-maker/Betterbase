# Full-Text Search

BetterBase integrates PostgreSQL full-text search into the IaC layer.

## Define a Searchable Field

```typescript
// bbf/schema.ts
import { defineSchema, defineTable, v } from "@betterbase/core/iac";

export default defineSchema({
  documents: defineTable({
    title:   v.string(),
    content: v.fullText(),  // Enable full-text search on this field
    author:  v.id("users"),
  }).index("by_author", ["author"]),
});
```

The migration generator will automatically:
- Create a GIN index on the text column
- Set up the tsvector for search

## Search in Queries

```typescript
// bbf/queries/documents.ts
import { query } from "@betterbase/core/iac";
import { v } from "@betterbase/core/iac";

export const searchDocuments = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    return ctx.db.query("documents")
      .search(args.query)
      .take(20)
      .collect();
  },
});
```

## Search with Ranking

```typescript
const docs = await ctx.db.query("documents")
  .search("typescript tutorial")
  .take(10)
  .collect();

// Results are ranked by relevance automatically
```

## How It Works

- Uses PostgreSQL `tsvector` and `ts_rank`
- Matches against English dictionary by default
- Handles stemming (e.g., "running" matches "run")
- Ignores stop words (the, a, an, etc.)

## Performance

For large datasets, ensure:
- The GIN index is created (automatic)
- Query terms are meaningful (at least 3 characters)
- Consider adding specific field indexes for exact matches