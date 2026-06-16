---
sidebar_position: 2
title: Input Resolvers & Validation
---

# Input Resolvers & Validation

Actyx RPC leverages adapter resolvers to support popular schema validation libraries out-of-the-box, ensuring type safety both on client-side compilation and server-side execution.

---

## Supported Resolvers

### Zod
```ts
import { z } from "zod";
import { zodResolver } from "@explita/actyx-rpc/resolvers/zod";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

const action = procedure.input(zodResolver(schema)).mutation(({ input }) => { ... });
```

### Valibot
```ts
import * as v from "valibot";
import { valibotResolver } from "@explita/actyx-rpc/resolvers/valibot";

const schema = v.object({
  name: v.pipe(v.string(), v.minLength(1, "Name is required")),
  description: v.optional(v.string()),
});

const action = procedure.input(valibotResolver(schema)).mutation(({ input }) => { ... });
```

### ArkType
```ts
import { type } from "arktype";
import { arktypeResolver } from "@explita/actyx-rpc/resolvers/arktype";

const schema = type({
  name: "string > 1",
  description: "string?",
});

const action = procedure
  .input(arktypeResolver<typeof schema>(schema))
  .mutation(({ input }) => { ... });
```

### Joi
```ts
import Joi from "joi";
import { joiResolver } from "@explita/actyx-rpc/resolvers/joi";

const schema = Joi.object({
  name: Joi.string().min(1, "Name is required"),
  description: Joi.string().optional(),
});

const action = procedure
  .input(joiResolver<{ name: string; description?: string }>(schema))
  .mutation(({ input }) => { ... });
```

### Yup
```ts
import * as yup from "yup";
import { yupResolver } from "@explita/actyx-rpc/resolvers/yup";

const schema = yup.object({
  name: yup.string().min(1, "Name is required"),
  description: yup.string().optional(),
});

const action = procedure.input(yupResolver(schema)).mutation(({ input }) => { ... });
```

---

## Custom Resolver

You can build custom validation adapters by wrapping functions inside the `resolver` helper:

```ts
import { resolver } from "@explita/actyx-rpc/resolvers";

const customResolver = resolver<{ slug: string }>((data) => {
  if (typeof data.slug !== "string" || data.slug.length === 0) {
    return {
      success: false,
      errors: { slug: "Slug is required" },
    };
  }

  return {
    success: true,
    data: { slug: data.slug }, // returned shape is used for input type
  };
});
```

---

## Design Constraint: Why No Primitives?

By design, Actyx RPC **does not support primitive schemas** (such as `z.string()`, `z.number()`, or `z.boolean()`) at the root level of `.input()`.

### Reason: Global Enrichment
During procedure execution, Actyx RPC merges the validated schema inputs with global request context data (e.g. `userId`, `tenantId`) created by `enrichInput` settings:

```ts
// 1. Root builder injects tenant/user
const procedure = createProcedure({
  enrichInput: { tenant: "tenant-456" },
});

// 2. Resolver must construct an object structure
procedure
  .input(z.object({ email: z.string() }))
  .query(async ({ input }) => {
    input.email;  // ✅ schema property
    input.tenant; // ✅ automatically merged enrichment key
  });
```

If primitive schemas were allowed, the compiler would fail to merge context keys onto the primitive value structure:

```ts
// ❌ If primitive schemas were allowed, this would crash
procedure.input(z.string()).query(async ({ input }) => {
  // input would have to be typed as: string & { tenant: string }
  // Primitives in JS cannot hold properties!
});
```

Therefore, all input schemas passed to `.input()` must evaluate to an object shape.
