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

  private normalizeQueryKey(queryKeyArr: unknown[] | string): string {
    if (typeof queryKeyArr === "string") return queryKeyArr;
    return queryKeyArr.map(String).join("|");
  }

  prepend<T>(queryKeyArr: unknown[] | string, item: T): () => void {
    const queryKey = this.normalizeQueryKey(queryKeyArr);
    const currentState = this.getQueryState(queryKey);
    const previousData = currentState?.data;
    const rollback = () => {
      this.setQueryState(queryKey, { data: previousData });
    };

    if (!currentState || currentState.data === undefined) {
      this.setQueryState(queryKey, {
        data: [item],
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
        newPages = [{ data: [item], nextCursor: null, hasMore: false }];
      } else {
        newPages = oldPages.map((page, idx) => {
          if (idx === 0) {
            const pageData = page.data;
            if (
              pageData &&
              typeof pageData === "object" &&
              !Array.isArray(pageData)
            ) {
              return { ...page, data: { ...item, ...pageData } };
            }
            const arr = Array.isArray(pageData) ? pageData : [];
            return { ...page, data: [item, ...arr] };
          }
          return page;
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
        this.setQueryState(queryKey, {
          data: [item, ...data],
          updatedAt: Date.now(),
        });
      } else if (data && typeof data === "object") {
        this.setQueryState(queryKey, {
          data: { ...item, ...data },
          updatedAt: Date.now(),
        });
      }
    }

    return rollback;
  }

  append<T>(queryKeyArr: unknown[] | string, item: T): () => void {
    const queryKey = this.normalizeQueryKey(queryKeyArr);
    const currentState = this.getQueryState(queryKey);
    const previousData = currentState?.data;
    const rollback = () => {
      this.setQueryState(queryKey, { data: previousData });
    };

    if (!currentState || currentState.data === undefined) {
      this.setQueryState(queryKey, {
        data: [item],
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
        newPages = [{ data: [item], nextCursor: null, hasMore: false }];
      } else {
        newPages = oldPages.map((page, idx) => {
          if (idx === oldPages.length - 1) {
            const pageData = page.data;
            if (
              pageData &&
              typeof pageData === "object" &&
              !Array.isArray(pageData)
            ) {
              return { ...page, data: { ...pageData, ...item } };
            }
            const arr = Array.isArray(pageData) ? pageData : [];
            return { ...page, data: [...arr, item] };
          }
          return page;
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
        this.setQueryState(queryKey, {
          data: [...data, item],
          updatedAt: Date.now(),
        });
      } else if (data && typeof data === "object") {
        this.setQueryState(queryKey, {
          data: { ...data, ...item },
          updatedAt: Date.now(),
        });
      }
    }

    return rollback;
  }

  insert<T>(
    queryKeyArr: unknown[] | string,
    index: number,
    item: T,
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
        return this.prepend(queryKey, item);
      }

      let targetIndex = index;
      let inserted = false;
      const totalLength = oldPages.reduce(
        (acc, p) => acc + (p.data?.length || 0),
        0,
      );

      if (targetIndex >= totalLength) {
        return this.append(queryKey, item);
      }

      const newPages = oldPages.map((page) => {
        if (inserted) return page;
        const pageLength = page.data.length;
        if (targetIndex < pageLength) {
          const newData = [...page.data];
          newData.splice(targetIndex, 0, item);
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
          return this.prepend(queryKey, item);
        }
        if (index >= data.length) {
          return this.append(queryKey, item);
        }
        const newData = [...data];
        newData.splice(index, 0, item);
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
    const previousData = currentState?.data;
    const rollback = () => {
      this.setQueryState(queryKey, { data: previousData });
    };

    if (!currentState || currentState.data === undefined) {
      return rollback;
    }

    const data = currentState.data;

    const resolveUpdater = (item: any): any => {
      //@ts-ignore
      return typeof updater === "function" ? updater(item) : updater;
    };

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
        let updated = false;

        newPages = oldPages.map((page) => {
          if (updated) return page;
          const pageLength = page.data.length;
          if (targetIndex < pageLength) {
            const newData = [...page.data];
            newData[targetIndex] = resolveUpdater(newData[targetIndex]);
            updated = true;
            return { ...page, data: newData };
          }
          targetIndex -= pageLength;
          return page;
        });
      } else if (typeof arg === "function") {
        newPages = oldPages.map((page) => {
          const newData = page.data.map((item: any) => {
            if (arg(item)) {
              return resolveUpdater(item);
            }
            return item;
          });
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
            newData[arg] = resolveUpdater(newData[arg]);
            this.setQueryState(queryKey, {
              data: newData,
              updatedAt: Date.now(),
            });
          }
        } else if (typeof arg === "function") {
          newData = data.map((item) => {
            if (arg(item)) {
              return resolveUpdater(item);
            }
            return item;
          });
          this.setQueryState(queryKey, {
            data: newData,
            updatedAt: Date.now(),
          });
        }
      }
    }

    return rollback;
  }

  snapshot(queryKeyArr: unknown[] | string): () => void {
    const queryKey = this.normalizeQueryKey(queryKeyArr);
    const savedData = this.getQueryState(queryKey)?.data;
    return () => {
      this.setQueryState(queryKey, { data: savedData });
    };
  }
}
