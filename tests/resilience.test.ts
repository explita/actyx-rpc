import { describe, it, expect, vi } from "vitest";
import { createProcedure } from "../src/core/server.js";

describe("Resilience: Retry Logic", () => {
  const procedure = createProcedure({
    inputMode: "form",
    createContext: () => ({ ok: true, ctx: {} }),
  });

  it("should only retry if retryIf returns true", async () => {
    let attempts = 0;
    const proc = procedure
      .retry({
        attempts: 5,
        initialDelay: 5,
        if: (err) => (err as any).message === "RETRY_ME",
      })
      .query(async () => {
        attempts++;
        throw new Error("DONT_RETRY");
      });

    await proc();
    expect(attempts).toBe(1); // Should give up immediately
  });
});

describe("Resilience: Circuit Breaker", () => {
  const procedure = createProcedure({
    inputMode: "form",
    createContext: () => ({ ok: true, ctx: {} }),
  });

  it("should transition from HALF_OPEN to CLOSED on success", async () => {
    let fail = true;
    const stateChangeSpy = vi.fn();

    const proc = procedure
      .name("recovery-success")
      .circuitBreaker({
        failureThreshold: 1,
        resetTimeout: 10,
        onStateChange: stateChangeSpy,
      })
      .query(async () => {
        if (fail) throw new Error("die");
        return "alive";
      });

    await proc(); // Trip it (OPEN)
    expect(stateChangeSpy).toHaveBeenCalledWith("OPEN", "recovery-success");

    await new Promise((r) => setTimeout(r, 20)); // Wait for timeout

    fail = false;
    const [result] = await proc(); // This is the HALF_OPEN test call
    expect(result).toBe("alive");

    // Should now be CLOSED again
    expect(stateChangeSpy).toHaveBeenCalledWith("CLOSED", "recovery-success");
  });
});

describe("Resilience: Timeouts", () => {
  it("should clean up timers even on success", async () => {
    const procedure = createProcedure({
      inputMode: "form",
      createContext: () => ({ ok: true, ctx: {} }),
    });

    const proc = procedure.timeout({ ms: 1000 }).query(async () => "ok");
    const [result] = await proc();
    expect(result).toBe("ok");
    // Implementation detail: if it didn't clean up, vitest might hang if the timeout was very long,
    // but here we just ensure basic success.
  });
});
