export type BatchFetcher = (
  requests: { name: string; input: any; args: any[] }[],
) => Promise<[any, any][]>;

export type BatcherOptions = {
  /**
   * Function that sends the batch to the server.
   * Should return an array of [data, error] tuples in the same order.
   */
  fetcher: BatchFetcher;
  /**
   * Max time to wait (ms) before flushing the batch.
   * Default: 10ms
   */
  delay?: number;
};

/**
 * Creates a batching utility that aggregates multiple calls into one.
 */
export function createBatcher(options: BatcherOptions) {
  let queue: {
    name: string;
    input: any;
    args: any[];
    resolve: (result: [any, any]) => void;
  }[] = [];

  let timeout: any = null;

  const flush = async () => {
    const currentQueue = [...queue];
    queue = [];
    timeout = null;

    try {
      const results = await options.fetcher(
        currentQueue.map((q) => ({
          name: q.name,
          input: q.input,
          args: q.args,
        })),
      );

      currentQueue.forEach((item, index) => {
        item.resolve(results[index] || [null, { message: "Batch result missing" }]);
      });
    } catch (error: any) {
      currentQueue.forEach((item) => {
        item.resolve([
          null,
          {
            message: error.message || "Batch fetch failed",
            statusCode: 500,
          },
        ]);
      });
    }
  };

  return {
    /**
     * Executes a procedure through the batcher.
     */
    execute: <T>(name: string, input: any, ...args: any[]): Promise<[T, any]> => {
      return new Promise((resolve) => {
        queue.push({ name, input, args, resolve });

        if (!timeout) {
          timeout = setTimeout(flush, options.delay || 10);
        }
      });
    },
  };
}

/**
 * Connects a set of procedures to a batcher for invisible batching.
 */
export function connectBatcher<T extends Record<string, any>>(
  procedures: T,
  batcher: ReturnType<typeof createBatcher>,
): T {
  const connected: any = {};

  for (const [key, proc] of Object.entries(procedures)) {
    // Clone the procedure function and bind it to our new wrapper for context
    const wrapped: any = function (this: any, ...args: any[]) {
      return (proc as any).apply(wrapped, args);
    };

    // Copy the metadata (_def)
    const def = (proc as any)._def;
    if (def) {
      wrapped._def = {
        ...def,
        // Inject the batcher as the caller
        caller: (input: any, ...args: any[]) =>
          batcher.execute(def.name || key, input, ...args),
      };
    }

    connected[key] = wrapped;
  }

  return connected as T;
}
