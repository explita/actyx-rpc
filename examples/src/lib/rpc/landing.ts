"use server";

import { procedure } from "./init";
import { z } from "zod";
import { zodResolver } from "@/dist/resolvers/zod";

export const ping = procedure.query(async () => {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return {
    message: "Server is reachable!",
    serverTime: new Date().toISOString(),
  };
});

export const greet = procedure
  .input(zodResolver(z.object({ name: z.string().min(1).max(50) })))
  .query(async ({ input }) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return {
      greeting: `Hello, ${input.name}!`,
      serverTime: new Date().toISOString(),
    };
  });
