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

> [!NOTE]
> `next` is a peer dependency of `@explita/actyx-rpc` and is expected to be installed in your Next.js application environment.
