import { globalRequestManager } from "./request-manager.js";
import type { WindowTime } from "../types/main.js";
import { normalizeKey, parseWindow } from "../lib/utils.js";
import { Timeout, QueryResult as ProcQueryResult } from "../types/misc.js";
import {
  DefaultMutationOptions,
  DefaultOptions,
  DefaultQueryOptions,
  QueryClientConfig,
  QueryState,
  QueryCacheEntry,
  MutationLogEntry,
  DehydratedQuery,
  DehydratedMutation,
  DehydratedState,
  DehydrateOptions,
  HydrateOptions,
  PrefetchQueryOptions,
} from "../types/query-client.js";

export class QueryClient {
  private cache = new Map<string, QueryState>();
  private listeners = new Map<string, Set<() => void>>();
  private invalidateListeners = new Map<string, Set<() => void>>();
  private gcTimers = new Map<string, Timeout>();
  private globalListeners = new Set<() => void>();
  private defaultOptions: DefaultOptions;
  private queryDefaults = new Map<string, DefaultQueryOptions>();
  private mutationDefaults = new Map<string, DefaultMutationOptions>();
  private maxCacheSize: number;

  constructor(config?: QueryClientConfig) {
    this.defaultOptions = {
      queries: config?.queries,
      mutations: config?.mutations,
    };
    this.maxCacheSize = config?.maxCacheSize ?? 1000;
  }

  getDefaultOptions(): DefaultOptions {
    return this.defaultOptions;
  }

  setDefaultOptions(options: DefaultOptions): void {
    this.defaultOptions = options;
  }

  getQueryDefaults(
    queryKey?: string | unknown[],
  ): DefaultQueryOptions | undefined {
    let defaults = { ...this.defaultOptions.queries };
    const normalized = normalizeKey(queryKey);
    if (normalized && this.queryDefaults.size > 0) {
      for (const [prefix, keyDefaults] of this.queryDefaults) {
        if (normalized === prefix || normalized.startsWith(prefix + "|")) {
          defaults = { ...defaults, ...keyDefaults };
        }
      }
    }
    return Object.keys(defaults).length > 0 ? defaults : undefined;
  }

  setQueryDefaults(
    queryKey: string | unknown[],
    defaults: DefaultQueryOptions,
  ): void;
  setQueryDefaults(defaults: DefaultQueryOptions): void;
  setQueryDefaults(
    keyOrDefaults: string | unknown[] | DefaultQueryOptions,
    defaults?: DefaultQueryOptions,
  ): void {
    if (typeof keyOrDefaults === "string" || Array.isArray(keyOrDefaults)) {
      const prefix = normalizeKey(keyOrDefaults);
      if (prefix) {
        this.queryDefaults.set(prefix, defaults ?? {});
      }
    } else {
      this.defaultOptions.queries = {
        ...this.defaultOptions.queries,
        ...keyOrDefaults,
      };
    }
  }

  getMutationDefaults(
    mutationKey?: string | unknown[],
  ): DefaultMutationOptions | undefined {
    let defaults = { ...this.defaultOptions.mutations };
    const normalized = normalizeKey(mutationKey);
    if (normalized && this.mutationDefaults.size > 0) {
      for (const [prefix, keyDefaults] of this.mutationDefaults) {
        if (normalized === prefix || normalized.startsWith(prefix + "|")) {
          defaults = { ...defaults, ...keyDefaults };
        }
      }
    }
    return Object.keys(defaults).length > 0 ? defaults : undefined;
  }

  setMutationDefaults(
    mutationKey: string | unknown[],
    defaults: DefaultMutationOptions,
  ): void;
  setMutationDefaults(defaults: DefaultMutationOptions): void;
  setMutationDefaults(
    keyOrDefaults: string | unknown[] | DefaultMutationOptions,
    defaults?: DefaultMutationOptions,
  ): void {
    if (typeof keyOrDefaults === "string" || Array.isArray(keyOrDefaults)) {
      const prefix = normalizeKey(keyOrDefaults);
      if (prefix) {
        this.mutationDefaults.set(prefix, defaults ?? {});
      }
    } else {
      this.defaultOptions.mutations = {
        ...this.defaultOptions.mutations,
        ...keyOrDefaults,
      };
    }
  }

  getQueryState<TData = any, TError = any>(
    queryKey: string,
  ): QueryState<TData, TError> | undefined {
    return this.cache.get(queryKey) as QueryState<TData, TError> | undefined;
  }

  setQueryState<TData = any, TError = any>(
    queryKey: string,
    state: Partial<QueryState<TData, TError>>,
    options?: { silent?: boolean },
  ) {
    const existing = this.cache.get(queryKey) || {
      data: undefined,
      error: undefined,
      isFetching: false,
      isError: false,
      isSuccess: false,
      updatedAt: 0,
      isFetched: false,
    };

    const newState = { ...existing, ...state };
    this.cache.set(queryKey, newState);
    this.pruneCache();

    // If no active observers, schedule GC so cache doesn't grow indefinitely
    if (!this.listeners.get(queryKey)?.size) {
      this.scheduleGc(queryKey);
    }

    if (!options?.silent) {
      this.notify(queryKey);
    }
  }

