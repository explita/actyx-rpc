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

export const chatProc = procedure.ws(
  ({ ctx, send, broadcast, onMessage, onClose }) => {
    // Welcome just this client
    send({ type: "subscribed", data: { message: "🟢 You joined the chat!" } });

    // Notify others that someone joined
    broadcast({ type: "event", data: { message: "👋 A new user joined!" } });

    onMessage((data: any) => {
      if (data && data.type === "typing") {
        // Typing indicator — broadcast to other clients only
        broadcast({ type: "typing" });
      } else {
        // Regular message — broadcast to others + send back to sender
        broadcast({ type: "event", data });
        send({ type: "event", data });
      }
    });

    onClose(() => {
      broadcast({
        type: "event",
        data: { message: "🚪 A user left the chat." },
      });
    });
  },
);

export const onRoomEvent = procedure
  .input(zodResolver(z.object({ roomId: z.string() })))
  .ws(async ({ ctx, input, send, onClose }) => {
    // Send subscription confirmation handshake to client
    send({ type: "subscribed", data: { message: `🟢 Subscribed to room:${input.roomId}` } });

    // Subscribe to a topic using the built-in pubsub context
    const unsubscribe = ctx.pubsub.subscribe<string>(
      `room:${input.roomId}`,
      (message) => {
        send({ message }); // Push event data payload to the client
      }
    );

    // Clean up on close (handles both sync and async unsubscribe)
    onClose(async () => {
      const unsub = await unsubscribe;
      unsub();
    });
  });

export const sendRoomMessage = procedure
  .input(
    zodResolver(
      z.object({
        roomId: z.string(),
        message: z.string().min(1),
      })
    )
  )
  .mutation(async ({ ctx, input }) => {
    await ctx.pubsub.publish(`room:${input.roomId}`, input.message);
    return { success: true };
  });
