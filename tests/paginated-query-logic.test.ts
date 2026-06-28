import { describe, it, expect } from "vitest";

// Simulates the isFetched/isSuccess initialization logic in useQuery/useInfiniteQuery/usePaginatedQuery
function initializeQueryState(initialData: any, initialPageParam?: any) {
  const resolvedInitialData =
    typeof initialData === "function" ? initialData() : initialData;
  
  return {
    data: resolvedInitialData || {
      pages: [],
      pageParams: [initialPageParam].filter(Boolean),
    },
    error: undefined,
    isFetching: false,
    isError: false,
    isSuccess: !!resolvedInitialData,
    isFetched: !!resolvedInitialData,
  };
}

// Simulates the currentPageIndex / adjustedIndex logic inside usePaginatedQuery
function getAdjustedIndex(
  pages: any[],
  currentPageIndex: number,
  setCurrentPageIndex: (idx: number) => void
) {
  let adjustedIndex = currentPageIndex;
  if (pages.length === 0) {
    if (currentPageIndex !== 0) {
      adjustedIndex = 0;
      setCurrentPageIndex(0);
    }
  } else if (currentPageIndex >= pages.length) {
    adjustedIndex = pages.length - 1;
    setCurrentPageIndex(adjustedIndex);
  } else if (currentPageIndex < 0) {
    adjustedIndex = 0;
    setCurrentPageIndex(0);
  }
  return adjustedIndex;
}

// Simulates the queryKey change logic
function handleQueryKeyChange(
  queryKey: string,
  lastKey: string,
  setLastKey: (key: string) => void,
  setCurrentPageIndex: (idx: number) => void,
  clearFetchedCursors: () => void
) {
  if (queryKey !== lastKey) {
    setLastKey(queryKey);
    setCurrentPageIndex(0);
    clearFetchedCursors();
    return true;
  }
  return false;
}

// Simulates pageParams syncing logic
function syncFetchedCursors(pageParams: any[], fetchedCursors: Set<any>) {
  for (const param of pageParams) {
    if (param !== undefined && param !== null) {
      fetchedCursors.add(param);
    }
  }
}

describe("usePaginatedQuery State & Syncing Logic", () => {
  describe("initialState helper", () => {
    it("should initialize with isFetched true if initialData is provided", () => {
      const state = initializeQueryState({ pages: [{ data: [1, 2] }], pageParams: [] });
      expect(state.isFetched).toBe(true);
      expect(state.isSuccess).toBe(true);
    });

    it("should initialize with isFetched false if no initialData is provided", () => {
      const state = initializeQueryState(null, "cursor-1");
      expect(state.isFetched).toBe(false);
      expect(state.isSuccess).toBe(false);
    });
  });

  describe("adjustedIndex bounds handling", () => {
    it("should stay at 0 if pages are empty", () => {
      let setIndexCalled = false;
      const index = getAdjustedIndex([], 2, (val) => {
        expect(val).toBe(0);
        setIndexCalled = true;
      });
      expect(index).toBe(0);
      expect(setIndexCalled).toBe(true);
    });

    it("should adjust to pages.length - 1 if index is out of bounds", () => {
      const pages = [{ data: [1] }, { data: [2] }];
      let updatedIndex = -1;
      const index = getAdjustedIndex(pages, 5, (val) => {
        updatedIndex = val;
      });
      expect(index).toBe(1);
      expect(updatedIndex).toBe(1);
    });

    it("should adjust to 0 if index is negative", () => {
      const pages = [{ data: [1] }, { data: [2] }];
      let updatedIndex = -1;
      const index = getAdjustedIndex(pages, -3, (val) => {
        updatedIndex = val;
      });
      expect(index).toBe(0);
      expect(updatedIndex).toBe(0);
    });

    it("should not call setter and return currentPageIndex if index is within bounds", () => {
      const pages = [{ data: [1] }, { data: [2] }];
      let setIndexCalled = false;
      const index = getAdjustedIndex(pages, 1, () => {
        setIndexCalled = true;
      });
      expect(index).toBe(1);
      expect(setIndexCalled).toBe(false);
    });
  });

  describe("queryKey change resetting", () => {
    it("should reset index and clear cursors if queryKey changes", () => {
      let newKey = "";
      let resetIndex = -1;
      let cleared = false;

      const changed = handleQueryKeyChange(
        "new-key",
        "old-key",
        (k) => { newKey = k; },
        (idx) => { resetIndex = idx; },
        () => { cleared = true; }
      );

      expect(changed).toBe(true);
      expect(newKey).toBe("new-key");
      expect(resetIndex).toBe(0);
      expect(cleared).toBe(true);
    });

    it("should do nothing if queryKey is identical", () => {
      let resetIndex = -1;
      const changed = handleQueryKeyChange(
        "same-key",
        "same-key",
        () => {},
        (idx) => { resetIndex = idx; },
        () => {}
      );
      expect(changed).toBe(false);
      expect(resetIndex).toBe(-1);
    });
  });

  describe("cursor syncing from pageParams", () => {
    it("should populate fetchedCursors set with all non-null cursors from pageParams", () => {
      const fetchedCursors = new Set<any>();
      syncFetchedCursors(["cursor1", null, undefined, "cursor2"], fetchedCursors);

      expect(fetchedCursors.has("cursor1")).toBe(true);
      expect(fetchedCursors.has("cursor2")).toBe(true);
      expect(fetchedCursors.size).toBe(2);
    });
  });
});
