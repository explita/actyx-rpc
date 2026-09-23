import { describe, it, expect } from "vitest";
import util from "node:util";
import { nextAdapter } from "../../packages/server/src/adapters/next/next-headers.js";

describe("nextAdapter inspection & spreading", () => {
  it("should safely inspect with util.inspect / console.log without throwing #headersList error", async () => {
    const next = await nextAdapter();
    expect(next).toBeDefined();

    // Spreading into ctx
    const ctx = {
      userId: "test-user",
      ...next,
    };

    expect(ctx.headers).toBeDefined();
    expect(ctx.cookies).toBeDefined();

    // util.inspect must not throw "Cannot read private member #headersList"
    expect(() => {
      const inspected = util.inspect(ctx);
      expect(inspected).toContain("userId");
    }).not.toThrow();
  });
});
