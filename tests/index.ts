import z from "zod";
import { createProcedure } from "../src/core/server.js";
import { zodResolver } from "../src/resolvers/zod/index.js";
import { RedisCache } from "../src/index.js";
import Redis from "ioredis";
import { Compressor } from "../src/core/compression/compressor.js";
import { arktypeResolver } from "../src/resolvers/arktype/index.js";
import { valibotResolver } from "../src/resolvers/valibot/index.js";
import { yupResolver } from "../src/resolvers/yup/index.js";
import { joiResolver } from "../src/resolvers/joi/index.js";
import * as v from "valibot";
import * as yup from "yup";
import Joi from "joi";
import { type } from "arktype";

const proc = createProcedure({
  inputMode: "form",
  createContext: () => {
    return {
      ok: true,
      ctx: {
        id: "me",
      },
    };
  },
  // enrichInput(ctx) {
  //   return { userId: ctx.id };
  // },
  cache: new RedisCache(new Redis({}), { defaultTTL: "10m" }), // 10 minutes
  onContextError: async (reason) => {
    return {
      _redirect: () => {},
    };
  },
  compression: new Compressor({ level: 6 }),
  onError(params) {
    return {
      message: "testingggg",
      ...params.error,
    };
  },
  onSuccess(params) {},
  meta: {
    globalName: "value",
  },
  middlewares: [({ next }) => next({ fromRoot: "yes" })],
  plugins: [
    {
      onBefore({ next, ctx, input }) {
        return next({ fromRootPlugin: "yes" });
      },
      onError(error) {
        console.log("error", error);
      },
    },
  ],
});

const p2 = proc.extend({
  createContext(ctx) {
    return {
      ok: true,
      ctx: {
        id: "me",
      },
    };
  },
  // enrichInput({ ctx, previous }) {
  //   return { ...previous, ...ctx };
  // },
  meta: {
    anotherGlobal: "value",
    a: "",
  },
});

const p3 = p2.extend({
  createContext(ctx) {
    return {
      ok: true,
      ctx: { ...ctx, lg: 1 },
    };
  },
  enrichInput({ ctx, previous }) {
    return { ...previous, st: 3 };
  },
});

const p4 = p3.extend({
  createContext(ctx) {
    return {
      ok: true,
      ctx,
    };
  },
  enrichInput({ ctx, previous }) {
    return { ...previous };
  },
});

const md = proc.middleware<{ id: string }>()(async ({ ctx, input, next }) => {
  return next({ aa: "" });
});

const getData = proc
  .name("getData")
  .meta({ ahahahah: "none" })
  .input(
    zodResolver(
      z.object({
        name: z.string().min(2, { error: "required" }),
        id: z.string(),
        contact: z.array(z.object({ name: z.string(), email: z.string() })),
        hobbies: z.array(z.string()),
        settings: z.object({
          showLogo: z.boolean(),
        }),
      }),
    ),
    { mode: "strict" },
  )
  // .authorize(async (ctx) => {
  //   return {
  //     success: false,
  //     message: "unauthorized",
  //     reason: "UNAUTHORIZED",
  //     ok: true,
  //   };
  // })
  .use(md)
  // .use(async ({ next, input, ctx }) => {
  //   return {
  //     success: false,
  //     _message: "middleware check",
  //   };
  // })
  .use({
    onError(params) {},
    onAfter(ctx, result) {
      // console.log("after", ctx, result);
    },
    onBefore({ ctx, input, next }) {
      // console.log("before", ctx, input);
      return next({ emi: "yes" });
    },
  })
  .use(({ next, ctx }) => {
    // console.log("use ctx", ctx);
    return next({ yes: { next2: 2 } });
  })
  .compress({
    compressResponse: true,
    threshold: 64,
  })
  // .cache({
  //   ttl: "1000m",
  //   decompress: true,
  //   // key(ctx) {
  //   //   console.log("cachekey", ctx);
  //   //   return "";
  //   // },
  // })
  .retry({
    attempts: 3,
    initialDelay: 1000,
    if(error) {
      return error.statusCode === 400;
    },
    onFailed(error, attempts) {
      // console.log({ error, attempts });
    },
    onRetry(error, attempt, delay) {
      // console.log({ error, attempt, delay });
    },
  })
  .timeout({
    ms: 10,
    message: "Request timeout after 1000ms",
    reason: "TIMEOUT",
    onTimeout(timeoutMs) {
      // console.log("Request timeout after", timeoutMs, "ms");
    },
  })
  .rateLimit({
    limit: 1000,
    window: "1d",
    key({ ctx }) {
      return `${ctx.id}`;
    },
  })
  // .circuitBreaker()
  // .mock(async (ctx) => {
  //   return {
  //     id: "asas",
  //     name: "",
  //   };
  // })
  .output(
    zodResolver(
      z.object({
        id: z.coerce.string(),
        name: z.string(),
        date: z.string(),
      }),
    ),
  )
  .query(async ({ ctx, input }, id: string, name: string) => {
    return {
      id: 1,
      name: "1",
      date: new Date().toISOString(),
    };
  });

