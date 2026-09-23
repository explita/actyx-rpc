import { createProcedure, MemoryCache } from "@/dist";
import { redirect } from "next/navigation";
import { nextAdapter, type NextAdapter } from "@/dist/adapters/next";

export const procedure = createProcedure({
  createContext: async (_, req, c) => {
    const next = await nextAdapter();

    return {
      ok: true,
      ctx: {
        ctxKey: "ctxValue",
        next,
      },
    };
  },
  onContextError({ reason }) {
    // redirect("/login"); // this wont work
    return {
      message: "You are not authorized",
      reason,
      _redirect() {
        redirect("/login");
      },
      statusCode: 401,
    };
  },
  async enrichInput(ctx, req, c: NextAdapter) {
    return {
      key1: "value1",
      key2: "value2",
      ctxKey: ctx.ctxKey,
    };
  },
  cache: new MemoryCache({ maxSize: 100, defaultTTL: 60000 }),
});

export const procedure2 = procedure.extend({
  createContext: (prevCtx, req, context) => {
    console.log("createContext 2", prevCtx, req, context);
    return { ok: true, ctx: { ...prevCtx, ctxKey2: "ctxValue2" } };
  },
  enrichInput: (ctx, req, context) => {
    console.log("enrichInput 2", ctx, req, context);
    return { ...ctx, key3: "key3Value" };
  },
  onContextError(ctx, req, context) {
    console.log("onContextError 2", ctx, req, context);
    return { ...ctx, message: "ctxError 2" };
  },
});
