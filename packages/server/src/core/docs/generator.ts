import { ProcedureConfig } from "../../types/procedure.js";
import fs from "fs";

export type OpenApiOptions = {
  title: string;
  version: string;
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

export function generateOpenApi(
  procedures: Record<string, unknown | ProcedureOverride>,
  options: OpenApiOptions,
) {
  const paths: Record<string, unknown> = {};

  for (const [name, entry] of Object.entries(procedures)) {
    // Determine if we have a raw procedure or an override object
    const isOverride =
      entry && typeof entry === "object" && "procedure" in entry;
    const proc = isOverride ? entry.procedure : entry;
    const overrides = isOverride
      ? (entry as ProcedureOverride)
      : ({} as ProcedureOverride);

    const config = (proc as any)._def as ProcedureConfig<any, any, any>;
    if (!config) {
      console.warn(`No _def found for procedure: ${name}`);
      continue;
    }

    const path = `/${name}`;
    const method =
      overrides.method || (config.type === "mutation" ? "post" : "get");

    const securityRequirement = options.security
      ? [
          {
            [typeof options.security === "object"
              ? Object.keys(options.security)[0]
              : "bearerAuth"]: [],
          },
        ]
      : undefined;

    paths[path] = {
      [method]: {
        operationId: name,
        summary: overrides.summary || config.summary || name,
        description: overrides.description || config.description,
        tags: overrides.tags || options.tags || ["RPC"],
        parameters: method === "get" ? getGetParameters(config) : [],
        requestBody: method === "post" ? getRequestBody(config) : undefined,
        security: securityRequirement,
        responses: {
          200: {
            description: "Successful response",
            content: {
              "application/json": {
                schema: stripSchemaTag(
                  config.outputResolver?.toJsonSchema?.() || {
                    type: "object",
                  },
                ),
              },
            },
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
    openapi: "3.0.0",
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
      console.error(error);
    }
  }

  return finalOutput;
}

function getGetParameters(config: ProcedureConfig<any, any, any>) {
  const rawSchema = config.resolver?.toJsonSchema?.() || { type: "object" };
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
  const rawSchema = config.resolver?.toJsonSchema?.() || { type: "object" };
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