  /**
   * Schedules garbage collection for an inactive query key (0 active observers).
   * Does nothing if the query has active subscribers or gcTime is Infinity.
   */
  scheduleGc(queryKey: string, gcTime?: WindowTime): void {
    if (this.listeners.get(queryKey)?.size) {
      return;
    }

    this.cancelGc(queryKey);

    const defaultGc = this.getQueryDefaults(queryKey)?.gcTime;
    const resolvedGc = gcTime !== undefined ? gcTime : defaultGc;
    const gcMs = resolvedGc !== undefined ? parseWindow(resolvedGc) : 300000;

    if (gcMs === Infinity) {
      return;
    }

    const timer = setTimeout(() => {
      if (!this.listeners.get(queryKey)?.size) {
        this.cache.delete(queryKey);
        this.gcTimers.delete(queryKey);
        this.invalidateListeners.delete(queryKey);
      }
    }, gcMs);

    if (
      typeof timer === "object" &&
      timer !== null &&
      "unref" in timer &&
      typeof (timer as any).unref === "function"
    ) {
      (timer as any).unref();
    }

    this.gcTimers.set(queryKey, timer);
  }

  /**
   * Cancels any pending garbage collection timer for a query key.
   */
  cancelGc(queryKey: string): void {
    const existingGc = this.gcTimers.get(queryKey);
    if (existingGc) {
      clearTimeout(existingGc);
      this.gcTimers.delete(queryKey);
    }
  }

  /**
   * Evicts the oldest inactive queries (0 active observers) in LRU order
   * when cache entries exceed maxCacheSize.
   */
  private pruneCache(): void {
    if (this.cache.size <= this.maxCacheSize) {
      return;
    }

    const inactiveEntries: { key: string; updatedAt: number }[] = [];
    for (const [key, state] of this.cache.entries()) {
      const hasListeners = (this.listeners.get(key)?.size ?? 0) > 0;
      if (!hasListeners) {
        inactiveEntries.push({ key, updatedAt: state.updatedAt ?? 0 });
      }
    }

    // Sort ascending by updatedAt (oldest / least recently updated first)
    inactiveEntries.sort((a, b) => a.updatedAt - b.updatedAt);

    for (const entry of inactiveEntries) {
      if (this.cache.size <= this.maxCacheSize) {
        break;
      }
      this.cancelGc(entry.key);
      this.cache.delete(entry.key);
      this.invalidateListeners.delete(entry.key);
    }
  }

