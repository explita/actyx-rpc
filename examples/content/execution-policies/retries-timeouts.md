---
sidebar_position: 4
title: Retries & Timeouts
---

# Retries & Timeouts

Increase the resilience of external network queries or long-running computations by configuring automated retries and timeout boundaries.

---

## `.retry()`

Configure automated retries for transient procedure failures with configurable backoff strategies.

```ts
const createOrder = procedure
  .retry({ attempts: 3 })
  .mutation(async ({ input }) => {
    return await api.createOrder(input);
  });
```

### Backoff Strategies

```ts
// Exponential backoff (default) - 100ms, 200ms, 400ms...
const expProc = procedure.retry({
  attempts: 3,
  backoff: "exponential",
  initialDelay: 100,
  maxDelay: 5000,
});

// Linear backoff - 100ms, 200ms, 300ms, 400ms...
const linProc = procedure.retry({
  attempts: 4,
  backoff: "linear",
  initialDelay: 100,
});

// Fixed backoff - 1000ms, 1000ms, 1000ms
const fixProc = procedure.retry({
  attempts: 3,
  backoff: "fixed",
  initialDelay: 1000,
});
```

### Conditional Retry
You can filter which failures trigger a retry using the `if` option:

```ts
const fetchUser = procedure
  .retry({
    attempts: 5,
    if: (error) => {
      // Only retry on network issues or server status errors
      return (
        error.reason === "NETWORK_ERROR" ||
        error.status >= 500
      );
    },
    onRetry: (error, attempt, delay) => {
      console.log(`Retry ${attempt} in ${delay}ms due to: ${error.message}`);
    },
    onFailed: (error, attempts) => {
      console.error(`Retry policy exhausted after ${attempts} attempts`);
    },
  })
  .query(async ({ input }) => {
    return await db.users.findById(input.id);
  });
```

### Retry Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `attempts` | `number` | `3` | Maximum number of retry attempts. |
| `backoff` | `'fixed' \| 'linear' \| 'exponential'` | `'exponential'` | Backoff delay calculation strategy. |
| `initialDelay` | `number` | `100` | Delay in ms before the first retry. |
| `maxDelay` | `number` | `10000` | Maximum cap on backoff delays. |
| `factor` | `number` | `2` | Multiplier for linear/exponential backoff. |
| `if` | `(error) => boolean` | `() => true` | Condition filtering which errors trigger a retry. |
| `onRetry` | `(error, attempt, delay) => void` | — | Callback run prior to each retry attempt. |
| `onFailed` | `(error, attempts) => void` | — | Callback run when all attempts fail. |

---

## `.timeout()`

Set a maximum execution duration boundary on your query.

> [!WARNING]
> **Mutation Safety**: The `.timeout()` method is **disabled for mutations**. Applying a timeout to a mutation is unsafe as it can lead to partial data creation (the client aborts, but the database transaction might still commit). Timeouts are only available for `.query()` and `.subscription()` procedures.

```ts
const fetchLargeData = procedure
  .timeout({ ms: 2000 }) // Abort and fail if it takes longer than 2 seconds
  .query(async () => {
    return await heavyTask();
  });
```

### Timeout Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `ms` | `number` | `5000` | Timeout boundary in milliseconds. |
| `message` | `string` | `"Request timeout"` | Error message payload returned. |
| `reason` | `FailureReason` | `"TIMEOUT"` | Error reason code returned in tuple. |
| `onTimeout` | `(duration) => void` | — | Callback triggered when timeout limit is breached. |
