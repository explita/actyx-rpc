---
sidebar_position: 5
title: OpenAPI Spec Generation
---

# OpenAPI Spec Generation

Actyx RPC is self-documenting. By attaching metadata to procedures, you can generate complete OpenAPI 3.0 (Swagger) specifications automatically.

---

## Documenting Procedures

Use `.summary()`, `.description()`, and `.output()` to document schemas and descriptions:

```ts
const createUser = procedure
  .name("createUser")
  .summary("Create a new system user")
  .description("Registers a new user. Sends a welcome email. Requires admin privileges.")
  .input(zodResolver(userSchema))
  .output(zodResolver(userResponseSchema))
  .mutation(async ({ input }) => { ... });
```

* **`.summary(text)`**: A concise, single-line explanation of the procedure.
* **`.description(text)`**: A detailed, multi-line explanation of behavior, side effects, and rules.
* **`.output(resolver)`**: Explicit contract definition used to generate the output schema.

---

## `generateOpenApi()`

Compile your router or procedures directly into a valid OpenAPI 3.1 specification:

```ts
import { generateOpenApi } from "@explita/actyx-rpc";
import { appRouter } from "./router";

const openapi = generateOpenApi(appRouter, {
  title: "My System API",
  version: "1.0.0",
  baseUrl: "https://api.example.com",
  security: true,           // Enables Bearer Auth (JWT)
  output: "./openapi.json", // Optional: writes spec to disk
});
```

### Passing Procedures with Custom Overrides
You can also pass a custom dictionary with overrides for specific HTTP methods or Swagger tags:

```ts
const openapi = generateOpenApi(
  {
    // Nested router or procedures
    todos: appRouter.todos,

    // Overriding defaults
    "update-user": {
      procedure: updateUser,
      method: "put",           // Force PUT method instead of default POST
      tags: ["User Management"], // Set Swagger grouping tags
      summary: "Admin update", // Override default procedure summary
    },

    "delete-post": {
      procedure: deletePost,
      method: "delete",        // Map to standard DELETE request
      tags: ["Posts"],
    },
  },
  {
    title: "My System API",
    version: "1.0.0",
  }
);
```

---

## Serving OpenAPI Over HTTP (`createOpenApiHandler`)

Instead of writing `openapi.json` to disk, you can serve the live specification directly over HTTP for Swagger UI, Scalar, Redoc, or Postman using `createOpenApiHandler`:

```ts
// app/api/openapi.json/route.ts
import { createOpenApiHandler } from "@explita/actyx-rpc/adapters/next";
import { appRouter } from "@/backend/router";

export const GET = createOpenApiHandler(appRouter, {
  title: "Production API",
  version: "1.0.0",
  baseUrl: "https://api.example.com/api",
  security: true,
});
```

---

## Generation Capabilities

* **Nested Router Traversal**: Automatically flattens arbitrary levels of `createRouter` trees into standardized paths (e.g. `/todos/list`, `/todos/add`).
* **Native `@standard-schema` Extraction**: Extracts JSON Schema property definitions directly from Zod, ArkType, Valibot, and Yup schemas without requiring third-party tools.
* **Server-Sent Events (`text/event-stream`)**: Procedures defined with `.stream()` or `.sse()` automatically document `text/event-stream` response media types.
* **Smart Examples**: Generates realistic sample inputs and responses from field validations.
* **HTTP Method Alignment**: GET/DELETE procedures map input schemas to URL query parameters; POST/PUT/PATCH procedures map to request bodies.
* **JWT & API Key Schemes**: Supports `security: true` for bearer auth, or custom security definitions.
