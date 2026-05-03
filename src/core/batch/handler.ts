export type BatchRequestItem = {
  id: string | number;
  name: string;
  input: any;
  args?: any[];
};

export type BatchResponseItem = {
  id: string | number;
  result: [any, any]; // [data, error]
};

/**
 * Creates a handler to process batched RPC requests.
 */
export function createBatchHandler(procedures: Record<string, any>) {
  return async (requests: BatchRequestItem[]): Promise<BatchResponseItem[]> => {
    const promises = requests.map(async (req) => {
      const proc = procedures[req.name];

      if (!proc || typeof proc !== "function") {
        return {
          id: req.id,
          result: [
            null,
            {
              message: `Procedure not found: ${req.name}`,
              statusCode: 404,
              reason: "NOT_FOUND",
            },
          ],
        };
      }

      try {
        // Execute the procedure
        const result = await proc(req.input, ...(req.args || []));
        return {
          id: req.id,
          result,
        };
      } catch (error: any) {
        return {
          id: req.id,
          result: [
            null,
            {
              message: error.message || "Internal batch execution error",
              statusCode: error.statusCode || 500,
              reason: error.reason || "INTERNAL_ERROR",
            },
          ],
        };
      }
    });

    return Promise.all(promises);
  };
}
