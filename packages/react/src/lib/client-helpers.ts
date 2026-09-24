import {
  CreateClientOptions,
  InterceptorRequestContext,
  InterceptorResponseContext,
  InterceptorErrorContext,
} from "../types/client.js";

export function hasFile(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (
    (typeof Blob !== "undefined" && val instanceof Blob) ||
    (typeof File !== "undefined" && val instanceof File)
  ) {
    return true;
  }
  if (typeof val === "object" && !(val instanceof FormData)) {
    return Object.values(val as Record<string, unknown>).some(hasFile);
  }
  return false;
}

export function objectToFormData(
  data: any,
  fd: FormData = new FormData(),
  prefix = "",
): FormData {
  if (data === null || data === undefined) {
    return fd;
  }

  if (
    (typeof Blob !== "undefined" && data instanceof Blob) ||
    (typeof File !== "undefined" && data instanceof File)
  ) {
    const filename =
      (data as any).name ||
      (prefix
        ? prefix
            .split(/[\.\[\]]/)
            .filter(Boolean)
            .pop()
        : "file");
    fd.append(prefix, data, filename);
    return fd;
  }

  if (Array.isArray(data)) {
    if (!hasFile(data) && prefix) {
      fd.append(prefix, JSON.stringify(data));
      return fd;
    }
    data.forEach((item, index) => {
      const key = prefix ? `${prefix}[${index}]` : `${index}`;
      objectToFormData(item, fd, key);
    });
    return fd;
  }

  if (typeof data === "object" && !(data instanceof FormData)) {
    // If this nested object does NOT contain any File or Blob, JSON stringify it to preserve exact types
    if (!hasFile(data) && prefix) {
      fd.append(prefix, JSON.stringify(data));
      return fd;
    }

    Object.entries(data).forEach(([key, value]) => {
      if (value === undefined) return;
      const fullKey = prefix ? `${prefix}[${key}]` : key;
      objectToFormData(value, fd, fullKey);
    });
    return fd;
  }

  fd.append(prefix, String(data));
  return fd;
}

