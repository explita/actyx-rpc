import { describe, it, expect } from "vitest";
import {
  createProcedure,
  createRouter,
  generateOpenApi,
  createOpenApiHandler,
} from "../../packages/server/src/index.js";
import { z } from "zod";

describe("Automated OpenAPI 3.1 Generation", () => {
  const procedure = createProcedure();

  const getTodos = procedure
    .summary("List all todos")
    .description("Fetches a list of todos with optional filtering.")
    .input(
      z.object({
        limit: z.number().optional(),
        search: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      return [{ id: "1", title: "Todo 1" }];
    });

  const addTodo = procedure
    .summary("Add a new todo item")
    .input(
      z.object({
        title: z.string().min(1),
        completed: z.boolean().default(false),
      }),
    )
    .output(
      z.object({
        id: z.string(),
        title: z.string(),
        completed: z.boolean(),
      }),
    )
    .mutation(async ({ input }) => {
      return { id: "new-id", title: input.title, completed: input.completed };
    });

  const streamLiveEvents = procedure
    .summary("Live SSE stream")
    .stream(async function* () {
      yield { event: "ping" };
    });

  const appRouter = createRouter({
    todos: createRouter({
      list: getTodos,
      add: addTodo,
    }),
    live: createRouter({
      events: streamLiveEvents,
    }),
  });

  it("should recursively flatten nested routers into URL paths", () => {
    const spec = generateOpenApi(appRouter, {
      title: "Task API",
      version: "1.0.0",
      baseUrl: "https://api.example.com",
    });

    expect(spec.openapi).toBe("3.1.0");
    expect(spec.info.title).toBe("Task API");
    expect(spec.servers[0]?.url).toBe("https://api.example.com");

    // Nested routes mapped properly
    expect(spec.paths["/todos/list"]).toBeDefined();
    expect(spec.paths["/todos/add"]).toBeDefined();
    expect(spec.paths["/live/events"]).toBeDefined();

    // Query parameters extracted for GET
    const getParams = (spec.paths["/todos/list"] as any).get.parameters;
    const paramNames = getParams.map((p: any) => p.name);
    expect(paramNames).toContain("limit");
    expect(paramNames).toContain("search");
  });

  it("should extract JSON Schema properties from native Standard Schemas", () => {
    const spec = generateOpenApi(appRouter, {
      title: "Task API",
      version: "1.0.0",
    });

    const addOperation = (spec.paths["/todos/add"] as any).post;
    expect(addOperation).toBeDefined();

    // Request body properties
    const requestJsonSchema =
      addOperation.requestBody.content["application/json"].schema;
    expect(requestJsonSchema.properties).toBeDefined();
    expect(requestJsonSchema.properties.title).toBeDefined();
    expect(requestJsonSchema.properties.completed).toBeDefined();

    // Output response schema
    const responseJsonSchema =
      addOperation.responses[200].content["application/json"].schema;
    expect(responseJsonSchema.properties).toBeDefined();
    expect(responseJsonSchema.properties.id).toBeDefined();
    expect(responseJsonSchema.properties.title).toBeDefined();
  });

  it("should document streaming/SSE procedures with text/event-stream", () => {
    const spec = generateOpenApi(appRouter, {
      title: "Task API",
      version: "1.0.0",
    });

    const liveOperation = (spec.paths["/live/events"] as any).get;
    expect(liveOperation).toBeDefined();
    expect(liveOperation.responses[200].content["text/event-stream"]).toBeDefined();
  });

  it("should support procedure overrides (custom method, tags, summary)", () => {
    const spec = generateOpenApi(
      {
        todos: {
          update: {
            procedure: addTodo,
            method: "put",
            tags: ["Todo Operations"],
            summary: "Custom update summary",
          },
        },
      },
      {
        title: "Override API",
        version: "2.0.0",
      },
    );

    const putOperation = (spec.paths["/todos/update"] as any).put;
    expect(putOperation).toBeDefined();
    expect(putOperation.summary).toBe("Custom update summary");
    expect(putOperation.tags).toEqual(["Todo Operations"]);
    expect(putOperation.requestBody).toBeDefined();
  });

  it("should support createOpenApiHandler to serve OpenAPI spec directly over HTTP", async () => {
    const handler = createOpenApiHandler(appRouter, {
      title: "HTTP Served API",
      version: "1.0.0",
    });

    const response = handler(new Request("https://api.example.com/openapi.json"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/json");

    const json = await response.json();
    expect(json.info.title).toBe("HTTP Served API");
    expect(json.paths["/todos/list"]).toBeDefined();
  });

  it("should safely handle z.date() in input and output schemas without throwing", () => {
    const dateProcedure = procedure
      .input(
        z.object({
          from: z.date(),
          to: z.date().optional(),
        }),
      )
      .output(
        z.object({
          createdAt: z.date(),
          updatedAt: z.date(),
        }),
      )
      .query(async ({ input }) => ({
        createdAt: input.from,
        updatedAt: new Date(),
      }));

    const routerWithDates = createRouter({
      events: createRouter({
        byDate: dateProcedure,
      }),
    });

    const spec = generateOpenApi(routerWithDates, {
      title: "Date API",
      version: "1.0.0",
    });

    expect(spec.paths["/events/byDate"]).toBeDefined();
    const getOp = (spec.paths["/events/byDate"] as any).get;
    expect(getOp).toBeDefined();

    const fromParam = getOp.parameters.find((p: any) => p.name === "from");
    expect(fromParam).toBeDefined();
    expect(fromParam.schema.type).toBe("string");
    expect(fromParam.schema.format).toBe("date-time");

    const responseSchema =
      getOp.responses[200].content["application/json"].schema;
    expect(responseSchema.properties.createdAt.type).toBe("string");
    expect(responseSchema.properties.createdAt.format).toBe("date-time");
  });

  it("should document plain functions in nested routers without _def without warnings or dropping", () => {
    const rawRouter = {
      site: {
        page: {
          public: {
            get: async () => ({ title: "Home" }),
            preview: async () => ({ preview: true }),
          },
        },
      },
    };

    const spec = generateOpenApi(rawRouter, {
      title: "Site API",
      version: "1.0.0",
    });

    expect(spec.paths["/site/page/public/get"]).toBeDefined();
    expect(spec.paths["/site/page/public/preview"]).toBeDefined();
    expect((spec.paths["/site/page/public/get"] as any).get).toBeDefined();
    expect((spec.paths["/site/page/public/preview"] as any).get).toBeDefined();
  });
});

