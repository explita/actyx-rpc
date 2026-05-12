import { describe, it, expect, vi } from "vitest";
import { createProcedure, observabilityPlugin } from "../src/index.js";

describe("Plugins: Observability", () => {
  it("should track execution duration and success", async () => {
    const onCall = vi.fn();
    
    const procedure = createProcedure({
      createContext: () => ({ ok: true, ctx: {} }),
      plugins: [
        observabilityPlugin({ onCall })
      ]
    });

    const fastProc = procedure.query(async () => {
      await new Promise(r => setTimeout(r, 10));
      return "done";
    });

    await fastProc();

    await vi.waitFor(() => {
      expect(onCall).toHaveBeenCalled();
      const callData = onCall.mock.calls[0][0];
      expect(callData.success).toBe(true);
      expect(callData.duration).toBeGreaterThanOrEqual(10);
    });
  });

  it("should track failures", async () => {
    const onCall = vi.fn();
    
    const procedure = createProcedure({
      createContext: () => ({ ok: true, ctx: {} }),
      plugins: [
        observabilityPlugin({ onCall })
      ]
    });

    const errorProc = procedure.query(async () => {
      throw new Error("Boom");
    });

    await errorProc();
    
    await vi.waitFor(() => {
      expect(onCall).toHaveBeenCalled();
      const callData = onCall.mock.calls[0][0];
      expect(callData.success).toBe(false);
      expect(callData.error.message).toBe("Boom");
    });
  });
});
