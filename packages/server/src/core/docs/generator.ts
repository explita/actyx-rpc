import { ProcedureConfig } from "../../types/procedure.js";
import fs from "fs";

export type OpenApiOptions = {
  title: string;
  version: string;
  /**
   * OpenAPI specification version.
   * @default "3.1.0"
   */
  openapiVersion?: "3.0.0" | "3.1.0";
  /**
   * Path separator for nested routers in the OpenAPI URL paths.
   * - "slash": `/todos/list`
   * - "dot": `/todos.list`
   * @default "slash"
   */
  pathStyle?: "slash" | "dot";
  baseUrl?: string;
  tags?: string[];
  output?: string;
  security?: boolean | Record<string, unknown>;
};

export type ProcedureOverride = {
  procedure: unknown;
  method?: "get" | "post" | "put" | "patch" | "delete";
  tags?: string[];
  summary?: string;
  description?: string;
};

/**
 * Flattens arbitrary nested routers and procedure maps into a flat list
 * of { path, procedure, overrides }.
 */
function flattenProcedures(
  routerOrMap: Record<string, any>,
  prefix = "",
  pathStyle: "slash" | "dot" = "slash",
): Record<string, { procedure: unknown; overrides: ProcedureOverride }> {
  const result: Record<
    string,
    { procedure: unknown; overrides: ProcedureOverride }
  > = {};

  const sep = pathStyle === "dot" ? "." : "/";

  for (const [key, value] of Object.entries(routerOrMap)) {
    if (!value) continue;

    const currentPath = prefix ? `${prefix}${sep}${key}` : key;

    // Check if this is an override wrapper: { procedure: ..., method?: ... }
    const isOverride =
      typeof value === "object" &&
      value !== null &&
      "procedure" in value &&
      (Boolean((value.procedure as any)?._def) ||
        typeof value.procedure === "function");

    if (isOverride) {
      result[currentPath] = {
        procedure: value.procedure,
        overrides: value as ProcedureOverride,
      };
      continue;
    }

    // Check if this is a procedure directly
    const isProcedure =
      Boolean((value as any)?._def) || typeof value === "function";

    if (isProcedure) {
      result[currentPath] = {
        procedure: value,
        overrides: {} as ProcedureOverride,
      };
      continue;
    }

    // Otherwise, treat as a nested router object and recurse
    if (typeof value === "object" && value !== null) {
      const nested = flattenProcedures(value, currentPath, pathStyle);
      Object.assign(result, nested);
    }
  }

  return result;
}

function safeToJsonSchema(resolver: any): Record<string, unknown> {
  if (!resolver) return { type: "object" };
  try {
    if (typeof resolver.toJsonSchema === "function") {
      const res = resolver.toJsonSchema();
      if (res && typeof res === "object") return res;
    }
  } catch {
    // Graceful fallback if schema conversion fails
  }
  return { type: "object" };
}

export function generateOpenApi(
  proceduresOrRouter: Record<string, unknown | ProcedureOverride>,
  options: OpenApiOptions,
) {
  const paths: Record<string, unknown> = {};
  const flattened = flattenProcedures(
    proceduresOrRouter,
    "",
    options.pathStyle ?? "slash",
  );

  for (const [name, { procedure: proc, overrides }] of Object.entries(
    flattened,
  )) {
    const config: ProcedureConfig<any, any, any> =
      ((proc as any)?._def as ProcedureConfig<any, any, any>) || {
        type:
          name.endsWith("/create") ||
          name.endsWith("/update") ||
          name.endsWith("/delete") ||
          name.endsWith("/set") ||
          name.endsWith("/mutate")
            ? "mutation"
            : "query",
        summary: overrides.summary || name,
        description: overrides.description,
      };

    const path = `/${name.replace(/^\/+/, "")}`;
    const defaultMethod =
      config.type === "mutation"
        ? "post"
        : config.type === "stream" || config.type === "sse"
          ? "get"
          : "get";

    const method = (overrides.method || defaultMethod).toLowerCase();

    const securityRequirement = options.security
      ? [
          {
            [typeof options.security === "object"
              ? Object.keys(options.security)[0]
              : "bearerAuth"]: [],
          },
        ]
      : undefined;

    const isStream = config.type === "stream" || config.type === "sse";

    const responseContent = isStream
      ? {
          "text/event-stream": {
            schema: {
              type: "string",
              description: "Server-Sent Events stream",
            },
          },
        }
      : {
          "application/json": {
            schema: stripSchemaTag(safeToJsonSchema(config.outputResolver)),
          },
        };

    const hasRequestBody =
      method === "post" || method === "put" || method === "patch";

    paths[path] = {
      ...(paths[path] as Record<string, unknown> | undefined),
      [method]: {
        operationId: name.replace(/[\/\.]/g, "_"),
        summary: overrides.summary || config.summary || name,
        description: overrides.description || config.description,
        tags: overrides.tags || options.tags || ["RPC"],
        parameters:
          method === "get" || method === "delete"
            ? getGetParameters(config)
            : [],
        requestBody: hasRequestBody ? getRequestBody(config) : undefined,
        security: securityRequirement,
        responses: {
          200: {
            description: isStream
              ? "Real-time streaming response"
              : "Successful response",
            content: responseContent,
          },
          400: { description: "Validation Error" },
          401: { description: "Unauthorized" },
          403: { description: "Forbidden" },
          500: { description: "Internal Server Error" },
        },
      },
    };
  }

  const finalOutput = {
    openapi: options.openapiVersion || "3.1.0",
    info: {
      title: options.title,
      version: options.version,
    },
    servers: options.baseUrl ? [{ url: options.baseUrl }] : [],
    security: options.security
      ? [
          {
            [typeof options.security === "object"
              ? Object.keys(options.security)[0]
              : "bearerAuth"]: [],
          },
        ]
      : undefined,
    paths,
    components: options.security
      ? {
          securitySchemes:
            typeof options.security === "object"
              ? options.security
              : {
                  bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                  },
                },
        }
      : undefined,
  };

  if (options.output) {
    try {
      fs.writeFileSync(options.output, JSON.stringify(finalOutput, null, 2));
    } catch (error) {
      console.error("Failed to write OpenAPI output file:", error);
    }
  }

  return finalOutput;
}

