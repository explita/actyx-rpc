import { ErrorResponse } from "./main.js";

export type QueryResult<T = unknown> = [T, null] | [null, ErrorResponse];

export type Timeout = ReturnType<typeof setTimeout>;

export type SSEEvent<T = any> = {
  event?: string;
  data: T;
  id?: string;
  retry?: number;
};