  subscribe(queryKey: string, listener: () => void, gcTime?: WindowTime) {
    if (!this.listeners.has(queryKey)) {
      this.listeners.set(queryKey, new Set());
    }
    this.listeners.get(queryKey)!.add(listener);

    // Cancel pending GC timeout while actively subscribed
    this.cancelGc(queryKey);

    return () => {
      const set = this.listeners.get(queryKey);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.listeners.delete(queryKey);
          this.scheduleGc(queryKey, gcTime);
        }
      }
    };
  }

  private notify(queryKey: string) {
    const set = this.listeners.get(queryKey);
    if (set) {
      set.forEach((listener) => listener());
    }
    this.globalListeners.forEach((listener) => listener());
  }

  subscribeAll(listener: () => void) {
    this.globalListeners.add(listener);
    return () => {
      this.globalListeners.delete(listener);
    };
  }

  isFetching(filterKey?: string | unknown[]): boolean {
    const prefix = Array.isArray(filterKey)
      ? filterKey.map(String).join("|")
      : filterKey;
    for (const [key, state] of this.cache) {
      if (state.isFetching) {
        if (!prefix) return true;
        if (key === prefix || key.startsWith(prefix + "|")) return true;
      }
    }
    return false;
  }

  getQueryData<TData = any>(
    queryKey:
      | string
      | unknown[]
      | { getQueryKey: (...args: any[]) => unknown[] },
  ): TData | undefined {
    const key = normalizeKey(queryKey);
    if (!key) return undefined;
    return this.cache.get(key)?.data as TData | undefined;
  }

  resetQuery(
    queryKey?:
      | string
      | unknown[]
      | { getQueryKey: (...args: any[]) => unknown[] },
  ) {
    const prefix = queryKey ? normalizeKey(queryKey) : undefined;
    const allKnownKeys = new Set([
      ...this.cache.keys(),
      ...this.listeners.keys(),
      ...this.invalidateListeners.keys(),
    ]);
    const targetKeys = prefix
      ? Array.from(allKnownKeys).filter(
          (k) => k === prefix || k.startsWith(prefix + "|"),
        )
      : Array.from(allKnownKeys);

    for (const key of targetKeys) {
      this.setQueryState(key, {
        data: undefined,
        error: undefined,
        isFetching: false,
        isError: false,
        isSuccess: false,
        updatedAt: 0,
        isFetched: false,
      });

      // Refetch active queries (matching TanStack Query resetQueries behavior)
      const hasActiveListeners = (this.listeners.get(key)?.size ?? 0) > 0;
      if (hasActiveListeners) {
        const invSet = this.invalidateListeners.get(key);
        if (invSet) {
          invSet.forEach((listener) => listener());
        }
      }
    }
  }

  resetQueries(
    queryKey?:
      | string
      | unknown[]
      | { getQueryKey: (...args: any[]) => unknown[] },
  ) {
    return this.resetQuery(queryKey);
  }

  onInvalidate(queryKey: string, listener: () => void) {
    if (!this.invalidateListeners.has(queryKey)) {
      this.invalidateListeners.set(queryKey, new Set());
    }
    this.invalidateListeners.get(queryKey)!.add(listener);

    return () => {
      const set = this.invalidateListeners.get(queryKey);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.invalidateListeners.delete(queryKey);
        }
      }
    };
  }

  invalidate<T extends unknown>(queryKeyArr: T | T[]) {
    const prefix = normalizeKey(queryKeyArr as any) ?? String(queryKeyArr);

    const matchingKeys = new Set<string>();
    for (const key of this.cache.keys()) {
      if (key === prefix || key.startsWith(prefix + "|")) {
        matchingKeys.add(key);
      }
    }
    for (const key of this.listeners.keys()) {
      if (key === prefix || key.startsWith(prefix + "|")) {
        matchingKeys.add(key);
      }
    }
    for (const key of this.invalidateListeners.keys()) {
      if (key === prefix || key.startsWith(prefix + "|")) {
        matchingKeys.add(key);
      }
    }

    for (const key of matchingKeys) {
      const state = this.cache.get(key);
      if (state) {
        // Mark as stale silently
        this.setQueryState(key, { updatedAt: 0 }, { silent: true });
      }

      // Notify invalidation listeners so they can trigger refetch
      const set = this.invalidateListeners.get(key);
      if (set) {
        set.forEach((listener) => listener());
      }
    }
  }

  /**
   * Invalidates all active queries in the cache or currently observed by mounted components.
   */
  invalidateAll(): void {
    const allKeys = new Set([
      ...this.cache.keys(),
      ...this.listeners.keys(),
      ...this.invalidateListeners.keys(),
    ]);
    for (const key of allKeys) {
      this.invalidate(key);
    }
  }

  /**
   * Clears all queries from the cache while preserving active mounted observer connections.
   */
  clearCache(): void {
    for (const timer of this.gcTimers.values()) {
      clearTimeout(timer);
    }
    this.gcTimers.clear();

    // Identify queries that currently have active mounted observers
    const activeKeys = new Set<string>();
    for (const [key, set] of this.listeners.entries()) {
      if (set.size > 0) {
        activeKeys.add(key);
      }
    }

    this.cache.clear();

    // For queries with active mounted components, re-initialize an empty state
    // so their hooks don't throw or get orphaned.
    for (const key of activeKeys) {
      this.cache.set(key, {
        data: undefined,
        error: undefined,
        isFetching: false,
        isError: false,
        isSuccess: false,
        updatedAt: 0,
        isFetched: false,
      });
    }

    // Clean up only dead listeners with 0 subscribers
    for (const [key, set] of Array.from(this.listeners.entries())) {
      if (set.size === 0) {
        this.listeners.delete(key);
        this.invalidateListeners.delete(key);
      }
    }

    // Notify observers of the cleared state
    for (const key of activeKeys) {
      this.notify(key);
    }

    this.globalListeners.forEach((listener) => listener());
  }

  /**
   * Manually removes queries from the cache matching a key, key prefix, or filter predicate.
   */
  removeQueries(
    queryKeyOrFilter?:
      | string
      | unknown[]
      | { getQueryKey: (...args: any[]) => unknown[] }
      | ((entry: QueryCacheEntry) => boolean),
  ): void {
    if (typeof queryKeyOrFilter === "function") {
      const entries = this.getCacheEntries();
      for (const entry of entries) {
        if (queryKeyOrFilter(entry)) {
          this.cancelGc(entry.queryKey);
          this.cache.delete(entry.queryKey);
          if ((this.listeners.get(entry.queryKey)?.size ?? 0) === 0) {
            this.listeners.delete(entry.queryKey);
            this.invalidateListeners.delete(entry.queryKey);
          }
        }
      }
      this.globalListeners.forEach((listener) => listener());
      return;
    }

    const prefix = normalizeKey(queryKeyOrFilter);
    if (!prefix) {
      this.clearCache();
      return;
    }

    for (const key of Array.from(this.cache.keys())) {
      if (key === prefix || key.startsWith(prefix + "|")) {
        this.cancelGc(key);
        this.cache.delete(key);
        if ((this.listeners.get(key)?.size ?? 0) === 0) {
          this.listeners.delete(key);
          this.invalidateListeners.delete(key);
        }
      }
    }
    this.globalListeners.forEach((listener) => listener());
  }

  /**
   * Returns a snapshot of all cached queries with their current state,
   * freshness status, and active subscriber counts (used by DevTools).
   */
  getCacheEntries(): QueryCacheEntry[] {
    const now = Date.now();
    const result: QueryCacheEntry[] = [];

    for (const [queryKey, state] of this.cache.entries()) {
      const defaultStale = this.getQueryDefaults(queryKey)?.staleTime;
      const staleMs =
        defaultStale !== undefined ? parseWindow(defaultStale) : 0;
      const isStale =
        state.updatedAt === 0 ||
        now - state.updatedAt > staleMs ||
        !state.isSuccess;
      const listenersCount = this.listeners.get(queryKey)?.size ?? 0;

      result.push({
        queryKey,
        state,
        isStale,
        listenersCount,
        staleTimeMs: staleMs,
      });
    }

    return result;
  }

  setQueryData<TData = any>(
    queryKey:
      | string
      | unknown[]
      | { getQueryKey: (...args: any[]) => unknown[] },
    updater: TData | ((oldData: TData | undefined) => TData),
  ): [TData | undefined, TData] {
    const key = normalizeKey(queryKey) ?? String(queryKey);
    const existing = this.getQueryState(key);
    const oldData = existing?.data as TData | undefined;

    const newData =
      typeof updater === "function"
        ? (updater as (oldData: TData | undefined) => TData)(oldData)
        : updater;

    this.setQueryState(key, {
      data: newData,
      isSuccess: true,
      updatedAt: Date.now(),
      isFetched: true,
    });

    return [oldData, newData];
  }

  async prefetchQuery<TOutput = any, TError = any>(
    options: PrefetchQueryOptions<TOutput, TError>,
  ): Promise<void>;
  async prefetchQuery<TOutput = any, TError = any>(
    queryKey:
      | string
      | unknown[]
      | { getQueryKey: (...args: any[]) => unknown[] },
    fetcher:
      | (() => Promise<ProcQueryResult<TOutput>>)
      | (() => Promise<[TOutput, null] | [null, TError]>)
      | (() => Promise<
          ([TOutput, null] | [null, TError]) & { readonly _type?: "query" }
        >)
      | (() => Promise<TOutput>)
      | (() => Promise<any>),
    opts?: { staleTime?: WindowTime },
  ): Promise<void>;
  async prefetchQuery<TOutput = any, TError = any>(
    arg1:
      | string
      | unknown[]
      | { getQueryKey: (...args: any[]) => unknown[] }
      | PrefetchQueryOptions<TOutput, TError>,
    arg2?:
      | (() => Promise<ProcQueryResult<TOutput>>)
      | (() => Promise<[TOutput, null] | [null, TError]>)
      | (() => Promise<
          ([TOutput, null] | [null, TError]) & { readonly _type?: "query" }
        >)
      | (() => Promise<TOutput>)
      | (() => Promise<any>),
    arg3?: { staleTime?: WindowTime },
  ): Promise<void> {
    let rawKey: any;
    let fetcher: (() => Promise<any>) | undefined;
    let opts: { staleTime?: WindowTime } | undefined;

    if (
      typeof arg1 === "object" &&
      arg1 !== null &&
      "queryKey" in arg1 &&
      "queryFn" in arg1
    ) {
      const options = arg1 as PrefetchQueryOptions<TOutput, TError>;
      rawKey = options.queryKey;
      fetcher = options.queryFn;
      opts = { staleTime: options.staleTime };
    } else {
      rawKey = arg1;
      fetcher = arg2;
      opts = arg3;
    }

    if (!fetcher) return;

    const queryKey = normalizeKey(rawKey);
    if (!queryKey) return;

    const existing = this.getQueryState(queryKey);

    // Check if data is already fresh
    const defaultStale = this.getQueryDefaults(queryKey)?.staleTime;
    const resolvedStale =
      opts?.staleTime !== undefined ? opts.staleTime : defaultStale;
    const staleTime =
      resolvedStale !== undefined ? parseWindow(resolvedStale) : 0;
    if (existing?.isSuccess && existing.updatedAt) {
      if (Date.now() - existing.updatedAt < staleTime) {
        return;
      }
    }

    this.setQueryState(queryKey, { isFetching: true });

    let data: any;
    let err: any = null;

    try {
      const result = await globalRequestManager.fetch(queryKey, async () => {
        return await fetcher!();
      });

      // Automatically unwrap Actyx RPC tuple returns [data, err]
      if (
        Array.isArray(result) &&
        result.length === 2 &&
        (result[1] === null || (result[0] === null && result[1] !== null))
      ) {
        data = result[0];
        err = result[1];
      } else {
        data = result;
      }
    } catch (e) {
      err = e;
    }

    if (!err) {
      this.setQueryState(queryKey, {
        data,
        error: undefined,
        isError: false,
        isSuccess: true,
        isFetching: false,
        updatedAt: Date.now(),
        isFetched: true,
      });
    } else {
      this.setQueryState(queryKey, {
        error: err,
        isError: true,
        isSuccess: false,
        isFetching: false,
        isFetched: true,
      });
    }
  }

  async prefetchInfiniteQuery<TOutput = any, TError = any>(
    options: PrefetchQueryOptions<TOutput, TError> & { initialPageParam?: any },
  ): Promise<void>;
  async prefetchInfiniteQuery<TOutput = any, TError = any>(
    queryKey:
      | string
      | unknown[]
      | { getQueryKey: (...args: any[]) => unknown[] },
    fetcher:
      | (() => Promise<ProcQueryResult<TOutput>>)
      | (() => Promise<[TOutput, null] | [null, TError]>)
      | (() => Promise<TOutput>)
      | (() => Promise<any>),
    opts?: { staleTime?: WindowTime; initialPageParam?: any },
  ): Promise<void>;
  async prefetchInfiniteQuery<TOutput = any, TError = any>(
    arg1:
      | string
      | unknown[]
      | { getQueryKey: (...args: any[]) => unknown[] }
      | (PrefetchQueryOptions<TOutput, TError> & { initialPageParam?: any }),
    arg2?:
      | (() => Promise<ProcQueryResult<TOutput>>)
      | (() => Promise<[TOutput, null] | [null, TError]>)
      | (() => Promise<TOutput>)
      | (() => Promise<any>),
    arg3?: { staleTime?: WindowTime; initialPageParam?: any },
  ): Promise<void> {
    let rawKey: any;
    let fetcher: (() => Promise<any>) | undefined;
    let opts: { staleTime?: WindowTime; initialPageParam?: any } | undefined;

    if (
      typeof arg1 === "object" &&
      arg1 !== null &&
      "queryKey" in arg1 &&
      "queryFn" in arg1
    ) {
      const options = arg1 as PrefetchQueryOptions<TOutput, TError> & {
        initialPageParam?: any;
      };
      rawKey = options.queryKey;
      fetcher = options.queryFn;
      opts = {
        staleTime: options.staleTime,
        initialPageParam: options.initialPageParam,
      };
    } else {
      rawKey = arg1;
      fetcher = arg2;
      opts = arg3;
    }

    if (!fetcher) return;

    const queryKey = normalizeKey(rawKey);
    if (!queryKey) return;

    const existing = this.getQueryState(queryKey);
    const defaultStale = this.getQueryDefaults(queryKey)?.staleTime;
    const resolvedStale =
      opts?.staleTime !== undefined ? opts.staleTime : defaultStale;
    const staleTime =
      resolvedStale !== undefined ? parseWindow(resolvedStale) : 0;
    if (existing?.isSuccess && existing.updatedAt) {
      if (Date.now() - existing.updatedAt < staleTime) {
        return;
      }
    }

    this.setQueryState(queryKey, { isFetching: true });

    let pageData: any;
    let err: any = null;

    try {
      const result = await globalRequestManager.fetch(queryKey, async () => {
        return await fetcher!();
      });

      if (
        Array.isArray(result) &&
        result.length === 2 &&
        (result[1] === null || (result[0] === null && result[1] !== null))
      ) {
        pageData = result[0];
        err = result[1];
      } else {
        pageData = result;
      }
    } catch (e) {
      err = e;
    }

    if (!err) {
      const initialParam = opts?.initialPageParam;
      const infinitePayload = {
        pages: [pageData],
        pageParams: initialParam !== undefined ? [initialParam] : [],
      };
      this.setQueryState(queryKey, {
        data: infinitePayload,
        error: undefined,
        isError: false,
        isSuccess: true,
        isFetching: false,
        updatedAt: Date.now(),
        isFetched: true,
      });

      // Mirror to suffixed key so proxy rpc.<proc>.useInfiniteQuery finds it immediately
      if (!queryKey.endsWith("|infinite")) {
        this.setQueryState(`${queryKey}|infinite`, {
          data: infinitePayload,
          error: undefined,
          isError: false,
          isSuccess: true,
          isFetching: false,
          updatedAt: Date.now(),
          isFetched: true,
        });
      }
    } else {
      this.setQueryState(queryKey, {
        error: err,
        isError: true,
        isSuccess: false,
        isFetching: false,
        isFetched: true,
      });
    }
  }

  clear() {
    this.cache.clear();
    this.listeners.clear();
    this.invalidateListeners.clear();
    this.gcTimers.forEach((timer) => clearTimeout(timer));
    this.gcTimers.clear();
  }

  // --- Mutation Tracking ---
  private activeMutations = 0;
  private activeMutationKeys = new Map<string, number>();
  private mutationListeners = new Set<() => void>();
  private mutationHistory: MutationLogEntry[] = [];
  private maxMutationHistory = 100;

  startMutation(mutationKey?: unknown[]) {
    this.activeMutations++;
    if (mutationKey) {
      const keyStr = mutationKey.map(String).join("|");
      this.activeMutationKeys.set(
        keyStr,
        (this.activeMutationKeys.get(keyStr) || 0) + 1,
      );
    }
    this.notifyMutations();
  }

  endMutation(mutationKey?: unknown[]) {
    if (this.activeMutations > 0) {
      this.activeMutations--;
    }
    if (mutationKey) {
      const keyStr = mutationKey.map(String).join("|");
      const currentCount = this.activeMutationKeys.get(keyStr) || 0;
      if (currentCount > 1) {
        this.activeMutationKeys.set(keyStr, currentCount - 1);
      } else {
        this.activeMutationKeys.delete(keyStr);
      }
    }
    this.notifyMutations();
  }

  recordMutationStart(mutationKey?: unknown[], variables?: any): string {
    const id =
      "mut_" + Math.random().toString(36).slice(2, 9) + "_" + Date.now();
    const keyStr = mutationKey
      ? mutationKey.map(String).join("|")
      : "anonymous";
    const entry: MutationLogEntry = {
      id,
      mutationKey: keyStr,
      status: "pending",
      startedAt: Date.now(),
      variables,
    };
    this.mutationHistory.unshift(entry);
    if (this.mutationHistory.length > this.maxMutationHistory) {
      this.mutationHistory.pop();
    }
    this.startMutation(mutationKey);
    return id;
  }

  recordMutationEnd(
    id: string,
    status: "success" | "error",
    data?: any,
    error?: any,
  ): void {
    const entry = this.mutationHistory.find((m) => m.id === id);
    if (entry && entry.status === "pending") {
      entry.endedAt = Date.now();
      entry.durationMs = entry.endedAt - entry.startedAt;
      entry.status = status;
      if (status === "success") {
        entry.data = data;
      } else {
        entry.error = error;
      }
      this.notifyMutations();
    }
  }

  getMutationHistory(): MutationLogEntry[] {
    return [...this.mutationHistory];
  }

  clearMutationHistory(): void {
    this.mutationHistory = [];
    this.notifyMutations();
  }

  subscribeMutations(listener: () => void) {
    this.mutationListeners.add(listener);
    return () => {
      this.mutationListeners.delete(listener);
    };
  }

  isMutating(mutationKey?: unknown[]) {
    if (mutationKey) {
      const prefix = mutationKey.map(String).join("|");
      for (const key of this.activeMutationKeys.keys()) {
        if (key === prefix || key.startsWith(prefix + "|")) {
          return true;
        }
      }
      return false;
    }
    return this.activeMutations > 0;
  }

  private notifyMutations() {
    this.mutationListeners.forEach((listener) => listener());
  }

  private normalizeQueryKey(queryKeyArr: unknown[] | string): string {
    if (typeof queryKeyArr === "string") return queryKeyArr;
    return queryKeyArr.map(String).join("|");
  }

  prepend<T>(queryKeyArr: unknown[] | string, item: T | T[]): () => void {
    const queryKey = this.normalizeQueryKey(queryKeyArr);
    const currentState = this.getQueryState(queryKey);
    const previousData = currentState?.data;
    const rollback = () => {
      this.setQueryState(queryKey, { data: previousData });
    };
    const items = Array.isArray(item) ? item : [item];

    if (!currentState || currentState.data === undefined) {
      this.setQueryState(queryKey, {
        data: items,
        isSuccess: true,
        updatedAt: Date.now(),
        isFetched: true,
      });
      return rollback;
    }

    const data = currentState.data;

    if (
      data &&
      typeof data === "object" &&
      "pages" in data &&
      Array.isArray((data as any).pages)
    ) {
      const oldPages = (data as any).pages as any[];
      let newPages: any[] = [];
      if (oldPages.length === 0) {
        newPages = [{ data: items, nextCursor: null, hasMore: false }];
      } else {
        newPages = oldPages.map((page, idx) => {
          if (idx === 0) {
            const pageData = page.data;
            if (
              pageData &&
              typeof pageData === "object" &&
              !Array.isArray(pageData)
            ) {
              return { ...page, data: { ...items[0], ...pageData } };
            }
            const arr = Array.isArray(pageData) ? pageData : [];
            return { ...page, data: [...items, ...arr] };
          }
          return page;
        });
      }
      this.setQueryState(queryKey, {
        data: {
          ...data,
          pages: newPages,
        },
        updatedAt: Date.now(),
      });
    } else {
      if (Array.isArray(data)) {
        this.setQueryState(queryKey, {
          data: [...items, ...data],
          updatedAt: Date.now(),
        });
      } else if (data && typeof data === "object") {
        this.setQueryState(queryKey, {
          data: { ...items[0], ...data },
          updatedAt: Date.now(),
        });
      }
    }

    return rollback;
  }

  append<T>(queryKeyArr: unknown[] | string, item: T | T[]): () => void {
    const queryKey = this.normalizeQueryKey(queryKeyArr);
    const currentState = this.getQueryState(queryKey);
    const previousData = currentState?.data;
    const rollback = () => {
      this.setQueryState(queryKey, { data: previousData });
    };
    const items = Array.isArray(item) ? item : [item];

    if (!currentState || currentState.data === undefined) {
      this.setQueryState(queryKey, {
        data: items,
        isSuccess: true,
        updatedAt: Date.now(),
        isFetched: true,
      });
      return rollback;
    }

    const data = currentState.data;

    if (
      data &&
      typeof data === "object" &&
      "pages" in data &&
      Array.isArray((data as any).pages)
    ) {
      const oldPages = (data as any).pages as any[];
      let newPages: any[] = [];
      if (oldPages.length === 0) {
        newPages = [{ data: items, nextCursor: null, hasMore: false }];
      } else {
        newPages = oldPages.map((page, idx) => {
          if (idx === oldPages.length - 1) {
            const pageData = page.data;
            if (
              pageData &&
              typeof pageData === "object" &&
              !Array.isArray(pageData)
            ) {
              return { ...page, data: { ...pageData, ...items[0] } };
            }
            const arr = Array.isArray(pageData) ? pageData : [];
            return { ...page, data: [...arr, ...items] };
          }
          return page;
        });
      }
      this.setQueryState(queryKey, {
        data: {
          ...data,
          pages: newPages,
        },
        updatedAt: Date.now(),
      });
    } else {
      if (Array.isArray(data)) {
        this.setQueryState(queryKey, {
          data: [...data, ...items],
          updatedAt: Date.now(),
        });
      } else if (data && typeof data === "object") {
        this.setQueryState(queryKey, {
          data: { ...data, ...items[0] },
          updatedAt: Date.now(),
        });
      }
    }

    return rollback;
  }

  insert<T>(
    queryKeyArr: unknown[] | string,
    index: number,
    item: T | T[],
  ): () => void {
    const queryKey = this.normalizeQueryKey(queryKeyArr);
    const currentState = this.getQueryState(queryKey);
    const previousData = currentState?.data;
    const rollback = () => {
      this.setQueryState(queryKey, { data: previousData });
    };

    if (!currentState || currentState.data === undefined) {
      return this.prepend(queryKey, item);
    }

    const data = currentState.data;
    const items = Array.isArray(item) ? item : [item];

    if (
      data &&
      typeof data === "object" &&
      "pages" in data &&
      Array.isArray((data as any).pages)
    ) {
      const oldPages = (data as any).pages as any[];
      if (
        oldPages.length > 0 &&
        oldPages.some((page) => !Array.isArray(page?.data))
      ) {
        return rollback;
      }

      if (oldPages.length === 0 || index <= 0) {
        return this.prepend(queryKey, items);
      }

      let targetIndex = index;
      let inserted = false;
      const totalLength = oldPages.reduce(
        (acc, p) => acc + (p.data?.length || 0),
        0,
      );

      if (targetIndex >= totalLength) {
        return this.append(queryKey, items);
      }

      const newPages = oldPages.map((page) => {
        if (inserted) return page;
        const pageLength = page.data.length;
        if (targetIndex < pageLength) {
          const newData = [...page.data];
          newData.splice(targetIndex, 0, ...items);
          inserted = true;
          return { ...page, data: newData };
        }
        targetIndex -= pageLength;
        return page;
      });

      this.setQueryState(queryKey, {
        data: {
          ...data,
          pages: newPages,
        },
      });
    } else {
      if (Array.isArray(data)) {
        if (index <= 0) {
          return this.prepend(queryKey, items);
        }
        if (index >= data.length) {
          return this.append(queryKey, items);
        }
        const newData = [...data];
        newData.splice(index, 0, ...items);
        this.setQueryState(queryKey, {
          data: newData,
          updatedAt: Date.now(),
        });
      }
    }

    return rollback;
  }

  remove(
    queryKeyArr: unknown[] | string,
    arg: number | ((item: any) => boolean),
  ): () => void {
    const queryKey = this.normalizeQueryKey(queryKeyArr);
    const currentState = this.getQueryState(queryKey);
    const previousData = currentState?.data;
    const rollback = () => {
      this.setQueryState(queryKey, { data: previousData });
    };

    if (!currentState || currentState.data === undefined) {
      return rollback;
    }

    const data = currentState.data;

    if (
      data &&
      typeof data === "object" &&
      "pages" in data &&
      Array.isArray((data as any).pages)
    ) {
      const oldPages = (data as any).pages as any[];
      if (oldPages.some((page) => !Array.isArray(page?.data))) {
        return rollback;
      }

      let newPages: any[] = [];

      if (typeof arg === "number") {
        let targetIndex = arg;
        let removed = false;

        newPages = oldPages.map((page) => {
          if (removed) return page;
          const pageLength = page.data.length;
          if (targetIndex < pageLength) {
            const newData = [...page.data];
            newData.splice(targetIndex, 1);
            removed = true;
            return { ...page, data: newData };
          }
          targetIndex -= pageLength;
          return page;
        });
      } else if (typeof arg === "function") {
        newPages = oldPages.map((page) => {
          const newData = page.data.filter((item: any) => !arg(item));
          return { ...page, data: newData };
        });
      }

      this.setQueryState(queryKey, {
        data: {
          ...data,
          pages: newPages,
        },
      });
    } else {
      if (Array.isArray(data)) {
        let newData: any[] = [];
        if (typeof arg === "number") {
          if (arg >= 0 && arg < data.length) {
            newData = [...data];
            newData.splice(arg, 1);
            this.setQueryState(queryKey, {
              data: newData,
              updatedAt: Date.now(),
            });
          }
        } else if (typeof arg === "function") {
          newData = data.filter((item) => !arg(item));
          this.setQueryState(queryKey, {
            data: newData,
            updatedAt: Date.now(),
          });
        }
      }
    }

    return rollback;
  }

  update<T>(
    queryKeyArr: unknown[] | string,
    arg: number | ((item: T) => boolean),
    updater: T | ((item: T) => T),
  ): () => void {
    const queryKey = this.normalizeQueryKey(queryKeyArr);
    const currentState = this.getQueryState(queryKey);

    if (!currentState || currentState.data === undefined) {
      return () => {};
    }

    const data = currentState.data;

    const resolveUpdater = (item: any): any => {
      //@ts-ignore
      return typeof updater === "function" ? updater(item) : updater;
    };

    // Surgical changes log
    const changes: Array<
      | { type: "flat"; index: number; originalValue: any }
      | {
          type: "pages";
          pageIndex: number;
          itemIndex: number;
          originalValue: any;
        }
    > = [];

    if (
      data &&
      typeof data === "object" &&
      "pages" in data &&
      Array.isArray((data as any).pages)
    ) {
      const oldPages = (data as any).pages as any[];
      if (oldPages.some((page) => !Array.isArray(page?.data))) {
        return () => {};
      }

      const targetIndex = typeof arg === "number" ? arg : -1;
      let updatedCount = 0;

      const newPages = oldPages.map((page, pageIndex) => {
        const newData = page.data.map((item: any, itemIndex: number) => {
          let shouldUpdate = false;
          if (typeof arg === "number") {
            if (targetIndex === updatedCount) {
              shouldUpdate = true;
            }
            updatedCount++;
          } else if (typeof arg === "function") {
            if (arg(item)) {
              shouldUpdate = true;
            }
          }

          if (shouldUpdate) {
            changes.push({
              type: "pages",
              pageIndex,
              itemIndex,
              originalValue: item,
            });
            return resolveUpdater(item);
          }
          return item;
        });
        return { ...page, data: newData };
      });

      this.setQueryState(queryKey, {
        data: {
          ...data,
          pages: newPages,
        },
      });
    } else {
      if (Array.isArray(data)) {
        let newData: any[] = [...data];
        if (typeof arg === "number") {
          if (arg >= 0 && arg < data.length) {
            changes.push({
              type: "flat",
              index: arg,
              originalValue: data[arg],
            });
            newData[arg] = resolveUpdater(data[arg]);
          }
        } else if (typeof arg === "function") {
          newData = data.map((item, index) => {
            if (arg(item)) {
              changes.push({
                type: "flat",
                index,
                originalValue: item,
              });
              return resolveUpdater(item);
            }
            return item;
          });
        }
        this.setQueryState(queryKey, {
          data: newData,
          updatedAt: Date.now(),
        });
      }
    }

    // Surgical rollback function
    const rollback = () => {
      const latestState = this.getQueryState(queryKey);
      if (!latestState || latestState.data === undefined) {
        return;
      }
      const latestData = latestState.data;

      if (
        latestData &&
        typeof latestData === "object" &&
        "pages" in latestData &&
        Array.isArray((latestData as any).pages)
      ) {
        const oldPages = (latestData as any).pages as any[];
        const newPages = oldPages.map((page, pageIndex) => {
          const newData = page.data.map((item: any, itemIndex: number) => {
            const change = changes.find(
              (c) =>
                c.type === "pages" &&
                c.pageIndex === pageIndex &&
                c.itemIndex === itemIndex,
            );
            return change ? change.originalValue : item;
          });
          return { ...page, data: newData };
        });

        this.setQueryState(queryKey, {
          data: {
            ...latestData,
            pages: newPages,
          },
        });
      } else {
        if (Array.isArray(latestData)) {
          const newData = latestData.map((item, index) => {
            const change = changes.find(
              (c) => c.type === "flat" && c.index === index,
            );
            return change ? change.originalValue : item;
          });
          this.setQueryState(queryKey, {
            data: newData,
            updatedAt: Date.now(),
          });
        }
      }
    };

    return rollback;
  }

  snapshot(queryKeyArr: unknown[] | string): () => void {
    const queryKey = this.normalizeQueryKey(queryKeyArr);
    const savedData = this.getQueryState(queryKey)?.data;
    return () => {
      this.setQueryState(queryKey, { data: savedData });
    };
  }

  /**
   * Serializes the current query cache into a plain serializable JSON object
   * suitable for passing from Server Components to Client Components.
   */
  dehydrate(options?: DehydrateOptions): DehydratedState {
    const shouldDehydrateQuery =
      options?.shouldDehydrateQuery ??
      ((entry: QueryCacheEntry) =>
        entry.state.data !== undefined && entry.state.isSuccess);

    const queries: DehydratedQuery[] = [];
    const entries = this.getCacheEntries();

    for (const entry of entries) {
      if (shouldDehydrateQuery(entry)) {
        queries.push({
          queryKey: entry.queryKey,
          data: entry.state.data,
          updatedAt: entry.state.updatedAt,
        });
      }
    }

    const mutations: DehydratedMutation[] = [];
    if (options?.shouldDehydrateMutation) {
      for (const entry of this.mutationHistory) {
        if (options.shouldDehydrateMutation(entry)) {
          mutations.push({
            id: entry.id,
            mutationKey: entry.mutationKey,
            status: entry.status,
            startedAt: entry.startedAt,
            durationMs: entry.durationMs,
            variables: entry.variables,
            data: entry.data,
          });
        }
      }
    }

    return {
      queries,
      ...(mutations.length > 0 ? { mutations } : {}),
    };
  }

  /**
   * Hydrates a serialized state snapshot into the query cache.
   * Will not overwrite client cache entries that have a newer updatedAt timestamp.
   */
  hydrate(dehydratedState: DehydratedState, options?: HydrateOptions): void {
    if (!dehydratedState || !Array.isArray(dehydratedState.queries)) {
      return;
    }

    if (options?.defaultOptions?.queries) {
      this.setDefaultOptions({
        ...this.defaultOptions,
        queries: {
          ...this.defaultOptions.queries,
          ...options.defaultOptions.queries,
        },
      });
    }

    for (const dehydratedQuery of dehydratedState.queries) {
      const existing = this.getQueryState(dehydratedQuery.queryKey);

      // Conflict resolution: don't overwrite if existing client state has a newer updatedAt
      if (
        existing &&
        existing.updatedAt &&
        existing.updatedAt >= dehydratedQuery.updatedAt
      ) {
        continue;
      }

      this.setQueryState(
        dehydratedQuery.queryKey,
        {
          data: dehydratedQuery.data,
          error: undefined,
          isError: false,
          isSuccess: true,
          isFetching: false,
          isFetched: true,
          updatedAt: dehydratedQuery.updatedAt ?? Date.now(),
        },
        { silent: true },
      );

      // Defers notification to outside the render phase so we never trigger setState in render
      if (this.listeners.get(dehydratedQuery.queryKey)?.size) {
        const key = dehydratedQuery.queryKey;
        if (typeof queueMicrotask === "function") {
          queueMicrotask(() => {
            this.notify(key);
          });
        } else {
          setTimeout(() => {
            this.notify(key);
          }, 0);
        }
      }
    }

    // Notify global cache observers (DevTools, etc.) after hydrating all queries
    if (typeof queueMicrotask === "function") {
      queueMicrotask(() => {
        this.globalListeners.forEach((listener) => listener());
      });
    } else {
      setTimeout(() => {
        this.globalListeners.forEach((listener) => listener());
      }, 0);
    }
  }
}

/**
 * Standalone helper to dehydrate a QueryClient instance into a plain JSON object.
 *
 * @example
 * ```tsx
 * // app/todos/page.tsx (Server Component)
 * const queryClient = new QueryClient();
 * await queryClient.prefetchQuery(["todos", "list"], () => appRouter.todos.list());
 *
 * return (
 *   <HydrationBoundary state={dehydrate(queryClient)}>
 *     <TodoListClient />
 *   </HydrationBoundary>
 * );
 * ```
 */
export function dehydrate(
  client: QueryClient,
  options?: DehydrateOptions,
): DehydratedState {
  return client.dehydrate(options);
}

/**
 * Standalone helper to hydrate a dehydrated state into a QueryClient.
 */
export function hydrate(
  client: QueryClient,
  dehydratedState: DehydratedState,
  options?: HydrateOptions,
): void {
  client.hydrate(dehydratedState, options);
}

/**
 * Creates a new QueryClient instance.
 */
export function createQueryClient(config?: QueryClientConfig): QueryClient {
  return new QueryClient(config);
}
