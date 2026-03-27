# Scheduler

## Schedule a mutation to run later

```typescript
export const createPost = mutation({
  args: { title: v.string(), publishAt: v.optional(v.datetime()) },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("posts", { title: args.title, published: false });

    if (args.publishAt) {
      await ctx.scheduler.runAt(
        new Date(args.publishAt),
        api.mutations.posts.publishPost,
        { id }
      );
    }

    return id;
  },
});
```

## Delayed execution

```typescript
// Send a follow-up email 24h after signup
await ctx.scheduler.runAfter(
  24 * 60 * 60 * 1000,          // 24 hours in ms
  api.mutations.email.sendFollowUp,
  { userId }
);
```

## Cron jobs

```typescript
// bbf/cron.ts
import { cron } from "@betterbase/core/iac";
import { api } from "./_generated/api";

cron("daily-digest", "0 8 * * *", api.mutations.email.sendDailyDigest, {});
cron("cleanup",      "*/30 * * * *", api.mutations.system.cleanExpiredSessions, {});
```

Supported schedule formats:
- `*/N * * * *` — every N minutes
- `0 * * * *` — every hour
- `0 H * * *` — daily at hour H UTC