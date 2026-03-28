# Query Optimization

BetterBase provides tools to analyze and optimize your database queries.

## Query Analysis

```typescript
// Analyze any query's execution plan
const analysis = await ctx.db.analyze(
  `SELECT * FROM orders WHERE user_id = $1`,
  [userId]
);

// Results
console.log(analysis.estimatedCost);   // Query planner cost
console.log(analysis.isSlow);         // True if cost > 1000
console.log(analysis.suggestedIndexes); // Array of suggestions
console.log(analysis.plan);           // Full EXPLAIN output
```

## CLI Analysis Command

```bash
# Analyze all queries in your project
bb iac analyze

# Output shows:
# - Query path and complexity score
# - Detected issues (full scans, missing indexes)
# - Suggested fixes
```

## Common Issues and Fixes

### Full Table Scan

**Problem**: Query scans entire table
```typescript
// This causes a full scan
ctx.db.query("users").filter("email", "eq", "test@example.com").collect();
```

**Fix**: Add an index
```typescript
// In schema.ts
users: defineTable({
  email: v.string(),
}).index("by_email", ["email"]),  // Add index
```

### Unbounded Results

**Problem**: No limit on results
```typescript
// Might return millions of rows
ctx.db.query("orders").collect();
```

**Fix**: Always use `.take()`
```typescript
ctx.db.query("orders").take(100).collect();
```

### N+1 Queries

**Problem**: Loop causing multiple queries
```typescript
// Bad: N+1 problem
for (const post of posts) {
  const author = await ctx.db.get("users", post.authorId);
}
```

**Fix**: Batch fetch or use raw SQL
```typescript
// Better: Single query with JOIN
const authors = await ctx.db.execute(
  `SELECT u.* FROM users u 
   JOIN posts p ON p.author_id = u._id 
   WHERE p._id = ANY($1)`,
  [posts.map(p => p._id)]
);
```

## Performance Tips

1. **Always add indexes** for fields you filter by
2. **Use `.take()`** to limit result sets
3. **Select only needed columns** with raw SQL
4. **Index foreign keys** for joins
5. **Consider denormalization** for read-heavy patterns