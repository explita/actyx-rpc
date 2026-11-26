import { describe, it, expect } from "vitest";
import { defaultExtractTypingUser } from "../../packages/react/src/lib/ws-helpers.js";

// Mocking the logic used in use-query.ts
function performUnwrap(result: any, unwrap: boolean) {
  if (unwrap === true && result && "data" in result) {
    return result.data;
  }
  return result;
}

describe("RPC Hook Unwrapping Logic", () => {
  it("should unwrap standard RPC response when unwrap is true", () => {
    const result = { success: true, data: { id: 1, name: "Test" } };
    const unwrapped = performUnwrap(result, true);
    expect(unwrapped).toEqual({ id: 1, name: "Test" });
  });

  it("should NOT unwrap when unwrap is false", () => {
    const result = { success: true, data: { id: 1, name: "Test" } };
    const unwrapped = performUnwrap(result, false);
    expect(unwrapped).toEqual(result);
  });

  it("should handle responses without a data field gracefully", () => {
    const result = { success: true, other: "field" };
    const unwrapped = performUnwrap(result, true);
    expect(unwrapped).toEqual(result);
  });

  it("should handle null/undefined results", () => {
    expect(performUnwrap(null, true)).toBeNull();
    expect(performUnwrap(undefined, true)).toBeUndefined();
  });

  it("should unwrap even if success is missing (loosened logic)", () => {
    const result = { data: { message: "hello" } };
    const unwrapped = performUnwrap(result, true);
    expect(unwrapped).toEqual({ message: "hello" });
  });
});

function mockRemove(oldPages: any[], arg: number | ((item: any) => boolean)) {
  if (oldPages.some(page => !Array.isArray(page?.data))) {
    return oldPages;
  }
  let newPages = [];
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
  return newPages;
}

describe("remove Cache Logic", () => {
  const setupPages = () => [
    { data: ["a", "b", "c"], nextCursor: 2 },
    { data: ["d", "e"], nextCursor: 3 },
  ];

  it("should remove item by index from the first page", () => {
    const pages = setupPages();
    const result = mockRemove(pages, 1); // removes 'b'
    expect(result[0].data).toEqual(["a", "c"]);
    expect(result[1].data).toEqual(["d", "e"]);
  });

  it("should remove item by index from a subsequent page", () => {
    const pages = setupPages();
    const result = mockRemove(pages, 3); // index 3 is 'd'
    expect(result[0].data).toEqual(["a", "b", "c"]);
    expect(result[1].data).toEqual(["e"]);
  });

  it("should do nothing if index is out of bounds", () => {
    const pages = setupPages();
    const result = mockRemove(pages, 10);
    expect(result).toEqual(pages);
  });

  it("should remove items matching predicate across all pages", () => {
    const pages = [
      { data: [{ id: 1, val: "a" }, { id: 2, val: "b" }] },
      { data: [{ id: 3, val: "c" }, { id: 1, val: "d" }] },
    ];
    const result = mockRemove(pages, (item) => item.id === 1);
    expect(result[0].data).toEqual([{ id: 2, val: "b" }]);
    expect(result[1].data).toEqual([{ id: 3, val: "c" }]);
  });

  it("should discard remove if data is not an array", () => {
    const pages = [
      { data: { id: 1, val: "a" } },
    ];
    const result = mockRemove(pages, 0);
    expect(result).toEqual(pages);
  });
});

function mockUpdate(
  oldPages: any[],
  arg: number | ((item: any) => boolean),
  updater: any | ((item: any) => any),
) {
  if (oldPages.some(page => !Array.isArray(page?.data))) {
    return oldPages;
  }
  let newPages = [];

  const resolveUpdater = (item: any): any => {
    return typeof updater === "function" ? updater(item) : updater;
  };

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
  return newPages;
}

describe("update Cache Logic", () => {
  const setupPages = () => [
    { data: ["a", "b", "c"] },
    { data: ["d", "e"] },
  ];

  it("should update item by index in the first page", () => {
    const pages = setupPages();
    const result = mockUpdate(pages, 1, "z");
    expect(result[0].data).toEqual(["a", "z", "c"]);
    expect(result[1].data).toEqual(["d", "e"]);
  });

  it("should update item by index in a subsequent page", () => {
    const pages = setupPages();
    const result = mockUpdate(pages, 3, "z");
    expect(result[0].data).toEqual(["a", "b", "c"]);
    expect(result[1].data).toEqual(["z", "e"]);
  });

  it("should update items matching predicate across all pages using updater function", () => {
    const pages = [
      { data: [{ id: 1, val: "a" }, { id: 2, val: "b" }] },
      { data: [{ id: 3, val: "c" }, { id: 1, val: "d" }] },
    ];
    const result = mockUpdate(
      pages,
      (item) => item.id === 1,
      (item) => ({ ...item, val: item.val.toUpperCase() }),
    );
    expect(result[0].data).toEqual([{ id: 1, val: "A" }, { id: 2, val: "b" }]);
    expect(result[1].data).toEqual([{ id: 3, val: "c" }, { id: 1, val: "D" }]);
  });

  it("should discard update if data is not an array", () => {
    const pages = [
      { data: { id: 1, val: "a" } },
    ];
    const result = mockUpdate(pages, 0, "z");
    expect(result).toEqual(pages);
  });
});

