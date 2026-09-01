"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ErrorResponse, MutationResult } from "../../types/misc.js";
import type {
  MutationStatus,
  UseMutationOpts,
  UseMutationResult,
} from "../types.js";
import { useQueryClient } from "../provider.js";

/**
 * `useMutation` for a procedure (function) action.
 * `TOutput` and `TArgs` are inferred from the action's signature, so
 * `mutate` receives the exact procedure input and returns its typed data.
 */
export function useMutation<
  TOutput = unknown,
  TArgs extends any[] = any[],
  TContext = unknown,
  TMutationKey extends unknown[] = unknown[],
>(
  action: (...args: TArgs) => Promise<MutationResult<TOutput>>,
  opts?: UseMutationOpts<TOutput, TArgs, TContext, TMutationKey>,
): UseMutationResult<
  TOutput,
  TArgs,
  TContext,
  (...args: TArgs) => Promise<MutationResult<TOutput>>
>;

/**
 * `useMutation` for a URL (string) action.
 * `TOutput`/`TArgs` fall back to `unknown`/`any[]` — provide them explicitly
 * when you want the mutation return typed (e.g. `useMutation<MyData, [File]>(url)`).
 */
export function useMutation<
  TOutput = unknown,
  TArgs extends any[] = any[],
  TContext = unknown,
  TMutationKey extends unknown[] = unknown[],
>(
  action: string,
  opts?: UseMutationOpts<TOutput, TArgs, TContext, TMutationKey, string>,
): UseMutationResult<TOutput, TArgs, TContext, string>;

export function useMutation<
  TOutput = any,
  TArgs extends any[] = any[],
  TContext = unknown,
