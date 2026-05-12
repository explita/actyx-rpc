import { describe, it, expect } from "vitest";
import { createProcedure } from "../src/core/server.js";
import { z } from "zod";

describe("Core: Scenario-Based Mocking", () => {
  it("should use the specified mock scenario when ACTYX_MOCK matches", async () => {
    process.env.ACTYX_MOCK = "success";

    const procedure = createProcedure({
      createContext: () => ({ ok: true, ctx: {} }),
    });

    const getUser = procedure
      .mock({
        success: () => ({ id: "mock_1", name: "Mock User" }),
        error: () => { throw new Error("Mock Error"); }
      })
      .query(async () => {
        return { id: "real_1", name: "Real User" };
      });

    const [result, error] = await getUser();
    
    expect(error).toBeNull();
    expect(result?.id).toBe("mock_1");
    expect(result?.name).toBe("Mock User");

    delete process.env.ACTYX_MOCK;
  });

  it("should use 'default' scenario when ACTYX_MOCK is 'true'", async () => {
    process.env.ACTYX_MOCK = "true";

    const procedure = createProcedure({
      createContext: () => ({ ok: true, ctx: {} }),
    });

    const getUser = procedure
      .mock({
        default: () => ({ id: "default_mock" }),
        special: () => ({ id: "special_mock" })
      })
      .query(async () => ({ id: "real" }));

    const [result] = await getUser();
    expect(result?.id).toBe("default_mock");

    delete process.env.ACTYX_MOCK;
  });

  it("should fail with error if mock scenario throws", async () => {
    process.env.ACTYX_MOCK = "error";

    const procedure = createProcedure({
      createContext: () => ({ ok: true, ctx: {} }),
    });

    const getUser = procedure
      .mock({
        default: () => ({ id: "ok" }),
        error: () => { throw new Error("Abort"); }
      })
      .query(async () => ({ id: "real" }));

    const [result, error] = await getUser();
    expect(result).toBeNull();
    expect(error?.message).toBe("Abort");

    delete process.env.ACTYX_MOCK;
  });

  it("should fallback to real handler if scenario is not found", async () => {
    process.env.ACTYX_MOCK = "missing";

    const procedure = createProcedure({
      createContext: () => ({ ok: true, ctx: {} }),
    });

    const getUser = procedure
      .mock({
        default: () => ({ id: "ok" })
      })
      .query(async () => ({ id: "real" }));

    const [result] = await getUser();
    expect(result?.id).toBe("real");

    delete process.env.ACTYX_MOCK;
  });
});
