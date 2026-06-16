---
sidebar_position: 5
title: Circuit Breaker
---

# Circuit Breaker

Protect your application and downstream systems from cascading failures by automatically "tripping" when a procedure fails repeatedly. 

Once open, subsequent calls fail fast with a `CIRCUIT_OPEN` error, preventing resource exhaustion.

```ts
const fetchService = procedure
  .name("inventoryService")
  .circuitBreaker({
    failureThreshold: 3,        // Trip after 3 consecutive failures
    resetTimeout: 60000,        // Stay open for 1 minute before checking again
    onStateChange: (state, name) => {
      console.log(`Circuit Breaker ${name} transitioned to ${state}`);
    },
  })
  .query(async () => {
    return await fetchInventoryFromSupplier();
  });
```

## Circuit Breaker Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `failureThreshold` | `number` | `5` | Number of consecutive failures required to open the circuit. |
| `resetTimeout` | `number` | `30000` | Cooldown period in ms before transitioning to half-open state. |
| `onStateChange` | `(state, name) => void` | — | Callback run when transitioning between `CLOSED`, `OPEN`, and `HALF_OPEN`. |

## Circuit States

* **`CLOSED`**: Normal operation. All calls pass through to the handler.
* **`OPEN`**: Tripped due to failures. All calls fail immediately with a `CIRCUIT_OPEN` error.
* **`HALF_OPEN`**: After the `resetTimeout` cooldown, the circuit allows a single test request through. If it succeeds, the circuit returns to `CLOSED`. If it fails, it returns to `OPEN` for another cooldown.
