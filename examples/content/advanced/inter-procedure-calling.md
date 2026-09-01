---
sidebar_position: 3
title: Inter-Procedure Calling
---

# Inter-Procedure Calling

Procedures in Actyx RPC can invoke each other directly as standard functions. This design makes it easy to compose complex backend actions without incurring network round-trip overhead.

```ts
const getAuditLog = procedure
  .input(zodResolver(z.object({ userId: z.string() })))
  .query(async ({ input }) => {
    return await db.auditLog.findMany({ where: { userId: input.userId } });
  });

export const getUserDetails = procedure
  .input(zodResolver(z.object({ id: z.string() })))
  .query(async ({ input }) => {
    const user = await db.user.findUnique({ where: { id: input.id } });

    // 1. Call getAuditLog procedure directly as a function!
    const [logs, err] = await getAuditLog({ userId: input.id });

    if (err) throw err;

    return { ...user, logs };
  });
```

## How It Works: Context Bypass

Actyx RPC leverages `AsyncLocalStorage` to track the context of active queries and mutations.

1. **Context Sharing**: When a procedure calls another procedure, the target procedure automatically checks for an active context.
2. **Context Creation Bypass**: If a parent context exists, the child procedure skips its own `createContext()` execution, preventing duplicate database sessions or token checks.
3. **Execution Integrity**: Even with context bypass, the child's `.authorize()` and custom middlewares are still executed to preserve security.
4. **Zero Overhead**: Calls compile to direct function calls. There is no payload serialization/deserialization or network round-tripping.
