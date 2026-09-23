import { describe, it, expect } from "vitest";
import { createProcedure } from "../../packages/server/src/index.js";
import { zodResolver } from "../../packages/server/src/resolvers/zod/index.js";
import { z } from "zod";
import * as v from "valibot";
import { type } from "arktype";

describe("Native @standard-schema Support in Procedures", () => {
  const procedure = createProcedure();

  it("should validate input directly using Zod schema without zodResolver", async () => {
    const postTodo = procedure
      .input(
        z.object({
          title: z.string().min(3, "Title must be at least 3 characters"),
          priority: z.number().default(1),
        }),
      )
      .mutation(async ({ input }) => {
        return {
          id: "todo_1",
          title: input.title,
          priority: input.priority,
        };
      });

    // Valid call
    const [data, err] = await postTodo({ title: "Write tests" });
    expect(err).toBeNull();
    expect(data).toEqual({
      id: "todo_1",
      title: "Write tests",
      priority: 1,
    });

    // Invalid call (too short title)
    const [failData, failErr] = await postTodo({ title: "Hi" });
    expect(failData).toBeNull();
    expect(failErr).toBeDefined();
    expect(failErr?.reason).toBe("VALIDATION_ERROR");
    expect(failErr?.errors?.title).toBe("Title must be at least 3 characters");
  });

  it("should validate input directly using Valibot schema without resolver", async () => {
    const registerUser = procedure
      .input(
        v.object({
          email: v.pipe(v.string(), v.email("Invalid email address")),
          age: v.pipe(v.number(), v.minValue(18, "Must be at least 18")),
        }),
      )
      .mutation(async ({ input }) => {
        return { success: true, email: input.email };
      });

    // Valid call
    const [data, err] = await registerUser({
      email: "hello@example.com",
      age: 25,
    });
    expect(err).toBeNull();
    expect(data).toEqual({ success: true, email: "hello@example.com" });

    // Invalid call
    const [failData, failErr] = await registerUser({
      email: "not-an-email",
      age: 16,
    });
    expect(failData).toBeNull();
    expect(failErr?.reason).toBe("VALIDATION_ERROR");
    expect(failErr?.errors?.email).toBe("Invalid email address");
    expect(failErr?.errors?.age).toBe("Must be at least 18");
  });

  it("should validate input directly using ArkType schema without resolver", async () => {
    const updateUser = procedure
      .input(
        type({
          id: "number",
          "nickname?": "string",
        }),
      )
      .mutation(async ({ input }) => {
        return { id: input.id, nickname: input.nickname || "anonymous" };
      });

    // Valid call
    const [data, err] = await updateUser({ id: 42, nickname: "dev" });
    expect(err).toBeNull();
    expect(data).toEqual({ id: 42, nickname: "dev" });

    // Invalid call
    const [failData, failErr] = await updateUser({ id: "invalid" as any });
    expect(failData).toBeNull();
    expect(failErr?.reason).toBe("VALIDATION_ERROR");
    expect(failErr?.errors?.id).toBeDefined();
  });

  it("should validate output directly using a Standard Schema", async () => {
    const fetchStats = procedure
      .output(
        z.object({
          views: z.number(),
          verified: z.boolean(),
        }),
      )
      .query(async () => {
        return {
          views: 100,
          verified: true,
        };
      });

    const [data, err] = await fetchStats();
    expect(err).toBeNull();
    expect(data).toEqual({ views: 100, verified: true });
  });

  it("should continue to support classic zodResolver for backward compatibility", async () => {
    const legacyProc = procedure
      .input(
        zodResolver(
          z.object({
            slug: z.string(),
          }),
        ),
      )
      .query(async ({ input }) => {
        return { slug: input.slug };
      });

    const [data, err] = await legacyProc({ slug: "actyx-rpc" });
    expect(err).toBeNull();
    expect(data).toEqual({ slug: "actyx-rpc" });

    const [failData, failErr] = await legacyProc({ slug: 123 as any });
    expect(failData).toBeNull();
    expect(failErr?.reason).toBe("VALIDATION_ERROR");
  });
});
