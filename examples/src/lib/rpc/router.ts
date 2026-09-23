import { createRouter, InferOutput } from "@/dist";
import { procedure } from "./init";
import { zodResolver } from "@/dist/resolvers/zod";
import { z } from "zod";

export type RouterTodo = {
  id: string;
  text: string;
  completed: boolean;
};

// In-memory store for the tRPC-style router demo
const routerTodos: RouterTodo[] = [
  { id: "1", text: "Test tRPC-style catch-all routing", completed: true },
  { id: "2", text: "Verify client proxy hook integration", completed: true },
  {
    id: "3",
    text: "Create Next.js route handler at /api/rpc/[...rpc]",
    completed: false,
  },
];

export const appRouter = createRouter({
  web: procedure.webRoute(async () => {
    return { success: true };
  }),
  notif: createRouter({
    sse: procedure.sse(async function* () {
      for (let i = 0; i < 10; i++) {
        yield { data: i };
        await new Promise((res) => setTimeout(res, 1000));
      }
    }),
    stream: procedure.stream(async function* () {
      for (let i = 0; i < 10; i++) {
        yield { value: i };
        await new Promise((res) => setTimeout(res, 1000));
      }
    }),
  }),
  todos: createRouter({
    list: procedure
      // .input(zodResolver(z.object({ data: z.string() })))
      .query(async (_) => {
        return { data: [...routerTodos], hasMore: true };
      }),
    add: procedure
      .input(
        zodResolver(z.object({ text: z.string().min(1, "Text is required") })),
      )
      .mutation(async ({ input }) => {
        // await new Promise((res) => setTimeout(res, 1000));
        const newTodo: RouterTodo = {
          id: Date.now().toString(),
          text: input.text,
          completed: false,
        };
        routerTodos.push(newTodo);
        return newTodo;
      }),
    toggle: procedure
      .input(zodResolver(z.object({ id: z.string() })))
      .mutation(async ({ input }) => {
        const target = routerTodos.find((t) => t.id === input.id);
        if (target) {
          target.completed = !target.completed;
        }
        return target ?? null;
      }),
  }),
  health: procedure.query(async () => {
    return {
      status: "ok",
      uptime: process.uptime ? Math.floor(process.uptime()) : 0,
      timestamp: new Date().toISOString(),
    };
  }),
});

export type AppRouter = typeof appRouter;
