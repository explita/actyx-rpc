---
sidebar_position: 4
title: Mocking & Stubbing
---

# Mocking & Stubbing

Actyx RPC includes built-in output stubbing capabilities, allowing you to develop and test frontend applications before backend APIs or databases are fully set up.

---

## `.mock()`

Register a mock output generator function on a procedure.

```ts
const getUser = procedure
  .mock(({ ctx }) => ({
    id: "user_123",
    name: "John Doe (Mocked)",
    role: "admin",
  }))
  .query(async ({ input }) => {
    // This handler will be SKIPPED if ACTYX_MOCK="true"
    return await db.users.find(input.id);
  });
```

### Activation

Mocks are active when the environment variable **`ACTYX_MOCK="true"`** is defined. When active:

1. Global middlewares, custom resolvers, and `.authorize()` policies still run.
2. The real procedure handler is skipped.
3. The mock function returns the result payload.

> [!TIP]
> When mocking is active, input validation requirements are loosened in the TypeScript compiler, making input parameters optional. This allows you to call procedures like `createUser()` in development without providing dummy data.

---

## Testing Failure States

To verify how your UI responds to errors, throw an error within the mock function:

```ts
const getUser = procedure
  .mock(() => {
    throw { 
      success: false, 
      message: "Database connection failed", 
      reason: "DB_ERROR" 
    };
  })
  .query(async () => { ... });
```

---

## Mocking File Uploads

You can mock binary payloads and files to test file processing workflows programmatically without opening a browser:

```ts
const uploadAvatar = procedure
  .mock(() => ({
    userId: "user_1",
    file: new Blob(["fake-image-content"], { type: "image/png" }),
  }))
  .mutation(async ({ input }) => {
    // Handler receives the mocked Blob/File structure
    await storage.upload(input.file);
  });
```