function mockPrepend(oldPages: any[], item: any) {
  if (oldPages.length === 0) {
    return [{ data: [item], nextCursor: null, hasMore: false }];
  }
  return oldPages.map((page, idx) => {
    if (idx === 0) {
      if (page.data && typeof page.data === "object" && !Array.isArray(page.data)) {
        return { ...page, data: { ...item, ...page.data } };
      }
      const arr = Array.isArray(page.data) ? page.data : [];
      return { ...page, data: [item, ...arr] };
    }
    return page;
  });
}

function mockAppend(oldPages: any[], item: any) {
  if (oldPages.length === 0) {
    return [{ data: [item], nextCursor: null, hasMore: false }];
  }
  return oldPages.map((page, idx) => {
    if (idx === oldPages.length - 1) {
      if (page.data && typeof page.data === "object" && !Array.isArray(page.data)) {
        return { ...page, data: { ...page.data, ...item } };
      }
      const arr = Array.isArray(page.data) ? page.data : [];
      return { ...page, data: [...arr, item] };
    }
    return page;
  });
}

function mockInsert(oldPages: any[], index: number, item: any) {
  if (oldPages.length > 0 && oldPages.some(page => !Array.isArray(page?.data))) {
    return oldPages;
  }
  if (oldPages.length === 0 || index <= 0) {
    return mockPrepend(oldPages, item);
  }

  let targetIndex = index;
  let inserted = false;
  const totalLength = oldPages.reduce((acc, p) => acc + p.data.length, 0);

  if (targetIndex >= totalLength) {
    return mockAppend(oldPages, item);
  }

  return oldPages.map((page) => {
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
}

describe("Prepend, Append, and Insert Cache Logic", () => {
  const setupPages = () => [
    { data: ["a", "b"] },
    { data: ["c", "d"] },
  ];

  it("should prepend item to empty pages list", () => {
    const result = mockPrepend([], "x");
    expect(result[0].data).toEqual(["x"]);
  });

  it("should prepend item to existing pages", () => {
    const pages = setupPages();
    const result = mockPrepend(pages, "x");
    expect(result[0].data).toEqual(["x", "a", "b"]);
    expect(result[1].data).toEqual(["c", "d"]);
  });

  it("should prepend item when page data is an object (spread merge)", () => {
    const pages = [{ data: { b: 2, c: 3 } }];
    const result = mockPrepend(pages, { a: 1, b: 99 });
    expect(result[0].data).toEqual({ a: 1, b: 2, c: 3 }); // prepended 'a', b: 2 overrides b: 99 because of `{ ...item, ...page.data }`
  });

  it("should append item to empty pages list", () => {
    const result = mockAppend([], "x");
    expect(result[0].data).toEqual(["x"]);
  });

  it("should append item to existing pages", () => {
    const pages = setupPages();
    const result = mockAppend(pages, "x");
    expect(result[0].data).toEqual(["a", "b"]);
    expect(result[1].data).toEqual(["c", "d", "x"]);
  });

  it("should append item when page data is an object (spread merge)", () => {
    const pages = [{ data: { a: 1, b: 2 } }];
    const result = mockAppend(pages, { b: 99, c: 3 });
    expect(result[0].data).toEqual({ a: 1, b: 99, c: 3 }); // appended 'c', b: 99 overrides b: 2 because of `{ ...page.data, ...item }`
  });

  it("should insert item at start (index 0) by prepending", () => {
    const pages = setupPages();
    const result = mockInsert(pages, 0, "x");
    expect(result[0].data).toEqual(["x", "a", "b"]);
  });

  it("should insert item in the middle of a page", () => {
    const pages = setupPages();
    const result = mockInsert(pages, 1, "x"); // index 1 is between a and b
    expect(result[0].data).toEqual(["a", "x", "b"]);
    expect(result[1].data).toEqual(["c", "d"]);
  });

  it("should insert item at page boundaries", () => {
    const pages = setupPages();
    const result = mockInsert(pages, 2, "x"); // index 2 is at start of page 2
    expect(result[0].data).toEqual(["a", "b"]);
    expect(result[1].data).toEqual(["x", "c", "d"]);
  });

  it("should insert item at the end of the pages (append)", () => {
    const pages = setupPages();
    const result = mockInsert(pages, 4, "x"); // index 4 is out of bounds (end)
    expect(result[0].data).toEqual(["a", "b"]);
    expect(result[1].data).toEqual(["c", "d", "x"]);
  });

  it("should discard insert if data is not an array", () => {
    const pages = [{ data: { a: 1 } }];
    const result = mockInsert(pages, 1, { b: 2 });
    expect(result).toEqual(pages);
  });

  it("should discard insert at index 0 if data is not an array", () => {
    const pages = [{ data: { a: 1 } }];
    const result = mockInsert(pages, 0, { b: 2 });
    expect(result).toEqual(pages);
  });

  it("should update pages using setPages updater", () => {
    const pages = setupPages();
    const updater = (old: any[]) => old.map((page) => ({ ...page, data: page.data.map((x: string) => x.toUpperCase()) }));
    const result = updater(pages);
    expect(result[0].data).toEqual(["A", "B"]);
    expect(result[1].data).toEqual(["C", "D"]);
  });
});

describe("Optimistic Update & Rollback Cache Logic", () => {
  it("should capture state and rollback successfully", () => {
    let mockState = {
      data: {
        pages: [
          { data: ["a", "b"] },
          { data: ["c", "d"] },
        ],
      },
    };

    const mockUpdateState = (arg: number, updater: any) => {
      const previousPages = JSON.parse(JSON.stringify(mockState.data.pages));
      const rollback = () => {
        mockState.data.pages = previousPages;
      };
      mockState.data.pages = mockUpdate(mockState.data.pages, arg, updater);
      return rollback;
    };

    expect(mockState.data.pages[0].data).toEqual(["a", "b"]);

    const rollback = mockUpdateState(1, "x");
    expect(mockState.data.pages[0].data).toEqual(["a", "x"]);

    rollback();
    expect(mockState.data.pages[0].data).toEqual(["a", "b"]);
  });

  it("should support snapshot and rollback successfully", () => {
    let mockState = {
      data: {
        pages: [
          { data: ["a", "b"] },
          { data: ["c", "d"] },
        ],
      },
    };

    const mockSnapshot = () => {
      const previousPages = JSON.parse(JSON.stringify(mockState.data.pages));
      return () => {
        mockState.data.pages = previousPages;
      };
    };

    const rollback = mockSnapshot();

    mockState.data.pages = mockRemove(mockState.data.pages, 1);
    mockState.data.pages = mockPrepend(mockState.data.pages, "x");

    expect(mockState.data.pages[0].data).toEqual(["x", "a"]);

    rollback();
    expect(mockState.data.pages[0].data).toEqual(["a", "b"]);
  });

  it("should correctly parse WindowTime including ms, s, m, h, d, w, M", async () => {
    const { parseWindow: parseReactWindow } = await import(
      "../../packages/react/src/lib/utils.js"
    );
    const { parseWindow: parseServerWindow } = await import(
      "../../packages/server/src/lib/utils.js"
    );

    for (const parseWindow of [parseReactWindow, parseServerWindow]) {
      expect(parseWindow(undefined)).toBe(0);
      expect(parseWindow(300)).toBe(300);
      expect(parseWindow("300ms")).toBe(300);
      expect(parseWindow("50ms")).toBe(50);
      expect(parseWindow("1s")).toBe(1000);
      expect(parseWindow("5s")).toBe(5000);
      expect(parseWindow("2m")).toBe(120000);
      expect(parseWindow("1h")).toBe(3600000);
      expect(parseWindow("1d")).toBe(86400000);
      expect(parseWindow("1w")).toBe(604800000);
      expect(parseWindow("1M")).toBe(2592000000);
    }
  });

  it("SSEClient should abort permanently and throw SSEHttpError on 401, 403, or 404 without reconnecting", async () => {
    const { SSEClient, SSEHttpError } = await import(
      "../../packages/react/src/client/sse.js"
    );

    let fetchCallCount = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchCallCount++;
      return {
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        body: null,
      } as any;
    }) as any;

    try {
      const client = await SSEClient({
        url: "http://localhost/api/test-sse",
        track: false,
      });

      let errorThrown: any = null;
      try {
        for await (const _event of client) {
          // should not yield
        }
      } catch (err) {
        errorThrown = err;
      }

      expect(errorThrown).toBeInstanceOf(SSEHttpError);
      expect(errorThrown.statusCode).toBe(401);
      expect(fetchCallCount).toBe(1); // Crucial: did NOT retry in an infinite loop!
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("SSEClient should disable reconnection when retryDelay is 0", async () => {
    const { SSEClient } = await import(
      "../../packages/react/src/client/sse.js"
    );

    let fetchCallCount = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchCallCount++;
      return {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        body: null,
      } as any;
    }) as any;

    try {
      const client = await SSEClient({
        url: "http://localhost/api/test-sse",
        track: false,
        retryDelay: 0,
      });

      for await (const _event of client) {
        // should not yield
      }

      expect(fetchCallCount).toBe(1); // Did not retry because retryDelay is 0
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("useSSEInfiniteQuery / useWSInfiniteQuery enabled resolution logic", () => {
    const resolveStreamEnabled = (streamOpts: any, queryOpts: any) =>
      streamOpts?.enabled ?? queryOpts?.enabled ?? true;
    const resolveQueryEnabled = (streamOpts: any, queryOpts: any) =>
      queryOpts?.enabled ?? streamOpts?.enabled ?? true;

    // 1. When enabled is explicitly false in queryOpts only (standard react-query pattern) -> both disabled
    expect(resolveStreamEnabled({}, { enabled: false })).toBe(false);
    expect(resolveQueryEnabled({}, { enabled: false })).toBe(false);

    // 2. When enabled is false in top-level streamOpts only -> both disabled
    expect(resolveStreamEnabled({ enabled: false }, {})).toBe(false);
    expect(resolveQueryEnabled({ enabled: false }, {})).toBe(false);

    // 3. When streamOpts has enabled: false, but queryOpts has enabled: true (only test query part)
    expect(resolveStreamEnabled({ enabled: false }, { enabled: true })).toBe(false);
    expect(resolveQueryEnabled({ enabled: false }, { enabled: true })).toBe(true);

    // 4. When enabled is undefined in both (defaults to true)
    expect(resolveStreamEnabled({}, {})).toBe(true);
    expect(resolveQueryEnabled({}, {})).toBe(true);
  });

  it("useWS event envelope normalization handles { type, data }, legacy double-wrap, and raw payloads", () => {
    function normalizeWsEvent(parsed: any) {
      const isEnvelope =
        parsed !== null &&
        typeof parsed === "object" &&
        "type" in parsed;

      let eventType = "message";
      let eventData = parsed;

      if (isEnvelope) {
        if (
          parsed.type === "event" &&
          parsed.data !== null &&
          typeof parsed.data === "object" &&
          "type" in parsed.data
        ) {
          eventType = parsed.data.type;
          eventData =
            "data" in parsed.data ? parsed.data.data : parsed.data;
        } else {
          eventType = parsed.type;
          eventData = "data" in parsed ? parsed.data : parsed;
        }
      }

      return { type: eventType, data: eventData };
    }

    // 1. Standard { type, data }
    expect(
      normalizeWsEvent({ type: "new-notification", data: { id: "1" } })
    ).toEqual({ type: "new-notification", data: { id: "1" } });

    // 2. Legacy single wrap: { type: "event", data: { id: "2" } }
    expect(
      normalizeWsEvent({ type: "event", data: { id: "2" } })
    ).toEqual({ type: "event", data: { id: "2" } });

    // 3. Legacy double wrap: { type: "event", data: { type: "chat", data: { text: "hi" } } }
    expect(
      normalizeWsEvent({
        type: "event",
        data: { type: "chat", data: { text: "hi" } },
      })
    ).toEqual({ type: "chat", data: { text: "hi" } });

    // 4. Raw object payload without type
    expect(
      normalizeWsEvent({ id: "3", text: "raw" })
    ).toEqual({ type: "message", data: { id: "3", text: "raw" } });
  });

  it("defaultExtractTypingUser respects user, sender, and author structures and flat IDs", () => {
    // 1. user object
    expect(
      defaultExtractTypingUser({ user: { id: "u1", name: "Alice", avatar: "a.png" } })
    ).toEqual({ id: "u1", name: "Alice", avatar: "a.png" });

    // 2. sender object
    expect(
      defaultExtractTypingUser({ sender: { id: "s1", name: "Bob" } })
    ).toEqual({ id: "s1", name: "Bob" });

    // 3. author object
    expect(
      defaultExtractTypingUser({ author: { id: "a1", username: "Charlie" } })
    ).toEqual({ id: "a1", username: "Charlie", name: "Charlie" });

    // 4. flat senderId
    expect(
      defaultExtractTypingUser({ senderId: "s2", senderName: "Dave" })
    ).toEqual({ senderId: "s2", senderName: "Dave", id: "s2", name: "Dave" });

    // 5. flat authorId
    expect(
      defaultExtractTypingUser({ authorId: "a2", authorName: "Eve" })
    ).toEqual({ authorId: "a2", authorName: "Eve", id: "a2", name: "Eve" });

    // 6. primitive user
    expect(defaultExtractTypingUser({ user: "user-42" })).toEqual({
      id: "user-42",
      name: "user-42",
    });
  });
});
