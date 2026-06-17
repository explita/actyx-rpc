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

### Returned Values

The hook returns the following control and state properties:

* **`mutate`**: Trigger function to execute the mutation.
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
import { createNextHandler } from "@explita/actyx-rpc/adapters/next";
import { testUpload } from "@/backend/procedures";

// Mount standard POST route handler
export const POST = createNextHandler(testUpload);
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
On the server, your procedure recovers files cleanly regardless of which mode was chosen:

```ts
export const testUpload = procedure
  .input(z.object({ file: z.instanceof(File).optional() }))
  .mutation(async ({ input, ctx }, fileDataArg: File) => {
    // Falls back to direct binary argument if not present on form input
    const fileData = fileDataArg || (input as any)?.file;

    if (!fileData) {
      throw new Error("No file uploaded");
    }

    // Access standard Web Readable Stream to write/process data
    const stream = fileData.stream();
    // ... write to S3/Disk
  });
```
