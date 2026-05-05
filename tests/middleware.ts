import { createProcedure } from "../src";

const procedure = createProcedure({
  createContext: () => {
    return {
      ok: true,
      ctx: {},
    };
  },
});

const verifyMw = procedure.middleware(({ next }) => {
  return next({ a: 1 });
});

const testData = procedure.use(verifyMw).query(async ({ ctx }) => {
  return ctx.a;
});