/**
 * Creates an HTTP GET Route Handler that returns the generated OpenAPI JSON specification.
 *
 * @example
 * ```ts
 * // app/api/openapi.json/route.ts
 * import { createOpenApiHandler } from "@explita/actyx-rpc";
 * import { appRouter } from "@/backend/router";
 *
 * export const GET = createOpenApiHandler(appRouter, {
 *   title: "My System API",
 *   version: "1.0.0",
 * });
 * ```
 */
export function createOpenApiHandler(
  proceduresOrRouter: Record<string, unknown | ProcedureOverride>,
  options: OpenApiOptions,
): (req?: Request) => Response {
  let cachedSpec: any = null;

  return (_req?: Request) => {
    try {
      if (!cachedSpec) {
        cachedSpec = generateOpenApi(proceduresOrRouter, options);
      }
      return new Response(JSON.stringify(cachedSpec, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        },
      });
    } catch (err: any) {
      console.error("[actyx-rpc] Failed to generate OpenAPI specification:", err);
      return new Response(
        JSON.stringify(
          {
            error: "Failed to generate OpenAPI specification",
            message: err?.message || String(err),
          },
          null,
          2,
        ),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
          },
        },
      );
    }
  };
}

function getGetParameters(config: ProcedureConfig<any, any, any>) {
  const rawSchema = safeToJsonSchema(config.resolver);
  const schema = stripSchemaTag(rawSchema);

  if (schema.type !== "object" || !schema.properties) return [];

  return Object.entries(schema.properties).map(
    ([name, prop]: [string, any]) => ({
      name,
      in: "query",
      required: (schema.required as any[])?.includes(name),
      schema: prop,
      example: generateExample(prop),
    }),
  );
}

function getRequestBody(config: ProcedureConfig<any, any, any>) {
  const rawSchema = safeToJsonSchema(config.resolver);
  const schema = stripSchemaTag(rawSchema);

  const example = generateExample(schema);

  return {
    content: {
      "application/json": {
        schema,
        example,
      },
      "multipart/form-data": {
        schema,
        example,
      },
    },
  };
}

function generateExample(schema: any): any {
  if (!schema) return undefined;

  if (schema.example) return schema.example;

  if (schema.type === "object" && schema.properties) {
    const obj: any = {};
    for (const [key, prop] of Object.entries(schema.properties)) {
      obj[key] = generateExample(prop);
    }
    return obj;
  }

  if (schema.type === "array" && schema.items) {
    return [generateExample(schema.items)];
  }

  switch (schema.type) {
    case "string":
      if (schema.format === "date-time") return new Date().toISOString();
      if (schema.format === "email") return "user@example.com";
      return "string";
    case "number":
    case "integer":
      return 0;
    case "boolean":
      return true;
    default:
      return null;
  }
}

/**
 * Recursively removes the $schema property from a JSON schema object.
 */
function stripSchemaTag(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map(stripSchemaTag);
  }

  const newObj = { ...obj };
  delete newObj["$schema"];

  for (const key in newObj) {
    newObj[key] = stripSchemaTag(newObj[key]);
  }

  return newObj;
}
