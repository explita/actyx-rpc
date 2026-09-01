---
sidebar_position: 5
title: Mutations & File Uploads
---

# Mutations & File Uploads

Use the `useMutation` hook to run write-style procedures, track load states, check validation issues, and monitor upload progress.

---

## `useMutation`

Execute state-changing mutations with validation tracking:

```tsx
import { useMutation } from "@explita/actyx-rpc/react";
import { createPost } from "@/backend/procedures";

function CreatePostForm() {
  const mutation = useMutation(createPost, {
    onSuccess(data) {
      console.log("Post created successfully!", data);
    },
    onError(message) {
      console.error("Mutation failed:", message);
    },
    onValidationErrors(errors) {
      console.log("Validation details:", errors);
    },
  });

  const handleSubmit = async () => {
    await mutation.mutate({
      title: "New Article",
      body: "Content goes here...",
    });
  };

  return (
    <div>
      {mutation.validationErrors?.title && (
        <p className="error">{mutation.validationErrors.title}</p>
      )}
      <button onClick={handleSubmit} disabled={mutation.isPending}>
        {mutation.isPending ? "Submitting..." : "Submit Article"}
      </button>
    </div>
  );
}
```

### Configuration Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `mutationKey` | `unknown[] \| string` | Auto-generated | Unique key identifying this mutation. Enables per-key concurrency locking (concurrent calls for the same key return 429 "Already in progress"). |
| `debounce` | `number` | `0` | Delay in ms to coalesce repeated `mutate()` calls. |
| `abortController` | `AbortController` | — | External `AbortController` to cancel URL-based mutations from outside the hook. |
| `onSuccess` | `(data, context, ...args) => void` | — | Callback run when the mutation succeeds. |
| `onError` | `(error, context, ...args) => void` | — | Callback run when the mutation fails. |
| `onSettled` | `(data, error, context, ...args) => void` | — | Callback run when the mutation finishes (success or error). |
| `onValidationErrors` | `(errors) => void` | — | Callback run when resolver schema validation fails. |
| `onProgress` | `(progress: number) => void` | — | Callback run with upload progress percentage (0-100) for URL endpoint mutations. |
| `optimisticUpdate` | `(input) => void` | — | Perform immediate UI updates before server confirmation. |
| `rollback` | `(input) => void` | — | Revert optimistic UI updates if the mutation fails. |

### Returned Values

The hook returns the following control and state properties:

* **`mutate`**: Trigger function to execute the mutation (`(input?, ...args?) => Promise<TData>`).
* **`isPending`**: Boolean state tracking execution.
* **`data`**: The result payload (on success).
* **`error`**: Mapped execution error details.
* **`validationErrors`**: Nested validation details from resolvers.
* **`reset`**: Resets the mutation state back to idle.
* **`abort`**: Sends a cancellation signal to abort the active network request.

---

## Real-Time Upload Progress Tracking

Because standard Next.js Server Actions encapsulate the request payload and do not expose transport events, they cannot track file upload progress. 

To track upload progress, pass a **URL endpoint** to `useMutation` instead of a procedure instance.

### 1. Set Up the Route Handler
Create a route handler (e.g. `app/api/rpc/upload/route.ts`) wrapping your procedure:

```ts
import { createRouteHandler } from "@explita/actyx-rpc/adapters/next";
import { testUpload } from "@/backend/procedures";

// Mount standard POST route handler
export const POST = createRouteHandler(testUpload);
```

### 2. Configure `useMutation` with the URL
Pass the endpoint path to `useMutation` and hook into `onProgress`:

```tsx
function UploadFileForm() {
  const upload = useMutation("/api/rpc/upload", {
    onProgress: (percent) => {
      console.log(`Upload progress: ${percent}%`);
    },
    onSuccess: (response) => {
      console.log("Upload finished!", response);
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Mutate accepts a File directly
    await upload.mutate(file);
  };

  return <input type="file" onChange={handleFileChange} disabled={upload.isPending} />;
}
```

---

## Upload Storage Strategies

Actyx RPC supports two ways to upload files depending on what you pass to `mutate()`:

### 1. Binary Stream Mode (Highly Efficient)
If you pass a `File` or `Blob` instance directly to `mutate`, Actyx RPC sends the payload as `application/octet-stream`. 

This is the most efficient way to upload large files (e.g. 500MB+) because it bypasses multipart parsing overhead entirely.

### 2. Auto-FormData Mode
If you pass an object containing `File`/`Blob` instances, Actyx RPC automatically packs the fields into a `multipart/form-data` payload structure:

```ts
await upload.mutate({
  title: "Profile Picture",
  file: selectedFile,
  metadata: { size: selectedFile.size },
});
```

### Server-Side Ingestion
On the server, you handle these uploads cleanly using standard web-router signatures. Here is how you can set up route handlers for both modes (shown using Next.js as an example framework):

#### 1. Handling Binary Streams (Highly Efficient)
For direct octet binary streams, you access the standard Web `Request` body stream (`req.body`) inside your `.webRoute`:

```ts
import { procedure } from "@/lib/rpc/init";
import { createRouteHandler } from "@explita/actyx-rpc/adapters/next";
import { Readable } from "stream";
import fs from "fs";

export const POST = createRouteHandler(
  procedure.webRoute(async ({ input, ctx }, req) => {
    const stream = req.body; // Native Web ReadableStream
    if (!stream) {
      throw new Error("No payload stream provided");
    }

    // Pipe the web stream to disk/storage
    const nodeStream = Readable.fromWeb(stream as any);
    const writeStream = fs.createWriteStream("./uploads/file.png");
    await new Promise((resolve, reject) => {
      nodeStream.pipe(writeStream);
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    return { success: true };
  })
);
```

#### 2. Handling Multipart Form-Data
For standard Form-Data requests, files are automatically parsed by the core router and mapped straight to your schema validation inputs:

```ts
import { procedure } from "@/lib/rpc/init";
import { createRouteHandler } from "@explita/actyx-rpc/adapters/next";
import { zodResolver } from "@explita/actyx-rpc/resolvers/zod";
import { z } from "zod";
import fs from "fs";

export const POST = createRouteHandler(
  procedure
    .input(
      zodResolver(
        z.object({
          file: z.instanceof(File),
          description: z.string().optional(),
        })
      )
    )
    .webRoute(async ({ input }) => {
      const file = input.file; // Fully resolved standard File instance
      const arrayBuffer = await file.arrayBuffer();
      
      await fs.promises.writeFile("./uploads/file.png", Buffer.from(arrayBuffer));
      return { success: true };
    })
);
```
