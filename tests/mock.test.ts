import { describe, it, expect } from "vitest";
import { createProcedure } from "../src/core/server.js";

describe("Core: Mocking", () => {
  it("should use mock handler when ACTYX_MOCK is 'true'", async () => {
    process.env.ACTYX_MOCK = "true";

    const procedure = createProcedure({
      createContext: () => ({ ok: true, ctx: {} }),
    });

    const getUser = procedure
      .mock(() => ({ id: "mock_1", name: "Mock User" }))
      .query(async () => {
        return { id: "real_1", name: "Real User" };
      });

    const [result, error] = await getUser();
    
    expect(error).toBeNull();
    expect(result?.id).toBe("mock_1");
    expect(result?.name).toBe("Mock User");

    delete process.env.ACTYX_MOCK;
  });

  it("should fallback to real handler when ACTYX_MOCK is not 'true'", async () => {
    process.env.ACTYX_MOCK = "false";

    const procedure = createProcedure({
      createContext: () => ({ ok: true, ctx: {} }),
    });

    const getUser = procedure
      .mock(() => ({ id: "mock_1", name: "Mock User" }))
      .query(async () => {
        return { id: "real_1", name: "Real User" };
      });

    const [result, error] = await getUser();
    
    expect(error).toBeNull();
    expect(result?.id).toBe("real_1");

    delete process.env.ACTYX_MOCK;
  });

  it("should fail with error if mock throws", async () => {
    process.env.ACTYX_MOCK = "true";

    const procedure = createProcedure({
      createContext: () => ({ ok: true, ctx: {} }),
    });

    const getUser = procedure
      .mock(() => {
        throw new Error("Abort");
      })
      .query(async () => ({ id: "real" }));

    const [result, error] = await getUser();
    expect(result).toBeNull();
    expect(error?.message).toBe("Abort");

    delete process.env.ACTYX_MOCK;
  });
});
