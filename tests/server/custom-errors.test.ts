import { describe, it, expect } from "vitest";
import { createProcedure } from "../../packages/server/src/core/server.js";
import type {
  BuiltinFailureReason,
  CustomFailureReason,
  FailureReason,
} from "../../packages/server/src/index.js";

// Augment custom errors using BOTH styles simultaneously:
declare global {
  namespace ActyxRPC {
    interface RegisterCustomErrors {
      // Style 1: union property
      reasons: "KYC_REQUIRED" | "INSUFFICIENT_FUNDS";
      // Style 2: object key
      ACCOUNT_LOCKED: true;
    }
  }
}

describe("Custom Error Reason Registration", () => {
  it("should preserve BuiltinFailureReason while including custom reasons", () => {
    // Type-level assertion: verify that builtin reasons are still assignable to FailureReason
    const builtinUnauthorized: FailureReason = "UNAUTHORIZED";
    const builtinValidation: FailureReason = "VALIDATION_ERROR";
    const builtinRateLimit: FailureReason = "RATE_LIMITED";

    expect(builtinUnauthorized).toBe("UNAUTHORIZED");
    expect(builtinValidation).toBe("VALIDATION_ERROR");
    expect(builtinRateLimit).toBe("RATE_LIMITED");

    // Verify custom reasons are assignable to FailureReason and CustomFailureReason
    const customKyc: FailureReason = "KYC_REQUIRED";
    const customFunds: FailureReason = "INSUFFICIENT_FUNDS";
    const customLocked: FailureReason = "ACCOUNT_LOCKED";

    const typedCustom: CustomFailureReason = "KYC_REQUIRED";

    expect(customKyc).toBe("KYC_REQUIRED");
    expect(customFunds).toBe("INSUFFICIENT_FUNDS");
    expect(customLocked).toBe("ACCOUNT_LOCKED");
    expect(typedCustom).toBe("KYC_REQUIRED");
  });

  it("should allow returning custom error reasons from createContext and handle in onContextError", async () => {
    let capturedReason: FailureReason | null = null;

    const kycProcedure = createProcedure({
      createContext: () => {
        return {
          ok: false,
          reason: "KYC_REQUIRED",
        };
      },
      onContextError: ({ reason }) => {
        capturedReason = reason;
        return {
          message: "Please complete identity verification",
          reason,
          statusCode: 403,
        };
      },
    });

    const action = kycProcedure.query(async () => "secret data");
    const [result, error] = await action();

    expect(result).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.reason).toBe("KYC_REQUIRED");
    expect(error?.message).toBe("Please complete identity verification");
    expect(error?.statusCode).toBe(403);
    expect(capturedReason).toBe("KYC_REQUIRED");
  });

  it("should allow returning custom error reasons from procedure onError override", async () => {
    const proc = createProcedure({
      onError: () => {
        return {
          message: "Your account is temporarily locked",
          reason: "ACCOUNT_LOCKED",
          statusCode: 423,
        };
      },
    }).query(async () => {
      throw new Error("Database error");
    });

    const [result, error] = await proc();

    expect(result).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.reason).toBe("ACCOUNT_LOCKED");
    expect(error?.message).toBe("Your account is temporarily locked");
    expect(error?.statusCode).toBe(423);
  });

  it("should still allow built-in reasons without any conflict", async () => {
    const unauthorizedProc = createProcedure({
      createContext: () => {
        return {
          ok: false,
          reason: "UNAUTHORIZED",
        };
      },
      onContextError: ({ reason }) => {
        return {
          message: "Sign in required",
          reason,
          statusCode: 401,
        };
      },
    }).query(async () => "data");

    const [result, error] = await unauthorizedProc();
    expect(result).toBeNull();
    expect(error?.reason).toBe("UNAUTHORIZED");
    expect(error?.statusCode).toBe(401);
  });
});
