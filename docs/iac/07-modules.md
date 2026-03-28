# Modules (`src/modules/`)

Modules are shared server-side logic imported by your `bbf/` functions.

## Rules

- **No Hono imports** — no `Context`, no `c.req`, no route handling
- **No `ctx.db` calls** — database access belongs in function handlers
- Pure TypeScript — accepts plain args, returns plain values
- Can be used by queries, mutations, and actions

## Example

```typescript
// src/modules/email.ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendWelcomeEmail(to: string, name: string) {
  await resend.emails.send({
    from: "hello@myapp.com",
    to,
    subject: `Welcome, ${name}!`,
    html: `<p>Thanks for signing up.</p>`,
  });
}
```

```typescript
// bbf/mutations/users.ts
import { sendWelcomeEmail } from "../../src/modules/email";

export const createUser = mutation({
  args: { name: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("users", args);
    await sendWelcomeEmail(args.email, args.name);
    return id;
  },
});
```

## What goes in modules

- Email sending (Resend, Nodemailer)
- Payment processing (Stripe SDK calls)
- Third-party API clients (OpenAI, Twilio)
- Shared validation logic
- Business rule helpers