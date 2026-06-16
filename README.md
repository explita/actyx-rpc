# Actyx RPC

**Type-safe RPC for composable server actions in TypeScript.**

Actyx RPC lets you build server-side procedures with full type safety, minimal boilerplate, and a clean, composable API. It bridges client-side queries and server-side execution seamlessly.

[![NPM Version](https://img.shields.io/npm/v/@explita/actyx-rpc?style=flat-square&color=blue)](https://www.npmjs.com/package/@explita/actyx-rpc)
[![License](https://img.shields.io/npm/l/@explita/actyx-rpc?style=flat-square&color=lightgray)](https://github.com/explita/actyx-rpc/blob/main/LICENSE)
[![Documentation](https://img.shields.io/badge/docs-actyx.explita.ng-blueviolet?style=flat-square)](https://actyx.explita.ng)

---

## 📖 Complete Documentation

Visit our documentation portal for the complete guide, API references, execution policies, and integration adapters:

👉 **[actyx.explita.ng](https://actyx.explita.ng)**

---

## Installation

```bash
npm install @explita/actyx-rpc
```

Install your schema validation library of choice (such as Zod, Valibot, ArkType, Joi, or Yup) as a peer dependency.

---

## Quick Start

Define a reusable procedure builder with context injection (e.g. database, authentication context):

```ts
// server/procedures.ts
import { createProcedure } from "@explita/actyx-rpc";
import { z } from "zod";
import { zodResolver } from "@explita/actyx-rpc/resolvers/zod";

const procedure = createProcedure({
  async createContext() {
    return {
      ok: true,
      ctx: { userId: "user_123" }
    };
  }
});

// Build a validated query procedure
export const getUserProfile = procedure
  .input(zodResolver(z.object({ id: z.string() })))
  .query(async ({ ctx, input }) => {
    return {
      id: input.id,
      userId: ctx.userId,
      name: "Ade Explita"
    };
  });
```

Execute the procedure on the client (or in Server Actions) returning a safe `[data, error]` tuple:

```ts
import { getUserProfile } from "./server/procedures";

const [profile, error] = await getUserProfile({ id: "user_456" });

if (error) {
  console.error("Failed to load profile:", error.message);
} else {
  console.log("Loaded profile:", profile.name);
}
```

---

## 💖 Support the Mission

Actyx RPC is built to simplify building type-safe, distributed systems with minimal boilerplate. If it has helped you build better APIs faster, please consider supporting the project to ensure its continued growth and maintenance!

<p align="left">
  <a href="https://github.com/sponsors/explita">
    <img src="https://img.shields.io/badge/Sponsor_on_GitHub-EA4AAA?style=for-the-badge&logo=github-sponsors&logoColor=white" />
  </a>
  <a href="https://ko-fi.com/explita">
    <img src="https://img.shields.io/badge/Buy_Me_A_Coffee-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white" />
  </a>
</p>

### 🚀 Ways to Contribute

- **Give us a ⭐**: It helps others discover the project.
- **Join the Discussion**: Report [bugs](https://github.com/explita/actyx-rpc/issues) or suggest new [features](https://github.com/explita/actyx-rpc/discussions).
- **Spread the Word**: Share your experience with Actyx RPC on social media.

### 🙏 Our Amazing Supporters

_A huge thank you to everyone helping us build the future of type-safe server actions!_

[![Contributors](https://contrib.rocks/image?repo=explita/actyx-rpc)](https://github.com/explita/actyx-rpc/graphs/contributors)

#

## License

MIT © [Explita](https://github.com/explita)
