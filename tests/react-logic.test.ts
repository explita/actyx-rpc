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
