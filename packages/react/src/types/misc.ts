import { ErrorResponse } from "./main.js";

export type QueryResult<T = unknown, TInput = undefined> = (
  | [T, null]
  | [null, ErrorResponse]
) & {
  readonly _type?: "query";
  readonly _input?: TInput;
};

export type MutationResult<T = unknown, TInput = undefined> = (
  | [T, null]
  | [null, ErrorResponse]
) & {
  readonly _type?: "mutation";
  readonly _input?: TInput;
};

export type Timeout = ReturnType<typeof setTimeout>;

export type SSEEvent<T = any, TInput = undefined> = {
  event?: string;
  data: T;
  id?: string;
  retry?: number;
  readonly _input?: TInput;
};