export async function executeFetch(
  baseUrl: string,
  clientOpts: CreateClientOptions,
  procedure: string,
  input: any,
  opts?: any,
  extraArgs: any[] = [],
  retryCount: number = 0,
): Promise<[any, any]> {
  const maxRetries = clientOpts.maxRetries ?? 3;

  const retry = async (customOptions?: {
    headers?: Record<string, string>;
    [key: string]: any;
  }): Promise<[any, any]> => {
    if (retryCount >= maxRetries) {
      return [
        null,
        {
          success: false,
          message: `Max retries (${maxRetries}) exceeded`,
          statusCode: 429,
          reason: "MAX_RETRIES_EXCEEDED",
          handlerName: procedure,
        },
      ];
    }
    const mergedOpts = {
      ...opts,
      ...customOptions,
      headers: {
        ...opts?.headers,
        ...customOptions?.headers,
      },
    };
    return executeFetch(
      baseUrl,
      clientOpts,
      procedure,
      input,
      mergedOpts,
      extraArgs,
      retryCount + 1,
    );
  };

  const fetchFn = clientOpts.fetch || globalThis.fetch;
  const headers =
    typeof clientOpts.headers === "function"
      ? await clientOpts.headers()
      : clientOpts.headers || {};

  const base = new URL(
    baseUrl,
    typeof window !== "undefined" ? window.location.origin : undefined,
  );

  let url: URL;
  if (clientOpts.routing === "query") {
    url = new URL(base.toString());
    url.searchParams.set("procedure", procedure);
  } else {
    const cleanPath = base.pathname.replace(/\/$/, "");
    url = new URL(`${cleanPath}/${procedure}${base.search}`, base.origin);
  }

  const {
    method: explicitMethod,
    defaultMethod,
    headers: optsHeaders,
    signal: optsSignal,
    onProgress,
    ...restOpts
  } = opts || {};

  const method = (
    explicitMethod ||
    (defaultMethod === "GET"
      ? clientOpts.queryMethod || "GET"
      : defaultMethod) ||
    "POST"
  ).toUpperCase();

  const finalHeaders: Record<string, string> = {
    ...headers,
    ...optsHeaders,
  };

  // Interceptor: onRequest
  if (clientOpts.interceptors?.onRequest) {
    const reqCtx: InterceptorRequestContext = {
      url: url.toString(),
      procedure,
      input,
      method,
      headers: finalHeaders,
      options: restOpts,
    };
    const modified = await clientOpts.interceptors.onRequest(reqCtx);
    if (modified && typeof modified === "object") {
      if (modified.headers) {
        Object.assign(finalHeaders, modified.headers);
      }
      Object.assign(restOpts, modified);
    }
  }

  let body: any = undefined;

  if (method === "GET" || method === "HEAD") {
    if (input !== undefined && input !== null) {
      let shouldSetInput = true;
      if (typeof input === "object" && !Array.isArray(input)) {
        const hasDefinedKeys = Object.values(input).some(
          (v) => v !== undefined,
        );
        if (!hasDefinedKeys) {
          shouldSetInput = false;
        }
      }
      if (shouldSetInput) {
        url.searchParams.set("input", JSON.stringify(input));
      }
    }
    if (extraArgs.length > 0) {
      url.searchParams.set("args", JSON.stringify(extraArgs));
    }
  } else {
    if (input !== undefined || extraArgs.length > 0) {
      if (
        (typeof Blob !== "undefined" && input instanceof Blob) ||
        (typeof File !== "undefined" && input instanceof File)
      ) {
        // Direct bare File or Blob input
        const fd = new FormData();
        const filename = (input as any).name || "file";
        fd.append("file", input, filename);
        fd.append("__direct_file__", "true");
        if (extraArgs.length > 0) {
          fd.append("args", JSON.stringify(extraArgs));
        }
        body = fd;
        delete finalHeaders["Content-Type"];
      } else if (typeof FormData !== "undefined" && input instanceof FormData) {
        // Raw FormData input
        if (extraArgs.length > 0 && !input.has("args")) {
          input.append("args", JSON.stringify(extraArgs));
        }
        body = input;
        delete finalHeaders["Content-Type"];
      } else if (hasFile(input)) {
        // Object or array containing File / Blob instances
        const fd = new FormData();
        objectToFormData(input, fd);
        if (extraArgs.length > 0) {
          fd.append("args", JSON.stringify(extraArgs));
        }
        body = fd;
        delete finalHeaders["Content-Type"];
      } else {
        // Standard JSON payload
        body = JSON.stringify({
          ...(input !== undefined ? { input } : {}),
          ...(extraArgs.length > 0 ? { args: extraArgs } : {}),
        });
        finalHeaders["Content-Type"] = "application/json";
      }
    }
  }

  const progressCb = onProgress;

  try {
    let response: any;
    if (
      typeof progressCb === "function" &&
      !clientOpts.fetch &&
      (method === "POST" || method === "PUT" || method === "PATCH")
    ) {
      const { progressFetch } = await import("../client/progress-fetch.js");
      response = await progressFetch(url.toString(), {
        method,
        headers: finalHeaders,
        body,
        signal: optsSignal,
        onProgress: progressCb,
      });
    } else {
      const requestConfig: any = {
        method,
        headers: finalHeaders,
        signal: optsSignal,
        ...restOpts,
      };

      if (body !== undefined) {
        requestConfig.body = body;
        requestConfig.data = body;
      }

      response = await fetchFn(url.toString(), requestConfig);
    }

    // Interceptor: onResponse
    if (clientOpts.interceptors?.onResponse) {
      const resCtx: InterceptorResponseContext = {
        response,
        procedure,
        input,
        retryCount,
        retry,
      };
      const interceptorResult = await clientOpts.interceptors.onResponse(resCtx);
      if (Array.isArray(interceptorResult)) {
        return interceptorResult as [any, any];
      }
      if (
        interceptorResult instanceof Response ||
        (interceptorResult && typeof interceptorResult.status === "number")
      ) {
        response = interceptorResult;
      }
    }

    const isStandardFetch = typeof response?.json === "function";
    const isOk =
      typeof response?.ok === "boolean"
        ? response.ok
        : typeof response?.status === "number"
          ? response.status >= 200 && response.status < 300
          : true;

    if (!isOk) {
      const errorJson = isStandardFetch
        ? await response.json().catch(() => null)
        : response?.data;
      return [
        null,
        errorJson || {
          success: false,
          message: `HTTP error! Status: ${response?.status}`,
          statusCode: response?.status || 500,
          reason: "UNEXPECTED_ERROR",
          handlerName: procedure,
        },
      ];
    }

    const data = isStandardFetch ? await response.json() : response?.data;
    return [data, null];
  } catch (error: any) {
    // If Axios or custom client threw with an HTTP response (e.g. 401)
    if (error?.response && clientOpts.interceptors?.onResponse) {
      const resCtx: InterceptorResponseContext = {
        response: error.response,
        procedure,
        input,
        retryCount,
        retry,
      };
      const interceptorResult = await clientOpts.interceptors.onResponse(resCtx);
      if (Array.isArray(interceptorResult)) {
        return interceptorResult as [any, any];
      }
    }

    // Interceptor: onError
    if (clientOpts.interceptors?.onError) {
      const errCtx: InterceptorErrorContext = {
        error,
        procedure,
        input,
        retryCount,
        retry,
      };
      const interceptorResult = await clientOpts.interceptors.onError(errCtx);
      if (Array.isArray(interceptorResult)) {
        return interceptorResult as [any, any];
      }
    }

    if (error?.response) {
      const errData = error.response.data;
      if (errData && typeof errData === "object") {
        return [null, errData];
      }
      return [
        null,
        {
          success: false,
          message: error.message || "Request failed",
          statusCode: error.response.status || 500,
          reason: "SERVER_ERROR",
          handlerName: procedure,
        },
      ];
    }
    return [
      null,
      {
        success: false,
        message: error?.message || "Network request failed",
        statusCode: 500,
        reason: "CLIENT_ERROR",
        handlerName: procedure,
      },
    ];
  }
}

function isPlainObject(val: unknown): val is Record<string, any> {
  return (
    val !== null &&
    typeof val === "object" &&
    !Array.isArray(val) &&
    !(val instanceof Blob) &&
    !(val instanceof FormData)
  );
}

export function parseHookArgs(args: any[]) {
  if (args.length === 0) {
    return { input: undefined, opts: undefined, extraArgs: [] };
  }

  const [rawOpts, ...extraArgs] = args;

  if (isPlainObject(rawOpts)) {
    const { input, ...opts } = rawOpts;
    return {
      input,
      opts: Object.keys(opts).length > 0 ? opts : undefined,
      extraArgs,
    };
  }

  return {
    input: undefined,
    opts: rawOpts,
    extraArgs,
  };
}

export function scopeQueryKey(path: string[], key?: any[]): any[] | undefined {
  if (!key) return undefined;
  const alreadyScoped =
    path.length > 0 && path.every((segment, i) => key[i] === segment);
  return alreadyScoped ? key : [...path, ...key];
}
