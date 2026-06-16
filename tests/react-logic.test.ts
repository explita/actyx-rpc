import { describe, it, expect } from "vitest";

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

function mockRemoveItem(oldPages: any[], arg: number | ((item: any) => boolean)) {
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

describe("removeItem Cache Logic", () => {
  const setupPages = () => [
    { data: ["a", "b", "c"], nextCursor: 2 },
    { data: ["d", "e"], nextCursor: 3 },
  ];

  it("should remove item by index from the first page", () => {
    const pages = setupPages();
    const result = mockRemoveItem(pages, 1); // removes 'b'
    expect(result[0].data).toEqual(["a", "c"]);
    expect(result[1].data).toEqual(["d", "e"]);
  });

  it("should remove item by index from a subsequent page", () => {
    const pages = setupPages();
    const result = mockRemoveItem(pages, 3); // index 3 is 'd'
    expect(result[0].data).toEqual(["a", "b", "c"]);
    expect(result[1].data).toEqual(["e"]);
  });

  it("should do nothing if index is out of bounds", () => {
    const pages = setupPages();
    const result = mockRemoveItem(pages, 10);
    expect(result).toEqual(pages);
  });

  it("should remove items matching predicate across all pages", () => {
    const pages = [
      { data: [{ id: 1, val: "a" }, { id: 2, val: "b" }] },
      { data: [{ id: 3, val: "c" }, { id: 1, val: "d" }] },
    ];
    const result = mockRemoveItem(pages, (item) => item.id === 1);
    expect(result[0].data).toEqual([{ id: 2, val: "b" }]);
    expect(result[1].data).toEqual([{ id: 3, val: "c" }]);
  });
});

function mockUpdateItem(
  oldPages: any[],
  arg: number | ((item: any) => boolean),
  updater: any | ((item: any) => any),
) {
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

describe("updateItem Cache Logic", () => {
  const setupPages = () => [
    { data: ["a", "b", "c"] },
    { data: ["d", "e"] },
  ];

  it("should update item by index in the first page", () => {
    const pages = setupPages();
    const result = mockUpdateItem(pages, 1, "z");
    expect(result[0].data).toEqual(["a", "z", "c"]);
    expect(result[1].data).toEqual(["d", "e"]);
  });

  it("should update item by index in a subsequent page", () => {
    const pages = setupPages();
    const result = mockUpdateItem(pages, 3, "z");
    expect(result[0].data).toEqual(["a", "b", "c"]);
    expect(result[1].data).toEqual(["z", "e"]);
  });

  it("should update items matching predicate across all pages using updater function", () => {
    const pages = [
      { data: [{ id: 1, val: "a" }, { id: 2, val: "b" }] },
      { data: [{ id: 3, val: "c" }, { id: 1, val: "d" }] },
    ];
    const result = mockUpdateItem(
      pages,
      (item) => item.id === 1,
      (item) => ({ ...item, val: item.val.toUpperCase() }),
    );
    expect(result[0].data).toEqual([{ id: 1, val: "A" }, { id: 2, val: "b" }]);
    expect(result[1].data).toEqual([{ id: 3, val: "c" }, { id: 1, val: "D" }]);
  });
});

function mockPrependItem(oldPages: any[], item: any) {
  if (oldPages.length === 0) {
    return [{ data: [item], nextCursor: null, hasMore: false }];
  }
  return oldPages.map((page, idx) => {
    if (idx === 0) {
      return { ...page, data: [item, ...page.data] };
    }
    return page;
  });
}

function mockAppendItem(oldPages: any[], item: any) {
  if (oldPages.length === 0) {
    return [{ data: [item], nextCursor: null, hasMore: false }];
  }
  return oldPages.map((page, idx) => {
    if (idx === oldPages.length - 1) {
      return { ...page, data: [...page.data, item] };
    }
    return page;
  });
}

function mockInsertItem(oldPages: any[], index: number, item: any) {
  if (oldPages.length === 0 || index <= 0) {
    return mockPrependItem(oldPages, item);
  }

  let targetIndex = index;
  let inserted = false;
  const totalLength = oldPages.reduce((acc, p) => acc + p.data.length, 0);

  if (targetIndex >= totalLength) {
    return mockAppendItem(oldPages, item);
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
    const result = mockPrependItem([], "x");
    expect(result[0].data).toEqual(["x"]);
  });

  it("should prepend item to existing pages", () => {
    const pages = setupPages();
    const result = mockPrependItem(pages, "x");
    expect(result[0].data).toEqual(["x", "a", "b"]);
    expect(result[1].data).toEqual(["c", "d"]);
  });

  it("should append item to empty pages list", () => {
    const result = mockAppendItem([], "x");
    expect(result[0].data).toEqual(["x"]);
  });

  it("should append item to existing pages", () => {
    const pages = setupPages();
    const result = mockAppendItem(pages, "x");
    expect(result[0].data).toEqual(["a", "b"]);
    expect(result[1].data).toEqual(["c", "d", "x"]);
  });

  it("should insert item at start (index 0) by prepending", () => {
    const pages = setupPages();
    const result = mockInsertItem(pages, 0, "x");
    expect(result[0].data).toEqual(["x", "a", "b"]);
  });

  it("should insert item in the middle of a page", () => {
    const pages = setupPages();
    const result = mockInsertItem(pages, 1, "x"); // index 1 is between a and b
    expect(result[0].data).toEqual(["a", "x", "b"]);
    expect(result[1].data).toEqual(["c", "d"]);
  });

  it("should insert item at page boundaries", () => {
    const pages = setupPages();
    const result = mockInsertItem(pages, 2, "x"); // index 2 is at start of page 2
    expect(result[0].data).toEqual(["a", "b"]);
    expect(result[1].data).toEqual(["x", "c", "d"]);
  });

  it("should insert item at the end of the pages (append)", () => {
    const pages = setupPages();
    const result = mockInsertItem(pages, 4, "x"); // index 4 is out of bounds (end)
    expect(result[0].data).toEqual(["a", "b"]);
    expect(result[1].data).toEqual(["c", "d", "x"]);
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

    const mockUpdateItemState = (arg: number, updater: any) => {
      const previousPages = JSON.parse(JSON.stringify(mockState.data.pages));
      const rollback = () => {
        mockState.data.pages = previousPages;
      };
      mockState.data.pages = mockUpdateItem(mockState.data.pages, arg, updater);
      return rollback;
    };

    expect(mockState.data.pages[0].data).toEqual(["a", "b"]);

    const rollback = mockUpdateItemState(1, "x");
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

    mockState.data.pages = mockRemoveItem(mockState.data.pages, 1);
    mockState.data.pages = mockPrependItem(mockState.data.pages, "x");

    expect(mockState.data.pages[0].data).toEqual(["x", "a"]);

    rollback();
    expect(mockState.data.pages[0].data).toEqual(["a", "b"]);
  });
});
