"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface UseClientFilterOpts<TItem> {
  filter?: (
    item: TItem,
    query: string,
    index: number,
    array: TItem[],
  ) => boolean;
  initialSearch?: string;
  isFetched?: boolean;
  /** When this key changes (e.g. `queryKey`), `search` resets to `initialSearch`. */
  resetKey?: string;
}

export interface UseClientFilterResult<TItem> {
  search: string;
  setSearch: (query: string) => void;
  resetSearch: () => void;
  isFiltered: boolean;
  unfilteredData: TItem[] | undefined;
  data: TItem[] | undefined;
  isSourceEmpty: boolean;
  isEmpty: boolean;
}

/**
 * Shared internal React hook for managing client-side search query state,
 * filtering array datasets without mutating the cache, and calculating source-safe loading states.
 */
export function useClientFilter<TItem = any>(
  unfilteredData: TItem[] | undefined,
  opts?: UseClientFilterOpts<TItem>,
): UseClientFilterResult<TItem> {
  const [search, setSearch] = useState<string>(opts?.initialSearch ?? "");
  const filterRef = useRef(opts?.filter);
  const initialSearchRef = useRef(opts?.initialSearch);
  const prevResetKeyRef = useRef(opts?.resetKey);

  filterRef.current = opts?.filter;
  initialSearchRef.current = opts?.initialSearch;

  if (
    opts?.resetKey !== undefined &&
    prevResetKeyRef.current !== opts.resetKey
  ) {
    prevResetKeyRef.current = opts.resetKey;
    const nextInitial = opts.initialSearch ?? "";
    if (search !== nextInitial) {
      setSearch(nextInitial);
    }
  }

  useEffect(() => {
    filterRef.current = opts?.filter;
    initialSearchRef.current = opts?.initialSearch;
  });

  const resetSearch = useCallback(() => {
    setSearch(initialSearchRef.current ?? "");
  }, []);

  const isFiltered = Boolean(search && search.trim().length > 0);

  const filteredData = useMemo(() => {
    if (unfilteredData === undefined) return undefined;
    const activeFilter = opts?.filter ?? filterRef.current;
    if (
      isFiltered &&
      typeof activeFilter === "function" &&
      Array.isArray(unfilteredData)
    ) {
      return unfilteredData.filter((item, index, array) =>
        activeFilter(item, search, index, array),
      );
    }
    return unfilteredData;
  }, [unfilteredData, isFiltered, search, opts?.filter]);

  const isSourceEmpty =
    opts?.isFetched === true &&
    (unfilteredData === null ||
      unfilteredData === undefined ||
      (Array.isArray(unfilteredData) && unfilteredData.length === 0));

  const isEmpty =
    opts?.isFetched === true &&
    (filteredData === null ||
      filteredData === undefined ||
      (Array.isArray(filteredData) && filteredData.length === 0));

  return {
    search,
    setSearch,
    resetSearch,
    isFiltered,
    unfilteredData,
    data: filteredData,
    isSourceEmpty,
    isEmpty,
  };
}
