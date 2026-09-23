import { useIsFetching } from "../hooks/use-is-fetching.js";
import { useIsMutating } from "../hooks/use-is-mutating.js";
import { useInfiniteQuery } from "../hooks/use-infinite-query.js";
import { useMutation } from "../hooks/use-mutation.js";
import { usePaginatedQuery } from "../hooks/use-paginated-query.js";
import { useQuery } from "../hooks/use-query.js";
import { useSSEInfiniteQuery } from "../hooks/use-sse-infinite-query.js";
import { useSSE } from "../hooks/use-sse.js";
import { useSuspenseQuery } from "../hooks/use-suspense-query.js";
import { useWSInfiniteQuery } from "../hooks/use-ws-infinite-query.js";
import { useWS } from "../hooks/use-ws.js";
import { getCachedQueryClient } from "../provider.js";
import { CreateClientOptions } from "../types/client.js";
import {
  executeFetch,
  parseHookArgs,
  scopeQueryKey,
} from "./client-helpers.js";

function resolveSSEUrl(
  baseUrl: string,
  clientOpts: CreateClientOptions,
  procName: string,
): string {
  const sseBase = new URL(baseUrl, window.location.origin);
  if (clientOpts.routing === "query") {
    const sseUrl = new URL(sseBase.toString());
    sseUrl.searchParams.set("procedure", procName);
    return sseUrl.toString();
  }
  const cleanPath = sseBase.pathname.replace(/\/$/, "");
  return new URL(
    `${cleanPath}/${procName}${sseBase.search}`,
    sseBase.origin,
  ).toString();
}

function resolveWSUrl(
  baseUrl: string,
  clientOpts: CreateClientOptions,
  procName: string,
): string {
  const httpUrl = new URL(baseUrl, window.location.origin);
  const wsProto = httpUrl.protocol === "https:" ? "wss:" : "ws:";
  if (clientOpts.routing === "query") {
    return `${wsProto}//${httpUrl.host}${httpUrl.pathname}?procedure=${procName}`;
  }
  const cleanPath = httpUrl.pathname.replace(/\/$/, "");
  return `${wsProto}//${httpUrl.host}${cleanPath}/${procName}${httpUrl.search}`;
}

function buildQueryKey(
  path: string[],
  customKey: any[] | undefined,
  input: any,
  extraArgs: any[] = [],
  suffix?: string,
): any[] {
  const scoped = scopeQueryKey(path, customKey);
  if (scoped) return scoped;
  const base =
    input !== undefined
      ? [...path, input, ...extraArgs]
      : extraArgs.length > 0
        ? [...path, ...extraArgs]
        : [...path];
  return suffix ? [...base, suffix] : base;
}

function parseProcedureArgs(args: any[]): {
  input: any;
  opts: any;
  extraArgs: any[];
} {
  if (args.length === 0) {
    return { input: undefined, opts: undefined, extraArgs: [] };
  }

  const first = args[0];
  const extraArgs = args.slice(1);

  if (Array.isArray(first)) {
    return { input: undefined, opts: { queryKey: first }, extraArgs };
  }

  if (first !== null && typeof first === "object") {
    if ("queryKey" in first && Array.isArray(first.queryKey)) {
      const { input, queryKey, ...rest } = first;
      return { input, opts: { queryKey, ...rest }, extraArgs };
    }
    if ("input" in first) {
      const { input, ...rest } = first;
      return {
        input,
        opts: Object.keys(rest).length > 0 ? rest : undefined,
        extraArgs,
      };
    }
    const isHookOpts =
      "enabled" in first ||
      "onSuccess" in first ||
      "onError" in first ||
      "initialData" in first ||
      "staleTime" in first ||
      "unwrap" in first ||
      "stream" in first ||
      "ws" in first ||
      "queryOpts" in first ||
      "onData" in first ||
      "maxHistory" in first;
    if (isHookOpts) {
      return { input: undefined, opts: first, extraArgs };
    }

    return { input: first, opts: undefined, extraArgs };
  }

  return { input: first, opts: undefined, extraArgs };
}

function createInfiniteProcRunner(
  baseUrl: string,
  clientOpts: CreateClientOptions,
  procName: string,
  input: any,
  opts?: any,
  extraArgs: any[] = [],
) {
  return (pageInput: any) => {
    const resolvedInput =
      typeof input === "function"
        ? input(pageInput?.pageParam ?? pageInput?.cursor)
        : pageInput !== undefined
          ? pageInput
          : input;
    return executeFetch(
      baseUrl,
      clientOpts,
      procName,
      resolvedInput,
      { defaultMethod: "GET", ...opts },
      extraArgs,
    );
  };
}

