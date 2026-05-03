import { createProcedure } from "../src/index.js";
import z from "zod";
import { zodResolver } from "../src/resolver/zod/index.js";
import { createBatchHandler } from "../src/core/batch/handler.js";
import { createBatcher, connectBatcher } from "../src/client/batcher.js";

// 1. Setup Procedures
const proc = createProcedure();

const slowProc = proc
  .name("slowProc")
  .input(zodResolver(z.object({ id: z.string() })))
  .query(async ({ input }) => {
    // Simulate DB delay
    await new Promise((r) => setTimeout(r, 100));
    return { id: input.id, message: "slow" };
  });

const fastProc = proc
  .name("fastProc")
  .input(zodResolver(z.object({ id: z.string() })))
  .query(async ({ input }) => {
    return { id: input.id, message: "fast" };
  });

const procedures = { slowProc, fastProc };

// 2. Setup Server Batch Handler
const serverBatchHandler = createBatchHandler(procedures);

// 3. Setup Client Batcher
const batcher = createBatcher({
  delay: 50,
  fetcher: async (requests) => {
    console.log(`[Batcher] Sending batch of ${requests.length} requests...`);

    // Simulate network call to server batch handler
    const rawResponse = await serverBatchHandler(
      requests.map((r, i) => ({ id: i, ...r })),
    );

    // Extract results in order
    return rawResponse.map((r) => r.result);
  },
});

// 4. Connect Batcher (Invisible Mode)
const { slowProc: batchedSlow, fastProc: batchedFast } = connectBatcher(
  procedures,
  batcher,
);

// 5. Run Test
(async () => {
  console.log("--- Starting Invisible Batch Test ---");

  // Call both procedures "simultaneously" using the batched versions
  console.log("Scheduling batchedSlow and batchedFast...");

  const p1 = batchedSlow({ id: "user-1" });
  const p2 = batchedFast({ id: "user-2" });

  // They should be batched together automatically
  const [res1, res2] = await Promise.all([p1, p2]);

  console.log("Result 1:", res1);
  console.log("Result 2:", res2);

  if (res1[0]?.id === "user-1" && res2[0]?.id === "user-2") {
    console.log("✅ Invisible Batching SUCCESS: Both calls resolved correctly.");
  } else {
    console.log("❌ Invisible Batching FAILED: Results mismatch.");
  }
})();
