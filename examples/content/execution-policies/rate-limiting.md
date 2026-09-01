---
sidebar_position: 3
title: Rate Limiting
---

# Rate Limiting

Protect your procedures from abuse by limiting the number of calls from a specific user, IP, or key.

The rate limiting policy uses the cache adapter configured in `createProcedure` to store and check request logs.

> [!NOTE]
> **Production Scaling**: While rate limiting works out-of-the-box using the default in-memory cache, it is highly recommended to configure a [Redis Cache Adapter](./caching#redis-cache-adapter) in multi-server or load-balanced production environments to ensure rate limit states are synchronized globally.

```ts
const sendMessage = procedure
  .input(
    zodResolver(
      z.object({ recipientId: z.string(), message: z.string() }),
    ),
  )
  .rateLimit({
    limit: 10,
    window: "1m",
    key: ({ ctx, input }) => `${ctx.userId}:${input.recipientId}`,
  })
  .mutation(async ({ input }) => {
    // ...
  });
```

## Rate Limiting Options

| Option          | Type                                                                       | Default | Description                                                    |
| :-------------- | :------------------------------------------------------------------------- | :------ | :------------------------------------------------------------- |
| `limit`         | `number`                                                                   | `100`   | Number of requests allowed per window.                         |
| `window`        | `WindowTime`                                                               | `"1m"`  | Time window (e.g. `"1m"`, `"5m"`, `"1h"`, `"1d"`).             |
| `key`           | `(opts: { ctx, input }, req: Request, context: any) => MaybePromise<string>` | —       | Custom key generator function (receives both `ctx` and `input`). Can be async. Defaults to user identity / IP. |
| `message`       | `string`                                                                   | —       | Custom error message to return when rate-limited.              |
| `onRateLimited` | `(key, limit, windowMs) => void`                                           | —       | Callback triggered when a rate limit is exceeded.              |

## Default Key Strategy

If no custom `key` generator function is defined, Actyx RPC automatically resolves the rate limit identity using the first available property in this order:

1. `ctx.id`
2. `ctx.userId`
3. `ctx.ip`
4. `"anonymous"` (failsafe)
