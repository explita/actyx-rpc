import zlib from "zlib";
import { promisify } from "util";
import type { CompressionOptions } from "./types.js";

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const deflate = promisify(zlib.deflate);
const inflate = promisify(zlib.inflate);
const brotliCompress = promisify(zlib.brotliCompress);
const brotliDecompress = promisify(zlib.brotliDecompress);

export class Compressor {
  private options: Required<CompressionOptions>;

  constructor(options?: CompressionOptions) {
    this.options = {
      algorithm: options?.algorithm ?? "gzip",
      threshold: options?.threshold ?? 1024, // 1kb
      level: options?.level ?? 6,
      compressResponse: options?.compressResponse ?? false,
      onCompress: options?.onCompress ?? (() => {}),
    };
  }

  private async compressBuffer(
    data: Buffer,
    algorithm: string,
    level: number,
  ): Promise<Buffer> {
    switch (algorithm) {
      case "gzip":
        return gzip(data, { level });
      case "deflate":
        return deflate(data, { level });
      case "brotli":
        return brotliCompress(data, {
          params: { [zlib.constants.BROTLI_PARAM_QUALITY]: level },
        });
      default:
        return gzip(data, { level });
    }
  }

  private async decompressBuffer(
    data: Buffer,
    algorithm: string,
  ): Promise<Buffer> {
    switch (algorithm) {
      case "gzip":
        return gunzip(data);
      case "deflate":
        return inflate(data);
      case "brotli":
        return brotliDecompress(data);
      default:
        return gunzip(data);
    }
  }

  async compress<T>(
    data: T,
    options?: CompressionOptions,
  ): Promise<{ compressed: boolean; data: Buffer | T }> {
    const threshold = options?.threshold ?? this.options.threshold;
    const algorithm = options?.algorithm ?? this.options.algorithm;
    const level = options?.level ?? this.options.level;
    const onCompress = options?.onCompress ?? this.options.onCompress;

    const jsonStr = JSON.stringify(data);
    const originalSize = Buffer.byteLength(jsonStr);

    if (originalSize < threshold) {
      return { compressed: false, data };
    }

    const buffer = Buffer.from(jsonStr, "utf-8");
    const compressed = await this.compressBuffer(buffer, algorithm, level);

    onCompress(originalSize, compressed.length);

    return {
      compressed: true,
      data: compressed,
    };
  }

  async decompress<T>(
    data: Buffer | T,
    options?: CompressionOptions,
  ): Promise<T> {
    if (Buffer.isBuffer(data)) {
      const algorithm = options?.algorithm ?? this.options.algorithm;
      const decompressed = await this.decompressBuffer(data, algorithm);
      return JSON.parse(decompressed.toString("utf-8"));
    }
    return data;
  }

  shouldCompress(data: any, threshold?: number): boolean {
    const jsonStr = JSON.stringify(data);
    const size = Buffer.byteLength(jsonStr);
    const minSize = threshold ?? this.options.threshold;
    return size >= minSize;
  }
}
