export type CompressionOptions = {
  /** Compression algorithm (default: 'gzip') */
  algorithm?: "gzip" | "deflate" | "brotli";
  /** Minimum size in bytes to trigger compression (default: 1024) */
  threshold?: number;
  /** Compression level 1-9 (default: 6) */
  level?: number;
  /** Whether to compress responses (default: false) */
  compressResponse?: boolean;
  /** Callback when compression occurs */
  onCompress?: (originalSize: number, compressedSize: number) => void;
};

export type CompressorConfig = {
  enabled: boolean;
  options?: CompressionOptions;
};
