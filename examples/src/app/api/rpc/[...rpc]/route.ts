import { createHandler } from "@/dist/adapters/next";
import { appRouter } from "@/lib/rpc/router";

export const { GET, POST } = createHandler(appRouter);
