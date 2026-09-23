export type ResolvedProcedureResult =
  | { success: true; procedureName: string; procedure: any }
  | { success: false; response: Response };

/**
 * Resolves procedure name and function from query params, dynamic route params,
 * or pathname segments matching the router structure.
 */
export function resolveProcedure<T extends Record<string, any>>(
  url: URL,
  params: any,
  target: T,
): ResolvedProcedureResult {
  // Resolve procedure name from:
  // 1. Explicit query parameter (?procedure=posts.list)
  // 2. Next.js route params (e.g. [trpc] or [...trpc], [rpc], [procedure], [path], [slug])
  // 3. Fallback to URL pathname segments (e.g. /api/rpc/posts.list)
  let procedureName = url.searchParams.get("procedure") || undefined;

  if (!procedureName && params && typeof params === "object") {
    const paramVal =
      params.trpc ??
      params.rpc ??
      params.procedure ??
      params.path ??
      params.slug ??
      Object.values(params).find(Array.isArray) ??
      Object.values(params)[0];

    if (Array.isArray(paramVal) && paramVal.length > 0) {
      procedureName = paramVal.join(".");
    } else if (typeof paramVal === "string" && paramVal) {
      procedureName = paramVal;
    }
  }

  if (!procedureName) {
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length > 0) {
      for (let i = segments.length - 1; i >= 0; i--) {
        const candidate = segments.slice(i).join(".");
        const parts = candidate.split(".");
        let curr = target;
        for (const part of parts) {
          curr = curr?.[part];
        }
        if (typeof curr === "function") {
          procedureName = candidate;
          break;
        }
      }
    }
  }

  if (!procedureName) {
    return {
      success: false,
      response: Response.json(
        { message: "Procedure parameter required" },
        { status: 400 },
      ),
    };
  }

  const parts = procedureName.split(".");
  let current: any = target;
  for (const part of parts) {
    current = current?.[part];
  }

  if (!current || typeof current !== "function") {
    return {
      success: false,
      response: Response.json(
        {
          success: false,
          message: "Not Found",
          code: "NOT_FOUND",
        },
        { status: 404 },
      ),
    };
  }

  return {
    success: true,
    procedureName,
    procedure: current,
  };
}
