import type {
  CreateClientOptions,
  InterceptorRequestContext,
} from "../types/client.js";

export interface BatchedSubscriber {
  resolve: (value: [any, any]) => void;
  reject: (reason?: any) => void;
}

export interface BatchedQueueItem {
  id: number;
  procedure: string;
  input: any;
  extraArgs: any[];
  opts?: any;
  subscribers: BatchedSubscriber[];
}

export interface BatchMetrics {
  totalBatches: number;
  totalDispatched: number;
  totalWireItems: number;
  totalDeduplicated: number;
  lastBatch?: {
    timestamp: number;
    dispatchedCount: number;
    wireCount: number;
    dedupedCount: number;
    wirePayload: Array<{ id: number; procedure: string; input?: any; args?: any[] }>;
    durationMs: number;
  };
}

export class BatchManager {
  private queue: BatchedQueueItem[] = [];
  private timer: any = null;
  private nextId = 0;
  private dedupeMap = new Map<string, BatchedQueueItem>();
  private pendingDispatched = 0;
  private pendingDeduped = 0;
  private metrics: BatchMetrics = {
    totalBatches: 0,
    totalDispatched: 0,
    totalWireItems: 0,
    totalDeduplicated: 0,
  };

  constructor(
    private baseUrl: string,
    private clientOpts: CreateClientOptions,
    private batchConfig: { delay: number; maxBatchSize: number },
  ) {}

  getMetrics(): BatchMetrics {
    return {
      ...this.metrics,
      lastBatch: this.metrics.lastBatch ? { ...this.metrics.lastBatch } : undefined,
    };
  }

  enqueue(
    procedure: string,
    input: any,
    opts: any,
    extraArgs: any[] = [],
  ): Promise<[any, any]> {
    return new Promise<[any, any]>((resolve, reject) => {
      this.pendingDispatched++;
      this.metrics.totalDispatched++;

      // 1. Network Deduplication:
      // If an identical procedure call (same procedure, input, extraArgs) is already
      // queued in the current unflushed window, attach to its subscribers.
      let serializedInput = "";
      let serializedArgs = "";
      try {
        serializedInput = JSON.stringify(input ?? null);
        serializedArgs = JSON.stringify(extraArgs ?? []);
      } catch {
        serializedInput = String(input);
        serializedArgs = String(extraArgs);
      }

      const dedupeKey = `${procedure}::${serializedInput}::${serializedArgs}`;
      const existing = this.dedupeMap.get(dedupeKey);

      if (existing) {
        this.pendingDeduped++;
        this.metrics.totalDeduplicated++;
        existing.subscribers.push({ resolve, reject });
        return;
      }

      const id = this.nextId++;
      const item: BatchedQueueItem = {
        id,
        procedure,
        input,
        extraArgs,
        opts,
        subscribers: [{ resolve, reject }],
      };

      this.queue.push(item);
      this.dedupeMap.set(dedupeKey, item);

      // Handle individual abort signal
      if (opts?.signal) {
        opts.signal.addEventListener("abort", () => {
          item.subscribers = item.subscribers.filter(
            (s) => s.resolve !== resolve,
          );
          if (item.subscribers.length === 0) {
            this.queue = this.queue.filter((q) => q.id !== item.id);
            this.dedupeMap.delete(dedupeKey);
          }
          reject(new DOMException("Aborted", "AbortError"));
        });
      }

      // 2. Capacity Trigger:
      // If maxBatchSize is reached, flush immediately without waiting for delay timer
      if (this.queue.length >= this.batchConfig.maxBatchSize) {
        if (this.timer) {
          clearTimeout(this.timer);
          this.timer = null;
        }
        this.flush();
        return;
      }

      // 3. Time Window Trigger (e.g. 10ms)
      if (!this.timer) {
        this.timer = setTimeout(() => {
          this.timer = null;
          this.flush();
        }, this.batchConfig.delay);

        if (
          typeof this.timer === "object" &&
          this.timer !== null &&
          "unref" in this.timer &&
          typeof (this.timer as any).unref === "function"
        ) {
          (this.timer as any).unref();
        }
      }
    });
  }

