---
sidebar_position: 6
title: Observability & Telemetry
---

# Observability & Telemetry

Monitor procedure execution times, success ratios, and failure states using built-in OpenTelemetry integrations and telemetry plugins.

---

## OpenTelemetry (`.telemetry()`)

The `.telemetry()` policy integrates with OpenTelemetry to record execution spans for the request lifecycle, measuring duration, outcomes, and exceptions.

```ts
const processOrder = procedure
  .name("processOrder")
  .telemetry()
  .mutation(async ({ input }) => {
    // Spans are recorded automatically
  });
```

> [!NOTE]
> Telemetry relies on `@opentelemetry/api` being installed in the consuming project. If the package is missing, `.telemetry()` falls back to a safe, silent no-op execution.

---

## `observabilityPlugin`

For custom logging, metrics reporting, or tracking services (e.g., Sentry, Datadog), register `observabilityPlugin` globally inside `createProcedure`:

```ts
import { createProcedure, observabilityPlugin } from "@explita/actyx-rpc";

const procedure = createProcedure({
  plugins: [
    observabilityPlugin({
      onCall: ({ name, duration, success, error }) => {
        console.log(`Procedure ${name} finished in ${duration}ms (Success: ${success})`);
        
        if (error) {
          reportErrorToSentry(error);
        }
      },
    }),
  ],
});
```

### Options

The `onCall` callback receives a payload with the following fields:

* `name`: The procedure name defined by `.name()`.
* `duration`: Call duration in milliseconds.
* `success`: Boolean indicating if execution completed successfully.
* `error`: The caught error object (if execution failed).
