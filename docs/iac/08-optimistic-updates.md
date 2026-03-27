# Optimistic Updates

When a user performs an action (like creating a todo), they expect instant feedback. Optimistic updates make the UI respond immediately, before the server confirms the operation.

## How It Works

```typescript
// bbf/mutations/todos.ts
import { mutation } from "@betterbase/core/iac";
import { v } from "@betterbase/core/iac";

export const createTodo = mutation({
  args: { text: v.string() },
  // NEW: Return the shape of data to show immediately
  optimistic: (args) => ({
    _id: `temp-${Date.now()}`,
    text: args.text,
    completed: false,
    _createdAt: new Date().toISOString(),
  }),
  handler: async (ctx, args) => {
    return ctx.db.insert("todos", { text: args.text, completed: false });
  },
});
```

## Client Usage

```tsx
import { useMutation } from "@betterbase/client/iac";
import { api } from "../bbf/_generated/api";

function CreateTodo() {
  const create = useMutation(api.mutations.todos.createTodo);
  
  return (
    <button
      onClick={() => create.mutateAsync({ text: "Buy milk" })}
      disabled={create.isPending}
    >
      {/* Show optimistic data immediately while pending */}
      {create.optimisticData?.text ?? "Add Todo"}
    </button>
  );
}
```

## How It Behaves

1. User clicks button → optimistic data is set immediately
2. UI updates instantly (no loading spinner)
3. Server request fires
4. On success: optimistic data replaced with real server data
5. On failure: error is set, optimistic data can be reverted

## When to Use

- Form submissions
- Toggle switches
- Creating/editing records
- Any action where the user expects instant feedback

## Best Practices

- Keep optimistic data simple - just enough to show the UI change
- The real data will replace it anyway
- If the mutation fails, use `reset()` to clear optimistic state