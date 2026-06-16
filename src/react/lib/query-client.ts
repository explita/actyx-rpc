import { globalRequestManager } from "./request-manager.js";
import type { WindowTime } from "../../types/misc.js";
import { parseWindow } from "../../lib/utils.js";

export type QueryState<TData = any, TError = any> = {
  data: TData | undefined;
  error: TError | undefined;
  isFetching: boolean;
  isError: boolean;
  isSuccess: boolean;
  updatedAt: number;
  isFetched: boolean;
};

export class QueryClient {
  private cache = new Map<string, QueryState>();
  private listeners = new Map<string, Set<() => void>>();
  private invalidateListeners = new Map<string, Set<() => void>>();
  private gcTimers = new Map<string, NodeJS.Timeout>();

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

    if (!options?.silent) {
      this.notify(queryKey);
    }
  }

  subscribe(queryKey: string, listener: () => void, gcTime?: WindowTime) {
    if (!this.listeners.has(queryKey)) {
      this.listeners.set(queryKey, new Set());
    }
    this.listeners.get(queryKey)!.add(listener);

    // Cancel pending GC timeout
    const existingGc = this.gcTimers.get(queryKey);
    if (existingGc) {
      clearTimeout(existingGc);
      this.gcTimers.delete(queryKey);
    }

    const gcMs = gcTime !== undefined ? parseWindow(gcTime) : 300000;

    return () => {
      const set = this.listeners.get(queryKey);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.listeners.delete(queryKey);

          // Schedule GC
          const timer = setTimeout(() => {
            this.cache.delete(queryKey);
            this.gcTimers.delete(queryKey);
            this.invalidateListeners.delete(queryKey);
          }, gcMs);
          this.gcTimers.set(queryKey, timer);
        }
      }
    };
  }

  private notify(queryKey: string) {
    const set = this.listeners.get(queryKey);
    if (set) {
      set.forEach((listener) => listener());
    }
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
    const prefix = Array.isArray(queryKeyArr)
      ? queryKeyArr.map(String).join("|")
      : String(queryKeyArr);

    for (const key of this.cache.keys()) {
      if (key === prefix || key.startsWith(prefix + "|")) {
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
  }

  setQueryData<TData = any>(
    queryKeyArr: unknown[],
    updater: TData | ((oldData: TData | undefined) => TData),
  ): [TData | undefined, TData] {
    const queryKey = queryKeyArr.map(String).join("|");
    const existing = this.getQueryState(queryKey);
    const oldData = existing?.data as TData | undefined;

    const newData =
      typeof updater === "function"
        ? (updater as (oldData: TData | undefined) => TData)(oldData)
        : updater;

    this.setQueryState(queryKey, {
      data: newData,
      isSuccess: true,
      updatedAt: Date.now(),
    });

    return [oldData, newData];
  }

  async prefetchQuery<TOutput, TError = any>(
    queryKeyArr: unknown[],
    fetcher: () => Promise<[TOutput, null] | [null, TError]>,
    opts?: { staleTime?: number },
  ): Promise<void> {
    const queryKey = queryKeyArr.map(String).join("|");
    const existing = this.getQueryState(queryKey);

    // Check if data is already fresh
    const staleTime = opts?.staleTime ?? 0;
    if (existing?.isSuccess && existing.updatedAt) {
      if (Date.now() - existing.updatedAt < staleTime) {
        return;
      }
    }

    this.setQueryState(queryKey, { isFetching: true });

    const result = await globalRequestManager.fetch(queryKey, fetcher);
    const [data, err] = result as [TOutput, null] | [null, TError];

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
}
