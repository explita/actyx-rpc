let trace: any;
let SpanStatusCode: any;

try {
  // Try to load the OTel API
  //@ts-ignore
  const api = await import("@opentelemetry/api");
  trace = api.trace;
  SpanStatusCode = api.SpanStatusCode;
} catch {
  // No-op fallback if API is not available
  trace = {
    getTracer: () => ({
      startSpan: () => ({
        setAttribute: () => {},
        setStatus: () => {},
        recordException: () => {},
        end: () => {},
      }),
    }),
  };
  SpanStatusCode = { ERROR: 1 };
}

const tracer = trace.getTracer("actyx-rpc");

export function startSpan(name: string, attributes?: Record<string, any>) {
  return tracer.startSpan(name, {
    attributes: {
      "rpc.system": "actyx-rpc",
      ...attributes,
    },
  });
}

export function recordError(span: any, error: any) {
  span.recordException?.(error);
  span.setStatus?.({
    code: SpanStatusCode.ERROR,
    message: error.message,
  });
}
