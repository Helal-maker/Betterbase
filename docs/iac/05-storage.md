# Storage

## Storing files inside mutations/actions

```typescript
export const uploadAvatar = action({
  args: { userId: v.id("users"), imageData: v.bytes() },
  handler: async (ctx, args) => {
    const blob      = new Blob([Buffer.from(args.imageData, "base64")]);
    const storageId = await ctx.storage.store(blob, { contentType: "image/jpeg" });
    await ctx.runMutation(api.mutations.users.setAvatar, { userId: args.userId, storageId });
    return storageId;
  },
});
```

## Getting a URL

```typescript
export const getAvatarUrl = query({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    return ctx.storage.getUrl(args.storageId);  // presigned URL, expires in 1h
  },
});
```

## Direct browser upload (large files)

For files >1MB, use the presigned upload endpoint to bypass the server:

```typescript
// 1. Get upload URL from action
const { storageId, uploadUrl, fields } = await fetch("/bbf/storage/generate-upload-url", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ contentType: "image/png", filename: "photo.png" }),
}).then(r => r.json());

// 2. Upload directly to S3/MinIO
const formData = new FormData();
Object.entries(fields).forEach(([k, v]) => formData.append(k, v as string));
formData.append("file", fileInput.files[0]);
await fetch(uploadUrl, { method: "POST", body: formData });

// 3. Use storageId to reference the file in your data model
await client.mutation(api.mutations.posts.create, { imageId: storageId, ... });
```