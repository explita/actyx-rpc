"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ErrorResponse, MutationResult } from "../../types/misc.js";
import type { MutationStatus, UseMutationOpts } from "../types.js";

export function useMutation<
  TOutput,
  TArgs extends any[] = any[],
  TContext = unknown,
>(
  action: ((...args: TArgs) => Promise<MutationResult<TOutput>>) | string,
  opts?: UseMutationOpts<TOutput, TArgs, TContext>,
) {
  const [status, setStatus] = useState<MutationStatus>("idle");
  const [data, setData] = useState<TOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Partial<
    Record<keyof TArgs[0], string>
  > | null>(null);
  const [context, setContext] = useState<TContext | undefined>();
  const [progress, setProgress] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingInputRef = useRef<TArgs | null>(null);

  const callbacksRef = useRef({
    onSuccess: opts?.onSuccess,
    onError: opts?.onError,
    onMutate: opts?.onMutate,
    onSettled: opts?.onSettled,
    optimisticUpdate: opts?.optimisticUpdate,
    onProgress: opts?.onProgress,
    onValidationErrors: opts?.onValidationErrors,
  });

  useEffect(() => {
    callbacksRef.current = {
      onSuccess: opts?.onSuccess,
      onError: opts?.onError,
      onMutate: opts?.onMutate,
      onSettled: opts?.onSettled,
      optimisticUpdate: opts?.optimisticUpdate,
      onProgress: opts?.onProgress,
      onValidationErrors: opts?.onValidationErrors,
    };
  });

  const isPending = status === "pending";

  const reset = useCallback(() => {
    // Clear debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      pendingInputRef.current = null;
    }

    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setStatus("idle");
    setData(null);
    setError(null);
    setValidationErrors(null);
    setContext(undefined);
  }, []);

  const executeImmediately = useCallback(
    async (...args: TArgs): Promise<MutationResult<TOutput>> => {
      const input = args[0];
      // Cancel previous request
      abortControllerRef.current?.abort();

      // Create new abort controller
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Optimistic update
      let optimisticResult: TOutput | null = null;
      if (callbacksRef.current.optimisticUpdate) {
        //@ts-ignore
        optimisticResult = await callbacksRef.current.optimisticUpdate(...args);
        if (optimisticResult) {
          setData(optimisticResult);
          setStatus("pending");
        }
      }

      // onMutate hook
      let mutationContext: TContext | undefined;
      if (callbacksRef.current.onMutate) {
        mutationContext = await callbacksRef.current.onMutate(...args);
        setContext(mutationContext);
      }

      setStatus("pending");
      setProgress(0);
      setError(null);
      setValidationErrors(null);

      try {
        let result: any;
        let err: any;
        if (typeof action === "string") {
          // URL-based mutation for progress tracking
          const { progressFetch } =
            await import("../../client/progress-fetch.js");
          const url = action;

          let body: any = input;
          let headers: Record<string, string> = {};

          if (input instanceof File) {
            headers["x-rpc-filename"] = input.name;
          } else if (
            !(input instanceof Blob) &&
            !(input instanceof FormData) &&
            typeof input === "object" &&
            input !== null
          ) {
            // Recursive check for File/Blob instances
            const hasFile = (obj: any): boolean => {
              if (obj instanceof Blob) return true;
              if (typeof obj !== "object" || obj === null) return false;
              return Object.values(obj).some(hasFile);
            };

            if (hasFile(input)) {
              const fd = new FormData();
              const appendRecursive = (data: any, prefix = "") => {
                Object.entries(data).forEach(([key, value]) => {
                  const fullKey = prefix ? `${prefix}[${key}]` : key;
                  if (value instanceof Blob) {
                    fd.append(fullKey, value);
                  } else if (typeof value === "object" && value !== null) {
                    appendRecursive(value, fullKey);
                  } else if (value !== undefined) {
                    fd.append(fullKey, value as any);
                  }
                });
              };

              appendRecursive(input);
              body = fd;
            } else {
              body = JSON.stringify(input);
              headers["Content-Type"] = "application/json";
            }
          }

          const finalUrl = new URL(url, window.location.origin);

          const response = await progressFetch(finalUrl, {
            method: "POST",
            body,
            headers,
            onProgress: (p: number) => {
              setProgress(p);
              callbacksRef.current.onProgress?.(p);
            },
          });

          const res = await response.json();
          if (res.success) {
            result = res.data;
            err = null;
          } else {
            result = null;
            err = res;
          }
        } else {
          const res = await action(...args);
          result = res[0];
          err = res[1];
        }

        // If this request was aborted, don't update state
        if (abortController.signal.aborted) {
          // Rollback optimistic update
          if (optimisticResult) {
            setData(null);
          }
          return [
            null,
            {
              success: false,
              message: "Request aborted",
              reason: "ABORTED",
              handlerName: "client",
              statusCode: 499,
            },
          ];
        }

        if (err) {
          setStatus("error");
          const message = err?.message || "An unexpected error occurred";
          setError(message);

          if (err.reason === "VALIDATION_ERROR" && err.errors) {
            const errors = err.errors as Partial<
              Record<keyof TArgs[0], string>
            >;
            setValidationErrors(errors);
            callbacksRef.current.onValidationErrors?.(errors);
          }

          callbacksRef.current.onError?.(message, ...args);
          callbacksRef.current.onSettled?.(undefined, message, ...args);

          if (opts?.throwOnError) throw err;
          return [null, err];
        }

        setStatus("success");
        setData(result);
        setValidationErrors(null);
        callbacksRef.current.onSuccess?.(result, ...args);
        callbacksRef.current.onSettled?.(result, undefined, ...args);
        return [result, null];
      } catch (err) {
        // Don't treat abort as error
        if (abortController.signal.aborted) {
          // Rollback optimistic update
          if (optimisticResult) {
            setData(null);
          }
          return [
            null,
            {
              success: false,
              message: "Request aborted",
              reason: "ABORTED",
              handlerName: "client",
              statusCode: 499,
            },
          ];
        }

        setStatus("error");
        const message =
          err instanceof Error ? err.message : "An unexpected error occurred";
        setError(message);
        callbacksRef.current.onError?.(message, ...args);
        callbacksRef.current.onSettled?.(undefined, message, ...args);
        throw err;
      } finally {
        abortControllerRef.current = null;
      }
    },
    [action, opts?.throwOnError],
  );

  const mutateAsync = useCallback(
    async (...args: TArgs): Promise<TOutput> => {
      // Clear any existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // If debounce is enabled, delay execution
      if (opts?.debounceMs && opts.debounceMs > 0) {
        pendingInputRef.current = args;

        return new Promise((resolve, reject) => {
          debounceTimerRef.current = setTimeout(async () => {
            try {
              const [result, err] = await executeImmediately(
                ...(pendingInputRef.current as TArgs),
              );
              if (err) {
                reject(err);
              } else {
                resolve(result!);
              }
            } catch (e) {
              reject(e);
            } finally {
              pendingInputRef.current = null;
              debounceTimerRef.current = null;
            }
          }, opts.debounceMs);
        });
      }

      const [result, err] = await executeImmediately(...args);
      if (err) {
        throw err;
      }
      return result!;
    },
    [executeImmediately, opts?.debounceMs],
  );

  const mutate = useCallback(
    async (...args: TArgs): Promise<MutationResult<TOutput>> => {
      try {
        const result = await mutateAsync(...args);
        return [result, null];
      } catch (error) {
        return [null, error as ErrorResponse];
      }
    },
    [mutateAsync],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    mutate,
    mutateAsync,
    isPending,
    status,
    data,
    error,
    validationErrors,
    progress,
    reset,
    abort: () => abortControllerRef.current?.abort(),
    context,
  };
}
