---
sidebar_position: 5
title: Error Handling
---

# Error Handling & Failure Reasons

Actyx RPC adopts a predictable, Go/Rust-style `[data, error]` tuple pattern for procedures. When an action or query fails, it never throws unhandled runtime crashes to the caller unless explicitly requested—instead, it returns a strongly typed error object with structured metadata and a typed `reason`.

---

## The Error Response Shape

Every error returned by Actyx RPC adheres to the `ErrorResponse` structure:

```ts
export type ErrorResponse = {
  success: boolean;       // always false
  message: string;        // Human-readable error description
  reason: FailureReason;  // Strongly typed reason literal
  statusCode: number;     // Suggested HTTP status code (e.g., 400, 401, 500)
  handlerName: string;    // Procedure identifier if named via .name()
  errors?: Record<string, string>; // Field-level validation issues (optional)
  [key: string]: unknown; // Additional custom properties
};
```

When invoking any procedure:

```ts
const [data, error] = await getUser({ id: "user_1" });

if (error) {
  console.error(`[${error.statusCode}] ${error.reason}: ${error.message}`);
}
```

---

## Centralized Error Lifecycle Hooks

Actyx RPC separates error handling into two distinct lifecycle phases: context initialization and handler execution.

### 1. `onContextError`

Triggered when `createContext` returns `{ ok: false, reason }`. This allows you to intercept authentication or pre-condition failures before any procedure handler, middleware, or plugin runs.

```ts
import { createProcedure } from "@explita/actyx-rpc";

const procedure = createProcedure({
  async createContext() {
    const session = await getSession();

    if (!session) {
      return { ok: false, reason: "UNAUTHORIZED" };
    }

    return { ok: true, ctx: { user: session.user } };
  },
  onContextError({ reason }) {
    if (reason === "UNAUTHORIZED") {
      return {
        message: "You must be signed in to perform this action",
        reason,
        statusCode: 401,
        _redirect() {
          redirect("/login"); // Framework redirect (e.g. next/navigation)
        },
      };
    }
  },
});
```

### 2. `onError`

The `onError` hook is a central error mapper for procedure execution. The recommended pattern is to **let your handlers throw naturally** (e.g., Prisma errors, external API timeouts, business exceptions) and map them once in `onError`.

```ts
const procedure = createProcedure({
  onError({ error, ctx }) {
    console.error(`Error in ${ctx.handlerName}:`, error);

    // Map Prisma unique constraint violations to a clean validation error
    if (error.code === "P2002") {
      return {
        message: "A record with this value already exists",
        reason: "VALIDATION_ERROR",
        statusCode: 409,
        errors: {
          [error.meta.target[0]]: "Already taken",
        },
      };
    }
  },
});
```

### 3. Customizing Validation Messages (`validationHint`)

By default, when input schema validation fails (such as invalid parameters passed to `.input(...)`), Actyx RPC returns a `VALIDATION_ERROR` with `message: "Invalid data provided"`.

You can customize this default message globally on the procedure builder using `validationHint`:

```ts
const procedure = createProcedure({
  validationHint: "Please check your input fields and try again.",
});
```

---

## Built-in Failure Reasons

Actyx RPC provides standard, well-defined built-in failure reasons under `BuiltinFailureReason`:

| Category | Reason | Status | Description |
| :--- | :--- | :--- | :--- |
| **Authentication & Access** | `UNAUTHORIZED` | 401 | Authentication credentials missing or invalid |
| | `FORBIDDEN` | 403 | Authenticated user lacks permission for this action |
| | `INVALID_SESSION` | 401 | User session has expired or been revoked |
| **Validation & Input** | `VALIDATION_ERROR` | 400 | Schema validation failed (`errors` field populated) |
| | `BAD_REQUEST` | 400 | Malformed payload or invalid parameters |
| | `NOT_FOUND` | 404 | Target resource could not be found |
| | `CLIENT_ERROR` | 400 | Generic client-side execution error |
| **Resilience & Execution** | `TIMEOUT` | 504 | Procedure execution exceeded configured timeout limit |
| | `RATE_LIMITED` | 429 | Rate limit exceeded for this client or IP |
| | `RETRY_EXHAUSTED` | 500 | Procedure failed after all retry attempts were exhausted |
| | `CIRCUIT_OPEN` | 503 | Circuit breaker is open due to repeated upstream failures |
| | `INVALID_CACHE_KEY` | 500 | Cache key generation threw an error |
| | `EMPTY_CACHE_KEY` | 400 | Cache key resolved to an empty value |
| **System & Lifecycle** | `INTERNAL_ERROR` | 500 | Unhandled internal server or database error |
| | `UNEXPECTED_ERROR` | 500 | Default fallback for unclassified exceptions |
| | `MAINTENANCE_MODE` | 503 | The application or API is temporarily in maintenance mode |
| | `ABORTED` | 499 | Request was aborted by client or signal |
| | `STREAM_BATCH_UNSUPPORTED`| 400 | Streaming procedures cannot be called in batch requests |
| **Client Adapter** | `SERVER_ERROR` | 500 | Upstream HTTP response with 5xx status code |
| | `NETWORK_ERROR` | 0 | Network connectivity failure or connection refused |
| | `HTTP_ERROR` | 4xx/5xx| General HTTP status error returned by client fetcher |
| | `MAX_RETRIES_EXCEEDED`| 0 | Client retry interceptor reached retry limit |
| | `BATCH_RESULT_MISSING`| 500 | Batch response payload did not contain entry for call |
| | `INVALID_BATCH_RESPONSE`| 500 | Malformed batch response envelope received from server |

