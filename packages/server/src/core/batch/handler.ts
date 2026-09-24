export type BatchRequestItem = {
  id?: string | number;
  procedure?: string;
  name?: string;
  input?: any;
  args?: any[];
};

export type BatchResponseItem = {
  id: string | number;
  result: [any, any]; // [data, error]
};

/**
 * Creates a standalone handler to process batched RPC requests against a procedure map or router.
 */
export function createBatchHandler(procedures: Record<string, any>) {
  return async (
    requests: BatchRequestItem[],
    httpScope?: any,
  ): Promise<BatchResponseItem[]> => {
    const promises = requests.map(async (req, idx) => {
      const procName = req.procedure ?? req.name;
      const itemId = req.id !== undefined ? req.id : idx;

      if (!procName || typeof procName !== "string") {
        return {
          id: itemId,
          result: [
            null,
            {
              message: "Missing procedure name in batch item",
              statusCode: 400,
              reason: "BAD_REQUEST",
            },
          ] as [any, any],
        };
      }

      // Check direct lookup or dot-notation traversal for nested routers
      let proc = procedures[procName];
      if (!proc && procName.includes(".")) {
        const parts = procName.split(".");
        let curr: any = procedures;
        for (const part of parts) {
          curr = curr?.[part];
        }
        proc = curr;
      }

      if (!proc || typeof proc !== "function") {
        return {
          id: itemId,
          result: [
            null,
            {
              message: `Procedure not found: ${procName}`,
              statusCode: 404,
              reason: "NOT_FOUND",
            },
          ] as [any, any],
        };
      }

      if (proc._def?.type === "sse" || proc._def?.type === "stream") {
        return {
          id: itemId,
          result: [
            null,
            {
              message:
                "Streaming and SSE procedures cannot be executed in an HTTP batch request",
              statusCode: 400,
              reason: "STREAM_BATCH_UNSUPPORTED",
            },
          ] as [any, any],
        };
      }

      try {
        const raw = httpScope
          ? await proc.call(httpScope, req.input, ...(req.args || []))
          : await proc(req.input, ...(req.args || []));

        const result: [any, any] =
          Array.isArray(raw) &&
          raw.length === 2 &&
          (raw[1] === null || raw[0] === null)
            ? (raw as [any, any])
            : [raw, null];

        return {
          id: itemId,
          result,
        };
      } catch (error: any) {
        return {
          id: itemId,
          result: [
            null,
            {
              message: error.message || "Internal batch execution error",
              statusCode: error.statusCode || 500,
              reason: error.reason || "INTERNAL_ERROR",
            },
          ] as [any, any],
        };
      }
    });

    return Promise.all(promises);
  };
}
