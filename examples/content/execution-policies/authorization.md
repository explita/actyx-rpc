---
sidebar_position: 1
title: Authorization
---

# Authorization

Add fine-grained authorization checks to your procedures. Unlike standard middleware, the `.authorize()` policy is designed for simple, fast checks using your context.

```ts
const deletePost = procedure
  .authorize((ctx) => ctx.user.role === "admin")
  .mutation(async ({ input }) => {
    // Only runs if the user is an admin
  });
```

## Custom Failure Payloads

By default, if the check returns `false`, the procedure aborts and returns a standard `FORBIDDEN` error (403).

You can customize the returned error object directly by returning a validation payload:

```ts
const updateProject = procedure
  .authorize((ctx) => {
    if (ctx.user.isBanned) {
      return { 
        success: false, 
        message: "Your account has been restricted", 
        reason: "FORBIDDEN" 
      };
    }
    return true;
  })
  .mutation(async () => {
    // ...
  });
```
