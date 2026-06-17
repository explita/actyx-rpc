---
sidebar_position: 6
title: Response Compression
---

# Response Compression

Reduce network payload sizes for large payloads by enabling response compression. Actyx RPC handles compression on output and automatically decodes incoming compressed buffer payloads.

```ts
const getLargeReport = procedure
  .compress({
    algorithm: "gzip",
    threshold: 2048,          // Only compress payloads larger than 2KB
    compressResponse: true,
  })
  .query(async () => {
    return await generateReportData();
  });
```

## Compression Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `algorithm` | `'gzip' \| 'deflate' \| 'brotli'` | `'gzip'` | Compression algorithm used. |
| `threshold` | `number` | `1024` | Minimum payload size in bytes before applying compression. |
| `level` | `number` | `6` | Compression intensity level (ranging 1 to 9). |
| `compressResponse` | `boolean` | `false` | Enable/disable compressing the output payloads. |
| `onCompress` | `(original, compressed) => void` | — | Callback containing compression statistics (sizes). |

## Decompression on Cache Hit

If you cache a compressed procedure, make sure to configure `decompress: true` in your `.cache()` settings:

```ts
const getCachedReport = procedure
  .compress({ algorithm: "gzip", compressResponse: true })
  .cache({ ttl: 60000, decompress: true }) // Decompresses on cache hit
  .query(async () => { ... });
```