  private async flush() {
    const start = performance.now();
    const items = [...this.queue];
    const dispatchedInThisBatch = this.pendingDispatched;
    const dedupedInThisBatch = this.pendingDeduped;
    this.pendingDispatched = 0;
    this.pendingDeduped = 0;
    this.queue = [];
    this.dedupeMap.clear();

    if (items.length === 0) return;

    // Build batch payload: array of { id, procedure, input?, args? }
    const payload = items.map((item) => {
      const entry: any = {
        id: item.id,
        procedure: item.procedure,
      };
      if (item.input !== undefined) {
        entry.input = item.input;
      }
      if (item.extraArgs && item.extraArgs.length > 0) {
        entry.args = item.extraArgs;
      }
      return entry;
    });

    // Form batch URL with ?batch=1
    const base = new URL(
      this.baseUrl,
      typeof window !== "undefined" ? window.location.origin : undefined,
    );
    base.searchParams.set("batch", "1");
    const url = base.toString();

    const fetchFn = this.clientOpts.fetch || globalThis.fetch;
    const clientHeaders =
      typeof this.clientOpts.headers === "function"
        ? await this.clientOpts.headers()
        : this.clientOpts.headers || {};

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...clientHeaders,
    };

    // Run interceptor onRequest if present
    if (this.clientOpts.interceptors?.onRequest) {
      const reqCtx: InterceptorRequestContext = {
        url,
        procedure: "$batch",
        input: payload,
        method: "POST",
        headers,
        options: {},
      };
      const modified = await this.clientOpts.interceptors.onRequest(reqCtx);
      if (modified && typeof modified === "object") {
        if (modified.headers) {
          Object.assign(headers, modified.headers);
        }
      }
    }

    try {
      const response = await fetchFn(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const durationMs = Math.round(performance.now() - start);
      this.metrics.totalBatches++;
      this.metrics.totalWireItems += payload.length;
      this.metrics.lastBatch = {
        timestamp: Date.now(),
        dispatchedCount: dispatchedInThisBatch,
        wireCount: payload.length,
        dedupedCount: dedupedInThisBatch,
        wirePayload: payload,
        durationMs,
      };

      let rawData: any;
      const contentType = response.headers?.get?.("content-type") || "";
      if (contentType.includes("application/json") || !contentType) {
        try {
          rawData = await response.json();
        } catch {
          rawData = null;
        }
      } else {
        rawData = await response.text();
      }

      // Handle non-2xx HTTP response
      if (!response.ok) {
        const errorResult: [null, any] = [
          null,
          typeof rawData === "object" && rawData !== null
            ? rawData
            : {
                message: `Batch request failed with HTTP ${response.status}`,
                statusCode: response.status,
                reason: "HTTP_ERROR",
              },
        ];

        items.forEach((item) => {
          item.subscribers.forEach((s) => s.resolve(errorResult));
        });
        return;
      }

      // Handle 2xx batch response (array of results)
      if (Array.isArray(rawData)) {
        const resultMap = new Map<number | string, [any, any]>();

        rawData.forEach((entry, idx) => {
          if (entry && typeof entry === "object" && "result" in entry) {
            resultMap.set(
              entry.id !== undefined ? entry.id : idx,
              entry.result,
            );
          } else if (Array.isArray(entry) && entry.length === 2) {
            resultMap.set(idx, entry as [any, any]);
          } else {
            resultMap.set(idx, [entry, null]);
          }
        });

        items.forEach((item, idx) => {
          const res = resultMap.get(item.id) ??
            resultMap.get(idx) ?? [
              null,
              {
                message: "Missing batch result",
                statusCode: 500,
                reason: "BATCH_RESULT_MISSING",
              },
            ];

          item.subscribers.forEach((s) => s.resolve(res));
        });
      } else {
        // Unexpected non-array response
        const fallback: [null, any] = [
          null,
          {
            message:
              "Invalid response from server for batch request (expected array)",
            statusCode: 500,
            reason: "INVALID_BATCH_RESPONSE",
          },
        ];
        items.forEach((item) => {
          item.subscribers.forEach((s) => s.resolve(fallback));
        });
      }
    } catch (err: any) {
      const errorTuple: [null, any] = [
        null,
        {
          message: err?.message || "Batch network request failed",
          statusCode: 500,
          reason: "NETWORK_ERROR",
        },
      ];
      items.forEach((item) => {
        item.subscribers.forEach((s) => s.resolve(errorTuple));
      });
    }
  }
}

const batchManagers = new WeakMap<CreateClientOptions, BatchManager>();

export function getBatchManager(
  baseUrl: string,
  clientOpts: CreateClientOptions,
): BatchManager {
  let manager = batchManagers.get(clientOpts);
  if (!manager) {
    const delay =
      typeof clientOpts.batch === "object"
        ? clientOpts.batch.delay ?? 10
        : 10;
    const maxBatchSize =
      typeof clientOpts.batch === "object"
        ? clientOpts.batch.maxBatchSize ?? 50
        : 50;
    manager = new BatchManager(baseUrl, clientOpts, { delay, maxBatchSize });
    batchManagers.set(clientOpts, manager);
  }
  return manager;
}
