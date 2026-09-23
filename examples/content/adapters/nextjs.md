---
sidebar_position: 1
title: Next.js Integration
---

# Next.js Integration

Actyx RPC provides adapters designed to bridge the gap between Next.js request metadata (Server Actions / Route Handlers) and your procedure contexts.

---

## `nextAdapter()`

Use `nextAdapter()` within your context generator to automatically extract request properties (like client IPs, hosts, referrers, and user agents):

```ts
import { createProcedure } from "@explita/actyx-rpc";
import { nextAdapter } from "@explita/actyx-rpc/adapters/next";

const procedure = createProcedure({
  async createContext() {
    const { ip, host, pathname, userAgent, browser, platform, cookies } =
      await nextAdapter();

    return {
      ok: true,
      ctx: {
        ip,
        host,
        pathname,
        userAgent,
        browser,
        platform,
      },
    };
  },
});
```

### Returned Context Fields

| Field          | Source Header(s)               | Description                                    |
| :------------- | :----------------------------- | :--------------------------------------------- |
| `ip`           | `x-forwarded-for`              | Client IP address.                             |
| `host`         | `x-forwarded-host` → `host`    | Requested hostname.                            |
| `origin`       | `origin` → `proto://host`      | Request origin URL.                            |
| `referer`      | `referer`                      | Referrer URL.                                  |
| `pathname`     | `x-pathname` (middleware)      | Pathname (requires middleware setup).          |
| `searchParams` | `x-search-params` (middleware) | Query parameters object (requires middleware). |
| `proto`        | `x-forwarded-proto`            | Connection protocol (`http` or `https`).       |
| `userAgent`    | `user-agent`                   | Full browser user agent string.                |
| `browser`      | `sec-ch-ua`                    | Parsed browser name and major version.         |
| `platform`     | `sec-ch-ua-platform`           | User operating system platform.                |
| `locale`       | `accept-language`              | Client preferred locale string (e.g. `en-US`). |
| `headers`      | —                              | Readonly headers object.                       |
| `cookies`      | —                              | Readonly request cookies.                      |

---

## Middleware Setup

Because Next.js Server Actions do not run in standard middleware contexts, request properties like `pathname` and `searchParams` are not directly visible to actions.

To make these fields available to `nextAdapter()`, add a proxy middleware (`middleware.ts` or `proxy.ts`) to inject proxy headers:

```ts
// middleware.ts or proxy.ts
import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const url = request.nextUrl;

  const responseHeaders = {
    headers: {
      "x-pathname": url.pathname,
      "x-search-params": JSON.stringify(Object.fromEntries(url.searchParams)),
    },
  };

  return NextResponse.next(responseHeaders);
}
```

---

## Route Handler Adapter (`createHandler`)

`createHandler` mounts your Actyx RPC router as a Next.js App Router API route handler. It automatically routes incoming HTTP requests to your procedures, parses bodies (JSON and multipart file uploads), and manages request context.

### 1. Defining the Router (`backend/router.ts`)

Assemble your procedures using `createRouter` and export `appRouter` (along with its type `AppRouter`):

```ts
// backend/router.ts
import { createRouter } from "@explita/actyx-rpc";
import { getTodos, addTodo, uploadFile } from "./procedures";

export const appRouter = createRouter({
  todos: createRouter({
    list: getTodos,
    add: addTodo,
  }),
  upload: uploadFile,
});

export type AppRouter = typeof appRouter;
```

### 2. Mounting the Route Handler

Create a catch-all route at `app/api/rpc/[...rpc]/route.ts`:

```ts
// app/api/rpc/[...rpc]/route.ts
import { createHandler } from "@explita/actyx-rpc/adapters/next";
import { appRouter } from "@/backend/router";

// Export standard Next.js route handlers
export const {
  GET,
  POST,
  PUT,
  PATCH,
  DELETE,
  HEAD,
  OPTIONS,
} = createHandler(appRouter);
```

### Procedure Routing Strategies

`createHandler` supports both path-based and query-based procedure resolution:

1. **Path Routing (Default)**:
   - Request to `/api/rpc/todos.list` calls `appRouter.todos.list`.
   - Nested dynamic segments like `/api/rpc/todos/list` also map cleanly to `todos.list`.
2. **Query Routing**:
   - Request to `/api/rpc?procedure=todos.list` resolves to `appRouter.todos.list`.

### Multipart & File Upload Support

When requests are sent as `multipart/form-data`:
- **Bare Files**: Automatically unpacked into `File` instances when tagged with `__direct_file__`.
- **Objects and Arrays**: Bracket notation like `files[0]` or `user[avatar]` is recursively converted into structured objects and real arrays.
- **Request Stream Cloning**: `createHandler` clones the incoming request (`req.clone()`) before parsing the body. Downstream procedures or context functions can safely read `req.text()`, `req.json()`, or `req.formData()` without encountering `"TypeError: Body has already been consumed"`.

### HTTP OPTIONS Preflight Handling

`createHandler` includes built-in, fast-path handling for HTTP `OPTIONS` requests:
- Automatically responds with `204 No Content` and the `Allow: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS` header.
- Responds immediately without executing downstream procedures, preventing preflights from triggering mutations.
- Allows root preflight checks (e.g. `OPTIONS /api/rpc`) to pass cleanly without failing route resolution.

### Real-Time Streaming & SSE Support

Procedures configured with `.sse()` or `.stream()` are automatically detected and streamed by `createHandler`:
- Generates standard `text/event-stream` responses with automatic chunk framing.
- Flushes data chunks or event payloads to the client in real-time.

### Accessing the Request in Procedures

You can access the ambient `Request` object in procedure context:

```ts
import { createProcedure } from "@explita/actyx-rpc";

export const procedure = createProcedure({
  createContext: async (baseCtx, req) => {
    return {
      ok: true,
      ctx: {
        token: req?.headers.get("authorization"),
      },
    };
  },
});
```

---

> [!NOTE]
> `next` is a peer dependency of `@explita/actyx-rpc` and is expected to be installed in your Next.js application environment.

