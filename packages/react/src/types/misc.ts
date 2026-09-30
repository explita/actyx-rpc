import { ErrorResponse } from "./main.js";

/**
 * A query result tuple returned by RPC query procedures.
 *
 * Returns `[data, null]` on success or `[null, error]` on failure.
 * Carries phantom type brands (`_type`, `_input`, `_args`) for type-level inference
 * in hooks and client proxy types.
 *
 * @template T - The resolved data type on success.
 * @template TInput - The validated input type (phantom brand for inference).
 * @template TArgs - Extra positional arguments tuple (phantom brand for inference).
 */
export type QueryResult<
  T = unknown,
  TInput = undefined,
  TArgs extends unknown[] = unknown[],
> = (
  | [T, null]
  | [null, ErrorResponse]
) & {
  readonly _type?: "query";
  readonly _input?: TInput;
  readonly _args?: TArgs;
};

/**
 * A mutation result tuple returned by RPC mutation procedures.
 *
 * Returns `[data, null]` on success or `[null, error]` on failure.
 * Carries phantom type brands (`_type`, `_input`, `_args`) for type-level inference
 * in hooks and client proxy types.
 *
 * @template T - The resolved data type on success.
 * @template TInput - The validated input type (phantom brand for inference).
 * @template TArgs - Extra positional arguments tuple (phantom brand for inference).
 */
export type MutationResult<
  T = unknown,
  TInput = undefined,
  TArgs extends unknown[] = unknown[],
> = (
  | [T, null]
  | [null, ErrorResponse]
) & {
  readonly _type?: "mutation";
  readonly _input?: TInput;
  readonly _args?: TArgs;
};

/** Portable timer handle returned by `setTimeout`. */
export type Timeout = ReturnType<typeof setTimeout>;

/**
 * Shape of a Server-Sent Events (SSE) message yielded by streaming procedures.
 *
 * Maps directly to the SSE wire format: `event:`, `data:`, `id:`, and `retry:` fields.
 * Carries a phantom `_input` brand for type-level input inference in client proxy types.
 *
 * @template T - The parsed event data payload type.
 * @template TInput - The validated input type (phantom brand for inference).
 */
export type SSEEvent<T = any, TInput = undefined> = {
  /** Optional named event type (maps to SSE `event:` field). */
  event?: string;
  /** The parsed event data payload. */
  data: T;
  /** Optional event ID for resumption (maps to SSE `id:` field). */
  id?: string;
  /** Optional reconnection delay hint in milliseconds (maps to SSE `retry:` field). */
  retry?: number;
  readonly _input?: TInput;
};
