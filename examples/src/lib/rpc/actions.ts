"use server";

import { procedure } from "./init";
import { zodResolver } from "@/dist/resolvers/zod";
import { z } from "zod";

export type Todo = {
  id: string;
  text: string;
  completed: boolean;
};

// Simulated database
let todos: Todo[] = [
  { id: "1", text: "Buy milk", completed: false },
  { id: "2", text: "Write code", completed: true },
];

export const getTodos = procedure.query(async () => {
  // Artificial delay to test Suspense
  await new Promise((resolve) => setTimeout(resolve, 1500));
  return todos;
});

export const addTodo = procedure
  .input(zodResolver(z.object({ text: z.string().min(1) })))
  .mutation(async ({ input }) => {
    // Artificial delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 50% failure rate for testing rollbacks
    if (Math.random() > 0.5) {
      throw new Error("Simulated random network failure for rollback testing!");
    }

    const newTodo: Todo = {
      id: Date.now().toString(),
      text: input.text,
      completed: false,
    };

    todos.push(newTodo);
    return newTodo;
  });
