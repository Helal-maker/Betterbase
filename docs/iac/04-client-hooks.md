# Client Hooks

## Setup

Wrap your app with `<BetterbaseProvider>`:

```tsx
import { BetterbaseProvider } from "@betterbase/client/iac";

<BetterbaseProvider config={{ url: "http://localhost:3001", projectSlug: "my-project" }}>
  <App />
</BetterbaseProvider>
```

## `useQuery`

Real-time. Automatically re-fetches when server data changes.

```tsx
import { useQuery } from "@betterbase/client/iac";
import { api } from "../bbf/_generated/api";

function UserProfile({ id }: { id: string }) {
  const { data: user, isLoading, error } = useQuery(api.queries.users.getUser, { id });

  if (isLoading) return <div>Loading...</div>;
  if (error)     return <div>Error: {error.message}</div>;
  return <div>{user?.name}</div>;
}
```

## `useMutation`

```tsx
import { useMutation } from "@betterbase/client/iac";
import { api } from "../bbf/_generated/api";

function CreateUserForm() {
  const create = useMutation(api.mutations.users.createUser);

  return (
    <button
      onClick={() => create.mutateAsync({ name: "Alice", email: "alice@example.com" })}
      disabled={create.isPending}
    >
      {create.isPending ? "Creating..." : "Create User"}
    </button>
  );
}
```

## `useAction`

```tsx
import { useAction } from "@betterbase/client/iac";
import { api } from "../bbf/_generated/api";

function WelcomeButton({ userId }: { userId: string }) {
  const sendEmail = useAction(api.actions.email.sendWelcomeEmail);

  return (
    <button onClick={() => sendEmail.mutate({ userId })}>
      Send Welcome Email
    </button>
  );
}
```

## `usePaginatedQuery`

```tsx
import { usePaginatedQuery } from "@betterbase/client/iac";
import { api } from "../bbf/_generated/api";

function PostList() {
  const { results, loadMore, isDone, isLoading } =
    usePaginatedQuery(api.queries.posts.listPaginated, {}, { initialNumItems: 10 });

  return (
    <>
      {results.map(post => <PostCard key={post._id} post={post} />)}
      {!isDone && <button onClick={loadMore} disabled={isLoading}>Load more</button>}
    </>
  );
}
```

## Vanilla (non-React) client

```typescript
import { createBBFClient } from "@betterbase/client/iac";
import { api } from "./bbf/_generated/api";

const client = createBBFClient({ url: "http://localhost:3001" });

const user = await client.query(api.queries.users.getUser, { id: "abc" });
await client.mutation(api.mutations.users.createUser, { name: "Alice", email: "a@b.com" });

// Subscribe to real-time updates
const unsub = client.subscribe(api.queries.users.getUser, { id: "abc" }, () => {
  // refetch logic
});
// Later:
unsub();
```