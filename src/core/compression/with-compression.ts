import { Compressor } from "./compressor.js";
import type { CompressionOptions } from "./types.js";

export function withCompression<TInput, TOutput>(
  handler: (
    opts: { ctx: any; input: TInput },
    ...args: any[]
  ) => Promise<TOutput>,
  compressor: Compressor,
  options?: CompressionOptions,
): (opts: { ctx: any; input: TInput }, ...args: any[]) => Promise<TOutput> {
  return async (opts, ...args): Promise<TOutput> => {
    // Decompress input if needed
    let decompressedInput = opts.input;
    if (Buffer.isBuffer(opts.input) || (opts.input as any)?.type === "Buffer") {
      decompressedInput = await compressor.decompress(opts.input);
      opts = { ...opts, input: decompressedInput };
    }

    // Call handler
    const result = await handler(opts, ...args);

    // Compress response with per-call options
    const compressResponse =
      options?.compressResponse &&
      compressor.shouldCompress(result, options.threshold);

    if (compressResponse) {
      const { compressed, data } = await compressor.compress(result, options);
      if (compressed) {
        return data as TOutput;
      }
    }

    return result;
  };
}