export function createProxy(
  baseUrl: string,
  clientOpts: CreateClientOptions,
  path: string[] = [],
): any {
  const handler = function (input: any, opts?: any) {
    const directPromise = executeFetch(
      baseUrl,
      clientOpts,
      path.join("."),
      input,
      opts,
    );

    let activeSSE: any = null;

    const resultObject: any = {
      then(onfulfilled?: any, onrejected?: any) {
        return directPromise.then(onfulfilled, onrejected);
      },
      catch(onrejected?: any) {
        return directPromise.catch(onrejected);
      },
      finally(onfinally?: any) {
        return directPromise.finally(onfinally);
      },
      async *[Symbol.asyncIterator]() {
        const { SSEClient } = await import("../client/sse.js");
        const procName = path.join(".");
        const sseUrl = resolveSSEUrl(baseUrl, clientOpts, procName);
        const sseParams: Record<string, any> = {};
        if (input !== undefined) {
          sseParams.input =
            typeof input === "object" ? JSON.stringify(input) : input;
        }

        const clientHeaders =
          typeof clientOpts.headers === "function"
            ? await clientOpts.headers()
            : clientOpts.headers || {};

        activeSSE = await SSEClient({
          url: sseUrl,
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
        return (...rawArgs: any[]) => {
          const { input, opts, extraArgs } = parseHookArgs(rawArgs);
          const queryKey = buildQueryKey(
            path,
            opts?.queryKey,
            input,
            extraArgs,
          );
          return useQuery(
            () =>
              executeFetch(
                baseUrl,
                clientOpts,
                path.join("."),
                input,
                { defaultMethod: "GET", ...opts },
                extraArgs,
              ),
            {
              ...opts,
              queryKey,
            },
          );
        };
      }
      if (prop === "useSuspenseQuery") {
        return (...rawArgs: any[]) => {
          const { input, opts, extraArgs } = parseHookArgs(rawArgs);
          const queryKey = buildQueryKey(
            path,
            opts?.queryKey,
            input,
            extraArgs,
          );
          return useSuspenseQuery(
            () =>
              executeFetch(
                baseUrl,
                clientOpts,
                path.join("."),
                input,
                { defaultMethod: "GET", ...opts },
                extraArgs,
              ),
            {
              ...opts,
              queryKey,
            },
          );
        };
      }
      if (prop === "useInfiniteQuery" || prop === "usePaginatedQuery") {
        return (...rawArgs: any[]) => {
          const { input, opts, extraArgs } = parseHookArgs(rawArgs);
          const procName = path.join(".");
          const suffix =
            prop === "usePaginatedQuery" ? "paginated" : "infinite";
          const queryKey = buildQueryKey(
            path,
            opts?.queryKey,
            input,
            extraArgs,
            suffix,
          );
          const procRunner = createInfiniteProcRunner(
            baseUrl,
            clientOpts,
            procName,
            input,
            opts,
            extraArgs,
          );
          const hookOpts = {
            ...opts,
            input: typeof input === "function" ? undefined : input,
            queryKey,
          };

          return prop === "usePaginatedQuery"
            ? usePaginatedQuery(procRunner, hookOpts, ...extraArgs)
            : useInfiniteQuery(procRunner, hookOpts, ...extraArgs);
        };
      }
      if (prop === "useSSEInfiniteQuery") {
        return (...rawArgs: any[]) => {
          const { input, opts, extraArgs } = parseHookArgs(rawArgs);
          const procName = path.join(".");
          const queryKey = buildQueryKey(
            path,
            opts?.queryOpts?.queryKey,
            input,
            extraArgs,
            "infinite",
          );
          const procRunner = createInfiniteProcRunner(
            baseUrl,
            clientOpts,
            procName,
            input,
            opts?.queryOpts,
            extraArgs,
          );

          const streamTarget = opts?.stream ?? opts?.url;
          let sseUrl: string;
          if (typeof streamTarget === "string") {
            sseUrl = streamTarget;
          } else if (typeof streamTarget?.getQueryKey === "function") {
            const streamKey = streamTarget.getQueryKey();
            const streamName = Array.isArray(streamKey)
              ? streamKey.join(".")
              : String(streamKey);
            sseUrl = resolveSSEUrl(baseUrl, clientOpts, streamName);
          } else {
            sseUrl = resolveSSEUrl(baseUrl, clientOpts, procName);
          }

          const sseParams: Record<string, any> = { ...(opts?.params || {}) };
          if (input !== undefined && streamTarget === undefined) {
            sseParams.input =
              typeof input === "object" ? JSON.stringify(input) : input;
          }

          const { stream, ...restOpts } = opts || {};

          return useSSEInfiniteQuery(procRunner, {
            ...restOpts,
            url: sseUrl,
            params: sseParams,
            queryOpts: {
              ...opts?.queryOpts,
              input: typeof input === "function" ? undefined : input,
              queryKey,
            },
          });
        };
      }
      if (prop === "useWSInfiniteQuery") {
        return (...rawArgs: any[]) => {
          const { input, opts, extraArgs } = parseHookArgs(rawArgs);
          const procName = path.join(".");
          const queryKey = buildQueryKey(
            path,
            opts?.queryOpts?.queryKey,
            input,
            extraArgs,
            "infinite",
          );
          const procRunner = createInfiniteProcRunner(
            baseUrl,
            clientOpts,
            procName,
            input,
            opts?.queryOpts,
            extraArgs,
          );

          const wsTarget = opts?.ws ?? opts?.url;
          let wsUrl: string;
          if (typeof wsTarget === "string") {
            wsUrl = wsTarget;
          } else if (typeof wsTarget?.getQueryKey === "function") {
            const wsKey = wsTarget.getQueryKey();
            const wsName = Array.isArray(wsKey)
              ? wsKey.join(".")
              : String(wsKey);
            wsUrl = resolveWSUrl(baseUrl, clientOpts, wsName);
          } else {
            wsUrl = resolveWSUrl(baseUrl, clientOpts, procName);
          }

          const { ws, ...restOpts } = opts || {};

          return useWSInfiniteQuery(procRunner, {
            ...restOpts,
            url: wsUrl,
            queryOpts: {
              ...opts?.queryOpts,
              input: typeof input === "function" ? undefined : input,
              queryKey,
            },
          });
        };
      }
      if (prop === "useSSE" || prop === "useStream") {
        return (...rawArgs: any[]) => {
          const { input, opts } = parseHookArgs(rawArgs);
          const procName = path.join(".");
          const sseParams: Record<string, any> = { ...(opts?.params || {}) };
          if (input !== undefined) {
            sseParams.input =
              typeof input === "object" ? JSON.stringify(input) : input;
          }

          return useSSE({
            ...opts,
            url: opts?.url ?? resolveSSEUrl(baseUrl, clientOpts, procName),
            params: sseParams,
          });
        };
      }
      if (prop === "useWS") {
        return (...rawArgs: any[]) => {
          const { input, opts } = parseHookArgs(rawArgs);
          const procName = path.join(".");
          return useWS({
            ...opts,
            url: opts?.url ?? resolveWSUrl(baseUrl, clientOpts, procName),
            params:
              input !== undefined
                ? { input, ...(opts?.params || {}) }
                : opts?.params,
          });
        };
      }
      if (prop === "stream" || prop === "sse") {
        return (input?: any, opts?: any) => handler(input, opts);
      }
      if (prop === "useMutation") {
        return (opts?: any) => {
          const mutationKey = [...path];
          let updateProgress: ((p: number) => void) | undefined;
          return useMutation(
            (...mutationArgs: any[]) => {
              const [first, ...rest] = mutationArgs;
              return executeFetch(
                baseUrl,
                clientOpts,
                path.join("."),
                first,
                {
                  defaultMethod: "POST",
                  ...opts,
                  onProgress: (p: number) => {
                    updateProgress?.(p);
                    opts?.onProgress?.(p);
                  },
                },
                rest,
              );
            },
            {
              mutationKey,
              ...opts,
              __setProgress: (fn: (p: number) => void) => {
                updateProgress = fn;
              },
            },
          );
        };
      }
      if (prop === "invalidate") {
        return (...args: any[]) => {
          const qc = getCachedQueryClient();
          let queryKey: any[];
          if (args.length === 0) {
            queryKey = [...path];
          } else {
            const first = args[0];
            if (Array.isArray(first)) {
              queryKey = scopeQueryKey(path, first)!;
            } else if (
              first !== null &&
              typeof first === "object" &&
              "queryKey" in first &&
              Array.isArray(first.queryKey)
            ) {
              queryKey = scopeQueryKey(path, first.queryKey)!;
            } else {
              const input =
                first !== null &&
                typeof first === "object" &&
                "input" in first &&
                !Array.isArray(first)
                  ? first.input
                  : first;
              const extraArgs = args.slice(1);
              const isEmptyInput =
                input === undefined ||
                (typeof input === "object" &&
                  input !== null &&
                  Object.keys(input).length === 0);
              queryKey = !isEmptyInput
                ? [...path, input, ...extraArgs]
                : extraArgs.length > 0
                  ? [...path, ...extraArgs]
                  : [...path];
            }
          }
          qc.invalidate(queryKey);
        };
      }
      if (prop === "query" || prop === "mutate") {
        return (...args: any[]) => {
          const [first, second, ...rest] = args;
          const defaultMethod = prop === "query" ? "GET" : "POST";
          const hasOpts =
            second !== null &&
            typeof second === "object" &&
            ("method" in second ||
              "headers" in second ||
              "signal" in second ||
              "onProgress" in second);
          const opts = hasOpts
            ? { defaultMethod, ...second }
            : { defaultMethod };
          const extraArgs = hasOpts
            ? rest
            : second !== undefined
              ? [second, ...rest]
              : [];
          return executeFetch(
            baseUrl,
            clientOpts,
            path.join("."),
            first,
            opts,
            extraArgs,
          );
        };
      } else if (prop === "getQueryKey" || prop === "getMutationKey") {
        return (...rawArgs: any[]) => {
          const { input, opts, extraArgs } = parseProcedureArgs(rawArgs);
          return buildQueryKey(path, opts?.queryKey, input, extraArgs);
        };
      } else if (prop === "isFetching") {
        return (...rawArgs: any[]) => {
          const { input, opts, extraArgs } = parseProcedureArgs(rawArgs);
          const queryKey = buildQueryKey(
            path,
            opts?.queryKey,
            input,
            extraArgs,
          );
          const qc = getCachedQueryClient();
          return qc.isFetching(queryKey);
        };
      } else if (prop === "useIsFetching") {
        return (...rawArgs: any[]) => {
          const { input, opts, extraArgs } = parseProcedureArgs(rawArgs);
          const queryKey = buildQueryKey(
            path,
            opts?.queryKey,
            input,
            extraArgs,
          );
          return useIsFetching(queryKey);
        };
      } else if (prop === "isMutating") {
        return (...rawArgs: any[]) => {
          const { input, opts, extraArgs } = parseProcedureArgs(rawArgs);
          const queryKey = buildQueryKey(
            path,
            opts?.queryKey,
            input,
            extraArgs,
          );
          const qc = getCachedQueryClient();
          return qc.isMutating(queryKey);
        };
      } else if (prop === "useIsMutating") {
        return (...rawArgs: any[]) => {
          const { input, opts, extraArgs } = parseProcedureArgs(rawArgs);
          const queryKey = buildQueryKey(
            path,
            opts?.queryKey,
            input,
            extraArgs,
          );
          return useIsMutating(queryKey);
        };
      } else if (prop === "getQueryData") {
        return (...rawArgs: any[]) => {
          const { input, opts, extraArgs } = parseProcedureArgs(rawArgs);
          const queryKey = buildQueryKey(
            path,
            opts?.queryKey,
            input,
            extraArgs,
          );
          const qc = getCachedQueryClient();
          return qc.getQueryData(queryKey);
        };
      } else if (prop === "setQueryData") {
        return (...rawArgs: any[]) => {
          let input: any;
          let updater: any;
          let opts: any;
          let extraArgs: any[] = [];

          if (rawArgs.length >= 2 && typeof rawArgs[1] === "function") {
            input = rawArgs[0];
            updater = rawArgs[1];
            opts = rawArgs[2];
            extraArgs = rawArgs.slice(3);
          } else if (
            rawArgs.length >= 2 &&
            rawArgs[1] !== null &&
            typeof rawArgs[1] === "object" &&
            ("queryKey" in rawArgs[1] || "input" in rawArgs[1])
          ) {
            updater = rawArgs[0];
            input = rawArgs[1].input;
            opts = rawArgs[1];
            extraArgs = rawArgs.slice(2);
          } else if (rawArgs.length >= 2) {
            input = rawArgs[0];
            updater = rawArgs[1];
            opts = rawArgs[2];
            extraArgs = rawArgs.slice(3);
          } else {
            updater = rawArgs[0];
          }

          const queryKey = buildQueryKey(
            path,
            opts?.queryKey,
            input,
            extraArgs,
          );
          const qc = getCachedQueryClient();
          return qc.setQueryData(queryKey, updater);
        };
      } else if (prop === "prefetch" || prop === "prefetchQuery") {
        return (...rawArgs: any[]) => {
          const { input, opts, extraArgs } = parseProcedureArgs(rawArgs);
          const queryKey = buildQueryKey(
            path,
            opts?.queryKey,
            input,
            extraArgs,
          );
          const qc = getCachedQueryClient();
          return qc.prefetchQuery(
            queryKey,
            () =>
              executeFetch(
                baseUrl,
                clientOpts,
                path.join("."),
                input,
                { defaultMethod: "GET", ...opts },
                extraArgs,
              ),
            opts,
          );
        };
      } else if (prop === "reset" || prop === "resetQueries") {
        return (...rawArgs: any[]) => {
          const { input, opts, extraArgs } = parseProcedureArgs(rawArgs);
          const queryKey = buildQueryKey(
            path,
            opts?.queryKey,
            input,
            extraArgs,
          );
          const qc = getCachedQueryClient();
          qc.resetQuery(queryKey);
        };
      }

      return createProxy(baseUrl, clientOpts, [...path, prop]);
    },
  });
}
