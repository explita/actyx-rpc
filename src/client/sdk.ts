"use client";

import type { ErrorResponse, SSEEvent, MutationResult } from "../types/misc.js";
import type {
  QueryResult,
  UseQueryOpts,
  UseMutationOpts,
  InfiniteQueryResult,
  UseInfiniteQueryOpts,
  UseSuspenseQueryResult,
} from "../react/types.js";
import {
  useQuery,
  useSuspenseQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "../react/index.js";

export interface CreateClientOptions {
  baseUrl: string;
  headers?:
    | Record<string, string>
    | (() => Record<string, string> | Promise<Record<string, string>>);
  fetch?: typeof fetch;
}

export type ClientQueryCall<I, O> = [I] extends [void] | [undefined] | [never]
  ? {
      useQuery: <TUnwrap extends boolean = false, TSelectData = O>(
        input?: undefined,
        opts?: UseQueryOpts<O, unknown[], TUnwrap, TSelectData>,
      ) => QueryResult<O, undefined, TUnwrap, TSelectData>;
      useSuspenseQuery: <TUnwrap extends boolean = false, TSelectData = O>(
        // input?: undefined,
        opts?: UseQueryOpts<O, unknown[], TUnwrap, TSelectData>,
      ) => UseSuspenseQueryResult<O, TUnwrap, TSelectData>;
      useInfiniteQuery: (
        input?: undefined,
        opts?: UseInfiniteQueryOpts<O, any>,
      ) => InfiniteQueryResult<any>;
      invalidate: (input?: undefined) => void;
      fetch: (
        input?: undefined,
        opts?: any,
      ) => Promise<[O, ErrorResponse | null]>;
      (
        input?: undefined,
        opts?: any,
      ): Promise<[O, ErrorResponse | null]> &
        AsyncIterable<O> & { close: () => void };
    }
  : {
      useQuery: <TUnwrap extends boolean = false, TSelectData = O>(
        input: I,
        opts?: UseQueryOpts<O, unknown[], TUnwrap, TSelectData>,
      ) => QueryResult<O, undefined, TUnwrap, TSelectData>;
      useSuspenseQuery: <TUnwrap extends boolean = false, TSelectData = O>(
        input: I,
        opts?: UseQueryOpts<O, unknown[], TUnwrap, TSelectData>,
      ) => QueryResult<O, undefined, TUnwrap, TSelectData>;
      useInfiniteQuery: (
        input: I,
        opts?: UseInfiniteQueryOpts<I, O>,
      ) => InfiniteQueryResult<O>;
      invalidate: (input?: I) => void;
      fetch: (input: I, opts?: any) => Promise<[O, ErrorResponse | null]>;
      (
        input: I,
        opts?: any,
      ): Promise<[O, ErrorResponse | null]> &
        AsyncIterable<O> & { close: () => void };
    };

export type ClientMutationCall<I, O> = [I] extends
  | [void]
  | [undefined]
  | [never]
  ? {
      useMutation: <TContext = unknown>(
        opts?: UseMutationOpts<O, [undefined], TContext>,
      ) => {
        mutate: (input?: undefined) => Promise<MutationResult<O>>;
        mutateAsync: (input?: undefined) => Promise<O>;
        isPending: boolean;
        status: string;
        data: O | null;
        error: ErrorResponse | null;
        reset: () => void;
        abort: () => void;
        context: TContext | undefined;
      };
      fetch: (
        input?: undefined,
        opts?: any,
      ) => Promise<[O, ErrorResponse | null]>;
      (input?: undefined, opts?: any): Promise<[O, ErrorResponse | null]>;
    }
  : {
      useMutation: <TContext = unknown>(
        opts?: UseMutationOpts<O, [I], TContext>,
      ) => {
        mutate: (input: I) => Promise<MutationResult<O>>;
        mutateAsync: (input: I) => Promise<O>;
        isPending: boolean;
        status: string;
        data: O | null;
        error: ErrorResponse | null;
        reset: () => void;
        abort: () => void;
        context: TContext | undefined;
      };
      fetch: (input: I, opts?: any) => Promise<[O, ErrorResponse | null]>;
      (input: I, opts?: any): Promise<[O, ErrorResponse | null]>;
    };

export type ClientProxy<T> = {
  [K in keyof T]: T[K] extends {
    _def: { type: "query"; input: infer I; output: infer O };
  }
    ? ClientQueryCall<I, O>
    : T[K] extends {
          _def: { type: "mutation"; input: infer I; output: infer O };
        }
      ? ClientMutationCall<I, O>
      : T[K] extends {
            _def: { type: "stream"; input: infer I; output: infer O };
          }
        ? [I] extends [void] | [undefined] | [never]
          ? (input?: undefined) => AsyncIterable<O> & { close: () => void }
          : (input: I) => AsyncIterable<O> & { close: () => void }
        : T[K] extends {
              _def: { type: "sse"; input: infer I; output: infer O };
            }
          ? [I] extends [void] | [undefined] | [never]
            ? (
                input?: undefined,
              ) => AsyncIterable<SSEEvent<O>> & { close: () => void }
            : (input: I) => AsyncIterable<SSEEvent<O>> & { close: () => void }
          : ClientProxy<T[K]>;
};

async function executeFetch(
  baseUrl: string,
  clientOpts: CreateClientOptions,
  procedure: string,
  input: any,
  opts?: any,
  router?: any,
): Promise<[any, any]> {
  const activeRouter =
    router ||
    (typeof globalThis !== "undefined"
      ? (globalThis as any).__ACTYX_RPC_ROUTER__
      : undefined);
  if (activeRouter && typeof window === "undefined" && !clientOpts.fetch) {
    const path = procedure.split(".");
    let current = activeRouter;
    for (const segment of path) {
      if (current && typeof current === "object") {
        current = current[segment];
      } else {
        current = undefined;
        break;
      }
    }
    if (typeof current === "function") {
      try {
        return await current(input, opts);
      } catch (error: any) {
        return [
          null,
          {
            success: false,
            message: error.message || "Local execution failed",
            statusCode: 500,
            reason: "SERVER_ERROR",
            handlerName: procedure,
          },
        ];
      }
    }
  }

  const fetchFn = clientOpts.fetch || globalThis.fetch;
  const headers =
    typeof clientOpts.headers === "function"
      ? await clientOpts.headers()
      : clientOpts.headers || {};

  const url = new URL(
    baseUrl,
    typeof window !== "undefined" ? window.location.origin : undefined,
  );
  url.searchParams.set("procedure", procedure);

  let body: any = undefined;
  const finalHeaders: Record<string, string> = {
    ...headers,
    ...opts?.headers,
  };

  if (input !== undefined) {
    if (
      !(input instanceof Blob) &&
      !(input instanceof FormData) &&
      typeof input === "object" &&
      input !== null
    ) {
      body = JSON.stringify({ input });
      finalHeaders["Content-Type"] = "application/json";
    } else {
      body = input;
      if (typeof File !== "undefined" && input instanceof File) {
        finalHeaders["x-file-name"] = input.name;
        finalHeaders["Content-Type"] = input.type || "application/octet-stream";
      } else if (input instanceof Blob) {
        finalHeaders["Content-Type"] = input.type || "application/octet-stream";
      }
    }
  }

  try {
    const response = await fetchFn(url.toString(), {
      method: "POST",
      body,
      headers: finalHeaders,
      signal: opts?.signal,
      ...opts,
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => null);
      return [
        null,
        errorJson || {
          success: false,
          message: `HTTP error! Status: ${response.status}`,
          statusCode: response.status,
          reason: "UNEXPECTED_ERROR",
          handlerName: procedure,
        },
      ];
    }

    const data = await response.json();
    return [data, null];
  } catch (error: any) {
    return [
      null,
      {
        success: false,
        message: error.message || "Network request failed",
        statusCode: 500,
        reason: "CLIENT_ERROR",
        handlerName: procedure,
      },
    ];
  }
}

function createProxy(
  baseUrl: string,
  clientOpts: CreateClientOptions,
  path: string[] = [],
  router?: any,
): any {
  const handler = function (input: any, opts?: any) {
    const directPromise = executeFetch(
      baseUrl,
      clientOpts,
      path.join("."),
      input,
      opts,
      router,
    );

    let activeSSE: any = null;

    const resultObject: any = {
      then(onfulfilled?: any, onrejected?: any) {
        return directPromise.then(onfulfilled, onrejected);
      },
      async *[Symbol.asyncIterator]() {
        const activeRouter =
          router ||
          (typeof globalThis !== "undefined"
            ? (globalThis as any).__ACTYX_RPC_ROUTER__
            : undefined);
        if (
          activeRouter &&
          typeof window === "undefined" &&
          !clientOpts.fetch
        ) {
          let current = activeRouter;
          for (const segment of path) {
            if (current && typeof current === "object") {
              current = current[segment];
            } else {
              current = undefined;
              break;
            }
          }
          if (typeof current === "function") {
            try {
              yield* current(input, opts);
              return;
            } catch (error) {
              yield { error };
              return;
            }
          }
        }

        const { SSEClient } = await import("./sse.js");
        const sseUrl = new URL(
          baseUrl,
          typeof window !== "undefined" ? window.location.origin : undefined,
        );
        sseUrl.searchParams.set("procedure", path.join("."));

        const sseParams = {
          procedure: path.join("."),
          input: JSON.stringify(input),
        };

        const clientHeaders =
          typeof clientOpts.headers === "function"
            ? await clientOpts.headers()
            : clientOpts.headers || {};

        activeSSE = await SSEClient({
          url: sseUrl.toString(),
          params: sseParams,
          headers: {
            ...clientHeaders,
            ...opts?.headers,
          },
          signal: opts?.signal,
        });

        try {
          for await (const event of activeSSE) {
            yield event.event !== undefined ? event : event.data;
          }
        } finally {
          activeSSE?.close?.();
        }
      },
      close() {
        activeSSE?.close?.();
      },
    };

    return resultObject;
  };

  return new Proxy(handler, {
    get(target, prop, receiver) {
      if (typeof prop !== "string") {
        return Reflect.get(target, prop, receiver);
      }

      if (prop === "useQuery") {
        return (input: any, opts?: any) => {
          const queryKey = [...path, input];
          return useQuery(
            () =>
              executeFetch(
                baseUrl,
                clientOpts,
                path.join("."),
                input,
                undefined,
                router,
              ),
            {
              queryKey,
              ...opts,
            },
          );
        };
      }
      if (prop === "useSuspenseQuery") {
        return (input: any, opts?: any) => {
          const queryKey = [...path, input];
          return useSuspenseQuery(
            () =>
              executeFetch(
                baseUrl,
                clientOpts,
                path.join("."),
                input,
                undefined,
                router,
              ),
            {
              queryKey,
              ...opts,
            },
          );
        };
      }
      if (prop === "useInfiniteQuery") {
        return (input: any, opts?: any) => {
          const queryKey = [...path, input];
          return useInfiniteQuery(
            () =>
              executeFetch(
                baseUrl,
                clientOpts,
                path.join("."),
                input,
                undefined,
                router,
              ),
            {
              queryKey,
              ...opts,
            },
          );
        };
      }
      if (prop === "useMutation") {
        return (opts?: any) => {
          const mutationKey = [...path];
          return useMutation(
            (input: any) =>
              executeFetch(
                baseUrl,
                clientOpts,
                path.join("."),
                input,
                undefined,
                router,
              ),
            {
              mutationKey,
              ...opts,
            },
          );
        };
      }
      if (prop === "invalidate") {
        return (input?: any) => {
          try {
            const queryClient = useQueryClient();
            const queryKey = input !== undefined ? [...path, input] : [...path];
            queryClient.invalidate(queryKey);
          } catch (e) {
            console.warn(
              "invalidate was called outside of React Context or QueryProvider",
              e,
            );
          }
        };
      }
      if (prop === "fetch") {
        return (input: any, opts?: any) => {
          return executeFetch(
            baseUrl,
            clientOpts,
            path.join("."),
            input,
            opts,
            router,
          );
        };
      }

      return createProxy(baseUrl, clientOpts, [...path, prop], router);
    },
  });
}

export function createClient<TRouter>(
  router: TRouter,
  options?: CreateClientOptions,
): ClientProxy<TRouter>;
export function createClient<TRouter>(
  options: CreateClientOptions,
): ClientProxy<TRouter>;
export function createClient<TRouter>(
  routerOrOptions: any,
  options?: CreateClientOptions,
): ClientProxy<TRouter> {
  let opts: CreateClientOptions;
  let router: any = undefined;

  if (
    routerOrOptions &&
    typeof routerOrOptions === "object" &&
    "baseUrl" in routerOrOptions
  ) {
    opts = routerOrOptions;
  } else {
    router = routerOrOptions;
    opts = {
      baseUrl: "/api/rpc",
      ...options,
    };
  }
  return createProxy(opts.baseUrl, opts, [], router) as ClientProxy<TRouter>;
}
