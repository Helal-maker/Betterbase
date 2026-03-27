# Raw SQL Access

BetterBase lets you execute raw SQL when you need more power than the query builder provides.

## When to Use Raw SQL

- Complex joins that the query builder can't express
- Aggregations, window functions, CTEs
- Migration scripts
- Debugging and diagnostics

## Security

The `ctx.db.execute()` method:
- Only allows SELECT on reader (read-only context)
- Allows SELECT, INSERT, UPDATE, DELETE on writer
- Automatically prefixes table names with your project schema
- Blocks dangerous commands: DROP, TRUNCATE, ALTER, GRANT, etc.

## Usage in Functions

```typescript
// bbf/queries/analytics.ts
import { query } from "@betterbase/core/iac";
import { v } from "@betterbase/core/iac";

export const getUserStats = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const result = await ctx.db.execute(
      `SELECT 
         COUNT(*) as total_orders,
         SUM(total) as lifetime_value
       FROM "orders" 
       WHERE user_id = $1`,
      [args.userId]
    );
    return result.rows[0];
  },
});
```

## Query Analysis

```typescript
// Analyze a query's execution plan
const analysis = await ctx.db.analyze(
  "SELECT * FROM orders WHERE user_id = $1",
  [args.userId]
);

console.log(analysis.estimatedCost);  // Query cost
console.log(analysis.isSlow);          // True if cost > 1000
console.log(analysis.suggestedIndexes); // Optimization tips
```

## Limitations

- You must handle schema prefixing yourself for complex queries
- Write operations bypass transaction safety (use mutations for that)
- No type checking on results (cast appropriately)