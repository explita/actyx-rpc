import { describe, it, expect, vi } from "vitest";
import { createProcedure } from "../src/core/server.js";
import { MemoryPubSub } from "../src/lib/pubsub.js";

describe("Core: PubSub", () => {
  it("should allow publishing and subscribing to events in memory", async () => {
    const pubsub = new MemoryPubSub();
    const spy = vi.fn();

    pubsub.subscribe("test-topic", spy);
    await pubsub.publish("test-topic", { hello: "world" });

    expect(spy).toHaveBeenCalledWith({ hello: "world" });
  });

  it("should inject pubsub into procedure context", async () => {
    const procedure = createProcedure({
      createContext: () => ({ ok: true, ctx: {} }),
    });

    const spy = vi.fn();

    const subProc = procedure.query(async ({ ctx }) => {
      ctx.pubsub.subscribe("my-event", spy);
      return "subscribed";
    });

    const pubProc = procedure.query(async ({ ctx }) => {
      await ctx.pubsub.publish("my-event", "payload");
      return "published";
    });

    await subProc();
    await pubProc();

    expect(spy).toHaveBeenCalledWith("payload");
  });

  it("should unsubscribe correctly", async () => {
    const pubsub = new MemoryPubSub();
    const spy = vi.fn();

    const unsubscribe = pubsub.subscribe("topic", spy);
    unsubscribe();

    await pubsub.publish("topic", "data");
    expect(spy).not.toHaveBeenCalled();
  });
});
