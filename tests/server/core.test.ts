import { describe, it, expect, vi } from "vitest";
import { createProcedure } from "../../packages/server/src/core/server.js";
import { zodResolver } from "../../packages/server/src/resolvers/zod/index.js";
import { z } from "zod";

describe("Core: Procedure Basics", () => {
  const procedure = createProcedure({
    inputMode: "strict",
    createContext: () => ({ ok: true, ctx: { userId: "user_1" } }),
    enrichInput: (ctx) => ({ user: ctx.userId }),
  });

  it("should enrich input using context", async () => {
    const proc = procedure.query(async ({ input }) => {
      //@ts-ignore
      return input.user;
    });

    const [result] = await proc();
    expect(result).toBe("user_1");
  });

  it("should handle onSuccess lifecycle hook", async () => {
    const successSpy = vi.fn();
    const proc = createProcedure({
      inputMode: "strict",
      createContext: () => ({ ok: true, ctx: {} }),
      onSuccess: successSpy,
    })
      .input(zodResolver(z.object({ name: z.string() })))
      .query(async ({ input }) => `Hello ${input.name}`);

    await proc({ name: "Alice" });

    expect(successSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        input: { name: "Alice" },
        output: "Hello Alice",
      }),
    );
  });
});

describe("Core: Input Modes", () => {
  const schema = z.object({ age: z.number() });
  const base = createProcedure({
    inputMode: "strict",
    createContext: () => ({ ok: true, ctx: {} }),
  });

  it("should respect strict mode", async () => {
    const proc = base
      .input(zodResolver(schema), { mode: "strict" })
      .query(async ({ input }) => input.age);

    //@ts-expect-error - Age should be number
    const [_, error] = await proc({ age: "25" });
    expect(error?.reason).toBe("VALIDATION_ERROR");
  });

  it("should allow partial updates in partial mode", async () => {
    const proc = base
      .input(
        zodResolver(z.object({ a: z.string(), b: z.number() }).partial()),
        { mode: "partial" },
      )
      .query(async ({ input }) => input);

    // Should allow passing only one key
    //@ts-ignore
    const [result] = await proc({ a: "test" });
    expect(result).toEqual({ a: "test" });
  });

  it("should merge and provide metadata in context", async () => {
    const root = createProcedure({
      createContext: () => ({ ok: true, ctx: {} }),
      meta: { app: "test-app", roles: ["user"] },
    });

    const proc = root
      .meta({ roles: ["admin"], custom: 123 })
      .query(async ({ ctx }) => ctx.meta);

    const [meta] = await proc();
    expect(meta).toEqual({
      app: "test-app",
      roles: ["admin"], // Overwritten by local meta
      custom: 123,
    });
  });
});