>(action: any, opts?: any): UseMutationResult<any, any, any, any> {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<MutationStatus>("idle");
  const [data, setData] = useState<TOutput | null>(null);
  const [error, setError] = useState<ErrorResponse | null>(null);
  const [validationErrors, setValidationErrors] = useState<Partial<
    Record<keyof TArgs[0], string>
  > | null>(null);
  const [context, setContext] = useState<TContext | undefined>();
  const [progress, setProgress] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingInputRef = useRef<TArgs | null>(null);
  const localId = useId();
  const generationRef = useRef(0);
  const debouncePromiseRef = useRef<{
    promise: Promise<TOutput>;
    resolve: (value: TOutput) => void;
    reject: (reason: any) => void;
  } | null>(null);

  const mutationKey = opts?.mutationKey ?? [localId];

  const callbacksRef = useRef({
    onBefore: opts?.onBefore,
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
      onBefore: opts?.onBefore,
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
    generationRef.current++;

    // Clear debounce timer and reject any pending promise
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (debouncePromiseRef.current) {
      debouncePromiseRef.current.reject(
        new DOMException("Reset", "AbortError"),
      );
      debouncePromiseRef.current = null;
    }
    pendingInputRef.current = null;

    abortControllerRef.current?.abort();
    // Only clear the ref if it's an internal controller (not user-provided)
    if (!opts?.abortController) {
      abortControllerRef.current = null;
    }

    // Release the mutation lock so the next mutate() call isn't blocked
    queryClient.endMutation(mutationKey);

    setStatus("idle");
    setData(null);
    setError(null);
    setValidationErrors(null);
    setContext(undefined);
  }, [queryClient, mutationKey]);

  const executeImmediately = useCallback(
    async (...args: TArgs): Promise<MutationResult<TOutput>> => {
      const generation = generationRef.current;

      if (mutationKey && queryClient.isMutating(mutationKey)) {
        return [
          null,
          {
            success: false,
            message: "Already in progress",
            reason: "RATE_LIMITED",
            handlerName: "client",
            statusCode: 429,
          },
        ];
      }

      if (callbacksRef.current.onBefore) {
        // onBefore hook
        try {
          const beforeResult = await callbacksRef.current.onBefore(...args);
          if (beforeResult === false) {
            return [
              null,
              {
                success: false,
                message: "Cancelled by onBefore hook",
                reason: "CLIENT_ERROR",
                handlerName: "client",
                statusCode: 400,
              },
            ];
          }
          if (beforeResult !== undefined) {
            let errObj: any;
            if (beforeResult instanceof Error) {
              errObj = {
                success: false,
                message: beforeResult.message,
                reason: "CLIENT_ERROR",
                handlerName: "client",
                statusCode: 500,
              };
            } else if (
              typeof beforeResult === "object" &&
              beforeResult !== null
            ) {
              errObj = {
                success: false,
                message:
                  (beforeResult as any).message ||
                  "Validation failed before execution",
                reason: (beforeResult as any).reason || "CLIENT_ERROR",
                handlerName: "client",
                statusCode: (beforeResult as any).statusCode || 500,
                ...beforeResult,
              };
            } else {
              errObj = {
                success: false,
                message: String(beforeResult),
                reason: "CLIENT_ERROR",
                handlerName: "client",
                statusCode: 500,
              };
            }

            setStatus("error");
            setError(errObj);
            callbacksRef.current.onError?.(errObj, undefined, ...args);
            callbacksRef.current.onSettled?.(
              undefined,
              errObj,
              undefined,
              ...args,
            );
            if (opts?.throwOnError) {
              throw beforeResult instanceof Error
                ? beforeResult
                : new Error(errObj.message);
            }
            return [null, errObj];
          }
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          const errObj = {
            success: false,
            message,
            reason: "CLIENT_ERROR",
            handlerName: "client",
            statusCode: 500,
          };
          setStatus("error");
          setError(errObj);
          callbacksRef.current.onError?.(errObj, undefined, ...args);
          callbacksRef.current.onSettled?.(
            undefined,
            errObj,
            undefined,
            ...args,
          );
          if (opts?.throwOnError) {
            throw e;
          }
          return [null, errObj];
        }
      }

      queryClient.startMutation(mutationKey);
      const input = args[0];
      // Cancel previous request
      abortControllerRef.current?.abort();

      // Use external controller if still usable, otherwise create a fresh internal one.
      // AbortController is one-shot — once aborted, signal.aborted stays true forever.
      // Falling back to internal ensures mutate() still works after the user aborts.
      const abortController =
        opts?.abortController && !opts.abortController.signal.aborted
          ? opts.abortController
          : new AbortController();
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
        setContext(() => mutationContext);
      }

      // Clear previous data if no optimistic update was applied
      if (!optimisticResult) {
        setData(null);
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
          const headers: Record<string, string> = {};

          if (
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
          } else {
            if (typeof File !== "undefined" && input instanceof File) {
              headers["x-file-name"] = input.name;
              headers["Content-Type"] =
                input.type || "application/octet-stream";
            } else if (input instanceof Blob) {
              headers["Content-Type"] =
                input.type || "application/octet-stream";
            }
          }

          const finalUrl = new URL(
            url,
            typeof window !== "undefined" ? window.location.origin : undefined,
          );

          const response = await progressFetch(finalUrl, {
            method: "POST",
            body,
            headers,
            signal: abortController.signal,
            onProgress: (p: number) => {
              setProgress(p);
              callbacksRef.current.onProgress?.(p);
            },
          });

          if (response.ok) {
            const res = await response.json();
            if (
              res &&
              typeof res === "object" &&
              "success" in res &&
              "data" in res
            ) {
              result = res.data;
            } else {
              result = res;
            }
            err = null;
          } else {
            const res = await response.json().catch(() => null);
            result = null;
            err = res || {
              success: false,
              message: `Request failed with status ${response.status}`,
              statusCode: response.status,
            };
          }
        } else {
          const res = await action(...args);
          result = res[0];
          err = res[1];
        }

        // If this request was aborted or reset, don't update state
        if (
          abortController.signal.aborted ||
          generation !== generationRef.current
        ) {
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
          const error =
            typeof err === "object"
              ? { ...err, success: false, message }
              : { message, reason: "", handlerName: "", statusCode: 500 };
          setError(error);

          if (err.reason === "VALIDATION_ERROR" && err.errors) {
            const errors = err.errors as Partial<
              Record<keyof TArgs[0], string>
            >;
            setValidationErrors(errors);
            callbacksRef.current.onValidationErrors?.(errors);
          }

          callbacksRef.current.onError?.(error, mutationContext, ...args);
          callbacksRef.current.onSettled?.(
            undefined,
            error,
            mutationContext,
            ...args,
          );

          if (opts?.throwOnError) throw err;
          return [null, err];
        }

        setStatus("success");
        setData(result);
        setValidationErrors(null);
        callbacksRef.current.onSuccess?.(result, mutationContext, ...args);
        callbacksRef.current.onSettled?.(
          result,
          undefined,
          mutationContext,
          ...args,
        );
        return [result, null];
      } catch (err) {
        // Don't treat abort or reset as error
        if (
          abortController.signal.aborted ||
          generation !== generationRef.current
        ) {
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

        const error = {
          success: false,
          message,
          reason: "CLIENT_ERROR",
          handlerName: "client",
          statusCode: 500,
        };

        setError(error);
        callbacksRef.current.onError?.(error, mutationContext, ...args);
        callbacksRef.current.onSettled?.(
          undefined,
          error,
          mutationContext,
          ...args,
        );
        throw err;
      } finally {
        // Only release the lock if reset() didn't already do it.
        // If generation changed, reset() already called endMutation.
        if (generation === generationRef.current) {
          queryClient.endMutation(mutationKey);
        }
        // Only clear the ref if it's an internal controller (not user-provided)
        if (!opts?.abortController) {
          abortControllerRef.current = null;
        }
      }
    },
    [action, opts?.throwOnError, mutationKey, queryClient],
  );

  const mutateAsync = useCallback(
    async (...args: TArgs): Promise<TOutput> => {
      // If debounce is enabled, delay execution
      if (opts?.debounceMs && opts.debounceMs > 0) {
        pendingInputRef.current = args;

        // Reuse existing pending promise if debounce cycle is active
        if (debouncePromiseRef.current) {
          clearTimeout(debounceTimerRef.current!);
          debounceTimerRef.current = setTimeout(async () => {
            const pending = debouncePromiseRef.current;
            debouncePromiseRef.current = null;
            debounceTimerRef.current = null;
            try {
              const [result, err] = await executeImmediately(
                ...(pendingInputRef.current as TArgs),
              );
              if (err) pending?.reject(err);
              else pending?.resolve(result!);
            } catch (e) {
              pending?.reject(e);
            } finally {
              pendingInputRef.current = null;
            }
          }, opts.debounceMs);
          return debouncePromiseRef.current.promise;
        }

        // First call in debounce cycle — create a new promise
        const promise = new Promise<TOutput>((resolve, reject) => {
          debouncePromiseRef.current = {
            promise: null as any,
            resolve,
            reject,
          };
          debounceTimerRef.current = setTimeout(async () => {
            const pending = debouncePromiseRef.current;
            debouncePromiseRef.current = null;
            debounceTimerRef.current = null;
            try {
              const [result, err] = await executeImmediately(
                ...(pendingInputRef.current as TArgs),
              );
              if (err) pending?.reject(err);
              else pending?.resolve(result!);
            } catch (e) {
              pending?.reject(e);
            } finally {
              pendingInputRef.current = null;
            }
          }, opts.debounceMs);
        });
        debouncePromiseRef.current!.promise = promise;
        return promise;
      }

      const [result, err] = await executeImmediately(...args);
      if (err) {
        throw err;
      }
      return result;
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
    abort: (() => {
      abortControllerRef.current?.abort();
    }) as any,
    context,
  };
}