const postData = proc
  .name("postData")
  .meta({ globalNamesss: "Hello", next: { next2: 2 } })
  .input(zodResolver(z.object({ name: z.string().min(2) })))
  .use(({ next, ctx }) => next({ yes: { next2: 2 } }))
  .use(({ next, ctx }) => next({ next: "yes", yes2: { next2: 2, yes3: 3 } }))
  .invalidate({ keys: ["getData"] })
  .mutation(({ ctx, input }, opts: { u: string; uu: string; uuu: number }) => {
    return {
      success: false,
    };
  });

const streamData = proc
  .name("streamData")
  .summary("Stream sample data")
  .description(
    "Yields a series of chunks with timestamps for testing purposes.",
  )
  .input(zodResolver(z.object({ count: z.number() })))
  .stream(async function* ({ input }) {
    for (let i = 0; i < input.count; i++) {
      yield { index: i, time: new Date().toISOString() };
      await new Promise((r) => setTimeout(r, 100));
    }
  });

const arkSchema = type({ name: "string", age: "number" });
const arktypeData = proc
  .name("arktypeData")
  .input(arktypeResolver(arkSchema))
  .query(async ({ input }) => ({ success: true, input }));

const valibotData = proc
  .name("valibotData")
  .input(valibotResolver(v.object({ title: v.string(), active: v.boolean() })))
  .query(async ({ input }) => ({ success: true, input }));

const yupData = proc
  .name("yupData")
  .input(
    yupResolver(
      yup.object({
        email: yup.string().email().required(),
        code: yup.number(),
      }),
    ),
  )
  .query(async ({ input }) => ({ success: true, input }));

const joiData = proc
  .name("joiData")
  .input(
    joiResolver(
      Joi.object({
        username: Joi.string().required(),
        points: Joi.number().integer(),
      }),
    ),
  )
  .query(async ({ input }) => ({ success: true, input }));

// --- Primitive enforcement checks (all should produce TS errors) ---
// @ts-expect-error — zod: only ZodObject<ZodRawShape> allowed
zodResolver(z.string());
// @ts-expect-error — yup: only ObjectSchema allowed
yupResolver(yup.string());
// @ts-expect-error — joi: only ObjectSchema allowed
joiResolver(Joi.string());
// @ts-expect-error — valibot: only ObjectSchema allowed
valibotResolver(v.string());
// @ts-expect-error — arktype: only Type<Record<string, unknown>, any> allowed
arktypeResolver(type("string.email"));

(async () => {
  console.log("--- Starting Stream Test ---");
  for await (const chunk of streamData({ count: 5 })) {
    console.log("Stream Chunk:", chunk);
  }
  console.log("--- Stream Test Finished ---");

  console.log("--- Testing Output Validation ---");
  // We'll call getData. Since we are in mock mode (likely), we should check the result.
  // Actually, let's call it manually.
  const [res, err] = await getData(
    {
      name: "john",
      id: "1",
      contact: [{ name: "", email: "" }],
      hobbies: ["a"],
      settings: { showLogo: true },
    },
    "1",
    "name",
  );
  console.log("GetData Result:", res, "Error:", err);

  const { generateOpenApi } = await import("../src/core/docs/generator.js");
  const docs = generateOpenApi(
    {
      "get-data": getData,
      "post-data": postData,
      "stream-data": streamData,
      "arktype-data": {
        procedure: arktypeData,
        method: "put",
        tags: ["Experimental"],
      },
      "valibot-data": valibotData,
      "yup-data": yupData,
      "joi-data": {
        procedure: joiData,
        method: "patch",
        summary: "Updated Joi Summary",
      },
    },
    {
      title: "Test API",
      version: "1.0.0",
      tags: ["API"],
      baseUrl: "http://localhost:3000/api",
      output: "./openapi.json",
      security: {
        apiKey: {
          type: "apiKey",
          in: "header",
          name: "X-API-KEY",
        },
      },
    },
  );
})();
