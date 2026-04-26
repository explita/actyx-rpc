import z from "zod";
import { createProcedure } from "../src/core/server.js";
import { zodResolver } from "../src/resolver/zod/index.js";
import { RedisCache } from "../src/index.js";
import Redis from "ioredis";
import { Compressor } from "../src/core/compression/compressor.js";

const proc = createProcedure({
  // inputMode: "form",
  createContext: () => {
    return {
      ok: true,
      ctx: {
        id: "me",
      },
    };
  },
  enrichInput(ctx) {
    return { userId: ctx.id };
  },
  cache: new RedisCache(new Redis({}), { defaultTTL: "10m" }), // 10 minutes
  onContextError: async (reason) => {
    // return {
    //   message: "",
    // //   reason,
    // //   statusCode: 400,
    //   success: false,
    //   hello: "world",
    // };
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
});

const p2 = proc.extend({
  createContext(ctx) {
    return {
      ok: true,
      ctx: {
        id: "me",
        // role: "admin",
        // user: {
        //   name: "John Doe",
        //   email: "[EMAIL_ADDRESS]",
        // },
      },
    };
  },
  enrichInput({ ctx, previous }) {
    return { ...previous, ...ctx };
  },
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

const md = proc.middleware<{ id: string }>(async ({ ctx, input, next }) => {
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
      }),
    ),
    // { mode: "patch" }
  )
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
      console.log("after", ctx, result);
    },
    onBefore({ ctx, input, next }) {
      console.log("before", ctx, input);
      return next({ emi: "yes" });
    },
  })
  .use(({ next, ctx }) => {
    console.log("use ctx", ctx);
    return next({ yes: { next2: 2 } });
  })
  .compress({
    compressResponse: true,
    threshold: 64,
  })
  .cache({
    ttl: "1000m",
    decompress: true,
    key(ctx) {
      console.log("cachekey", ctx);
      return "";
    },
  })
  .retry({
    attempts: 3,
    initialDelay: 1000,
    if(error) {
      return error.statusCode === 400;
    },
    onFailed(error, attempts) {
      console.log({ error, attempts });
    },
    onRetry(error, attempt, delay) {
      console.log({ error, attempt, delay });
    },
  })
  .timeout({
    ms: 10,
    message: "Request timeout after 1000ms",
    reason: "TIMEOUT",
    onTimeout(timeoutMs) {
      console.log("Request timeout after", timeoutMs, "ms");
    },
  })
  .rateLimit({
    limit: 1000,
    window: "1d",
    key(ctx) {
      return `${ctx.id}`;
    },
  })
  .circuitBreaker()
  .query(async ({ ctx, input }, id: string, name: string) => {
    // console.log("db calls", ctx, input, id, name);
    return {
      //   success: false,
      message: "testing",
      ctx,
      //   data: ctx,
      //   data1: ctx,
      //   data2: ctx,
      //   data3: ctx,
      //   data4: ctx,
    };
  });

const postData = p3
  .name("postData")
  .meta({ globalNamesss: "Hello", next: { next2: 2 } })
  .input(zodResolver(z.object({ name: z.string().min(2) })))
  .use(({ next, ctx }) => next({ yes: { next2: 2 } }))
  .use(({ next, ctx }) => next({ next: "yes", yes2: { next2: 2, yes3: 3 } }))
  .invalidate({ keys: ["getData"] })
  .mutation(({ ctx, input }, opts: { u: string; uu: string; uuu: number }) => {
    console.log("ctx", ctx);
    // console.log(u, uu, uuu);

    return {
      success: false,
      // hello: "world",
      // reason: "TEST",
      // message: "nothing",
    };
  });

getData({ name: "john", id: "" }).then(([res, err]) => console.log(res, err));