describe("Core: Web Route Handler", () => {
  const procedure = createProcedure({
    inputMode: "strict",
    createContext: () => ({ ok: true, ctx: { userId: "user_1" } }),
    enrichInput: (ctx) => ({ user: ctx.userId }),
  });

  it("should handle GET request and parse search params into input.query", async () => {
    const route = procedure
      .input(zodResolver(z.object({ query: z.object({ name: z.string() }) })))
      .webRoute(async ({ input }) => {
        return { greeting: `Hello ${input.query.name}` };
      });

    const req = new Request("http://localhost/api/test?name=Alice", {
      method: "GET",
    });

    const response = await route(req);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ greeting: "Hello Alice" });
  });

  it("should handle POST request and parse JSON body", async () => {
    const route = procedure
      .input(zodResolver(z.object({ age: z.number() })))
      .webRoute(async ({ input }) => {
        return { doubleAge: input.age * 2 };
      });

    const req = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ age: 30 }),
    });

    const response = await route(req);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ doubleAge: 60 });
  });

  it("should parse route params and query params into input.params and input.query", async () => {
    const route = procedure
      .input(
        zodResolver(
          z.object({
            params: z.object({ id: z.string() }),
            query: z.object({ status: z.string() }),
            user: z.string().optional(),
          }),
        ),
      )
      .webRoute(async ({ input }) => {
        return input;
      });

    const req = new Request("http://localhost/api/test?status=active", {
      method: "GET",
    });

    const response = await route(req, { params: { id: "123" } });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      params: { id: "123" },
      query: { status: "active" },
      user: "user_1",
    });
  });

  it("should pass through custom Response objects", async () => {
    const route = procedure.webRoute(async () => {
      return new Response("Custom body", { status: 201 });
    });

    const req = new Request("http://localhost/api/test");
    const response = await route(req);
    expect(response.status).toBe(201);
    const text = await response.text();
    expect(text).toBe("Custom body");
  });

  it("should handle webRoute without input schema and keep argument alignment", async () => {
    const route = procedure.webRoute(async ({ input }, req, context) => {
      return { input, hasReq: req instanceof Request, params: context?.params };
    });

    const req = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customField: "hello" }),
    });

    const response = await route(req, { params: { dynamicId: "999" } });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      input: {
        customField: "hello",
        params: { dynamicId: "999" },
        query: {},
        user: "user_1",
      },
      hasReq: true,
      params: { dynamicId: "999" },
    });
  });

  it("should support async params (Promise) as passed by Next.js 15+", async () => {
    const route = procedure
      .input(
        zodResolver(
          z.object({
            params: z.object({ dynamicId: z.string() }),
            customField: z.string(),
            user: z.string().optional(),
          }),
        ),
      )
      .webRoute(async ({ input }, req, context) => {
        return new Response(
          JSON.stringify({
            input,
            params: context.params,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      });

    const req = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customField: "hello" }),
    });

    const response = await route(req, {
      params: Promise.resolve({ dynamicId: "999" }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      input: {
        customField: "hello",
        params: { dynamicId: "999" },
        user: "user_1",
      },
      params: { dynamicId: "999" },
    });
  });

  it("should support async searchParams, headers, and cookies (Promise or async function) as in Next.js 15+", async () => {
    const route = procedure
      .input(
        zodResolver(
          z.object({
            query: z.object({
              filter: z.string(),
              page: z.string(),
            }),
            user: z.string().optional(),
          }),
        ),
      )
      .webRoute(async ({ input }, req, context) => {
        return new Response(
          JSON.stringify({
            input,
            headerToken: context.headers?.token,
            cookieSession: context.cookies?.session,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      });

    const req = new Request("http://localhost/api/items?page=1");
    const response = await route(req, {
      searchParams: Promise.resolve({ filter: "active" }),
      headers: Promise.resolve({ token: "auth_token_xyz" }),
      cookies: async () => ({ session: "sess_123" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      input: {
        query: {
          page: "1",
          filter: "active",
        },
        user: "user_1",
      },
      headerToken: "auth_token_xyz",
      cookieSession: "sess_123",
    });
  });

  it("should re-throw NEXT_REDIRECT errors to let Next.js handle redirects natively", async () => {
    class RedirectError extends Error {
      digest = "NEXT_REDIRECT;replace;/login;307;";
      constructor() {
        super("NEXT_REDIRECT");
      }
    }

    const route = procedure.webRoute(async () => {
      throw new RedirectError();
    });

    const req = new Request("http://localhost/api/test");
    await expect(route(req)).rejects.toThrow("NEXT_REDIRECT");
  });

  it("should trigger opts.onError on validation failure and allow error customization", async () => {
    let capturedError: any = null;
    const customProcedure = createProcedure({
      onError({ error }) {
        capturedError = error;
        return {
          message: "Custom validation message",
          reason: "CUSTOM_VALIDATION_ERROR",
        };
      },
    });

    const action = customProcedure
      .input(zodResolver(z.object({ email: z.string().email() })))
      .mutation(async ({ input }) => input);

    const [result, error] = await action({ email: "not-an-email" });
    expect(result).toBeNull();
    expect(capturedError).not.toBeNull();
    expect(capturedError.reason).toBe("VALIDATION_ERROR");
    expect(error.message).toBe("Custom validation message");
    expect(error.reason).toBe("CUSTOM_VALIDATION_ERROR");
    expect(error.statusCode).toBe(400);
  });

  it("should retain validation error when opts.onError returns void (logging only)", async () => {
    let logged = false;
    const customProcedure = createProcedure({
      onError() {
        logged = true;
      },
    });

    const action = customProcedure
      .input(zodResolver(z.object({ count: z.number() })))
      .mutation(async ({ input }) => input);

    const [result, error] = await action({ count: "invalid" as any });
    expect(result).toBeNull();
    expect(logged).toBe(true);
    expect(error).not.toBeNull();
    expect(error.reason).toBe("VALIDATION_ERROR");
    expect(error.statusCode).toBe(400);
  });
});

