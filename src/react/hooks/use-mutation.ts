"use client";

import { useEffect, useRef, useState } from "react";
import type { ErrorResponse, MutationResult } from "../../types/misc.js";
import type { MutationStatus, UseMutationOpts } from "../types.js";

export function useMutation<
  TOutput,
  TInput = any,
  TArgs = any,
  TContext = unknown,
>(
  action: (formData: TInput, args?: TArgs) => Promise<MutationResult<TOutput>>,
  opts?: UseMutationOpts<TOutput, TInput, TContext>,
) {
  const [status, setStatus] = useState<MutationStatus>("idle");
  const [data, setData] = useState<TOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Partial<
    Record<keyof TInput, string>
  > | null>(null);
  const [context, setContext] = useState<TContext | undefined>();
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingInputRef = useRef<{ input: TInput; args?: TArgs } | null>(null);

  const isPending = status === "pending";

  const reset = () => {
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
  };

  const executeImmediately = async (
    input: TInput,
    args?: TArgs,
  ): Promise<MutationResult<TOutput>> => {
    // Cancel previous request
    abortControllerRef.current?.abort();

    // Create new abort controller
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Optimistic update
    let optimisticResult: TOutput | null = null;
    if (opts?.optimisticUpdate) {
      //@ts-ignore
      optimisticResult = await opts.optimisticUpdate(input);
      if (optimisticResult) {
        setData(optimisticResult);
        setStatus("pending");
      }
    }

    // onMutate hook
    let mutationContext: TContext | undefined;
    if (opts?.onMutate) {
      mutationContext = await opts.onMutate(input);
      setContext(mutationContext);
    }

    setStatus("pending");
    setError(null);
    setValidationErrors(null);

    try {
      const [result, err] = await action(input, args);

      // If this request was aborted, don't update state
      if (abortController.signal.aborted) {
        // Rollback optimistic update
        if (optimisticResult) {
          setData(null);
        }
        return [
          null,
          { success: false, message: "Request aborted", reason: "ABORTED" },
        ];
      }

      if (err) {
        setStatus("error");
        const message = err?.message || "An unexpected error occurred";
        setError(message);

        if (err.errors) {
          const errors = err.errors as Partial<Record<keyof TInput, string>>;
          setValidationErrors(errors);
          opts?.onValidationErrors?.(errors);
        }

        opts?.onError?.(message, input, mutationContext);
        opts?.onSettled?.(undefined, message, input, mutationContext);

        if (opts?.throwOnError) throw err;
        return [null, err];
      }

      setStatus("success");
      setData(result);
      setValidationErrors(null);
      opts?.onSuccess?.(result, input, mutationContext);
      opts?.onSettled?.(result, undefined, input, mutationContext);
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
          { success: false, message: "Request aborted", reason: "ABORTED" },
        ];
      }

      setStatus("error");
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
      opts?.onError?.(message, input, mutationContext);
      opts?.onSettled?.(undefined, message, input, mutationContext);
      throw err;
    } finally {
      abortControllerRef.current = null;
    }
  };

  const mutateAsync = async (input: TInput, args?: TArgs): Promise<TOutput> => {
    // Clear any existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // If debounce is enabled, delay execution
    if (opts?.debounceMs && opts.debounceMs > 0) {
      pendingInputRef.current = { input, args };

      return new Promise((resolve, reject) => {
        debounceTimerRef.current = setTimeout(async () => {
          try {
            const [result, err] = await executeImmediately(
              pendingInputRef.current!.input,
              pendingInputRef.current!.args,
            );
            if (err) throw err;
            resolve(result);
          } catch (error) {
            reject(error);
          } finally {
            pendingInputRef.current = null;
            debounceTimerRef.current = null;
          }
        }, opts.debounceMs);
      });
    }

    // No debounce, execute immediately
    const [result, err] = await executeImmediately(input, args);
    if (err) throw err;
    return result;
  };

  const mutate = async (
    input: TInput,
    args?: TArgs,
  ): Promise<MutationResult<TOutput>> => {
    try {
      const result = await mutateAsync(input, args);
      return [result, null];
    } catch (error) {
      return [null, error as ErrorResponse];
    }
  };

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
    reset,
    abort: () => abortControllerRef.current?.abort(),
    context,
  };
}