---

## Custom Error Reasons & Global Registration

While the built-in reasons cover infrastructure, network, and validation concerns, real applications often have **domain-specific failure modes** (e.g., `"KYC_REQUIRED"`, `"INSUFFICIENT_FUNDS"`, `"ACCOUNT_LOCKED"`, `"SUBSCRIPTION_EXPIRED"`).

Rather than resorting to loosely typed strings that break TypeScript's exhaustive checks, Actyx RPC allows you to **globally register custom error reasons** via TypeScript declaration merging.

### Registration Styles

Add a `.d.ts` file anywhere in your project (e.g., `global.d.ts` or `types/actyx-rpc.d.ts`):

#### Style 1: Union Property (Recommended)

Use the `reasons` property to define a concise union of string literals:

```ts
// global.d.ts
declare global {
  namespace ActyxRPC {
    interface RegisterCustomErrors {
      reasons:
        | "KYC_REQUIRED"
        | "INSUFFICIENT_FUNDS"
        | "ACCOUNT_LOCKED"
        | "SUBSCRIPTION_EXPIRED";
    }
  }
}
```

#### Style 2: Object Keys

Alternatively, list each reason as an interface key:

```ts
// global.d.ts
declare global {
  namespace ActyxRPC {
    interface RegisterCustomErrors {
      KYC_REQUIRED: true;
      INSUFFICIENT_FUNDS: true;
      ACCOUNT_LOCKED: true;
    }
  }
}
```

> [!NOTE]
> Declaring in `namespace ActyxRPC` automatically registers the custom reasons for **both** `@explita/actyx-rpc` (server procedures) and `@explita/actyx-rpc-react` (client hooks). You can also augment `@explita/actyx-rpc` or `@explita/actyx-rpc-react` directly if preferred.

---

### Built-in Reasons are Never Overwritten

Custom error reasons are additive. All `BuiltinFailureReason` literals are strictly preserved. `FailureReason` automatically becomes:

```ts
type FailureReason = BuiltinFailureReason | CustomFailureReason;
```

---

## End-to-End Type Safety Workflow

### 1. Rejecting in `createContext`

```ts
const procedure = createProcedure({
  async createContext() {
    const user = await getCurrentUser();

    if (!user.isKycVerified) {
      // ✅ Autocompleted and strictly validated by TypeScript
      return { ok: false, reason: "KYC_REQUIRED" };
    }

    return { ok: true, ctx: { user } };
  },
  onContextError({ reason }) {
    if (reason === "KYC_REQUIRED") {
      return {
        message: "Please complete identity verification to continue",
        reason,
        statusCode: 403,
      };
    }
  },
});
```

### 2. Overriding in `onError`

```ts
export const transferProcedure = procedure.extend({
  onError({ error }) {
    if (error instanceof InsufficientBalanceException) {
      return {
        message: "You do not have enough funds for this transaction",
        reason: "INSUFFICIENT_FUNDS",
        statusCode: 400,
      };
    }
  },
});
```

### 3. Exhaustive Matching on the Client

Because `FailureReason` is a strict disjoint union, TypeScript guarantees full autocomplete, protects against typos (e.g. `"UNATHORIZED"` triggers a compile error), and supports exhaustive `switch` blocks:

```tsx
import { useMutation } from "@explita/actyx-rpc-react";
import { transferFunds } from "@/server/procedures";

function TransferForm() {
  const { mutate, isPending } = useMutation(transferFunds, {
    onError(error) {
      switch (error.reason) {
        case "KYC_REQUIRED":
          router.push("/verify-identity");
          break;
        case "INSUFFICIENT_FUNDS":
          openDepositModal();
          break;
        case "UNAUTHORIZED":
          router.push("/login");
          break;
        default:
          toast.error(error.message);
      }
    },
  });

  return (
    <button onClick={() => mutate({ amount: 100 })} disabled={isPending}>
      Transfer
    </button>
  );
}
```

---

## Summary & Best Practices

1. **Let errors throw**: Don't wrap every procedure handler in manual `try/catch` blocks. Use `onError` to normalize exceptions globally.
2. **Use `onContextError` for auth gates**: Check permissions and sessions in `createContext` and return `{ ok: false, reason: "..." }`.
3. **Register custom reasons globally**: Add domain errors to `ActyxRPC.RegisterCustomErrors` in a `global.d.ts` to get compile-time autocomplete and typo safety across your entire fullstack app.
