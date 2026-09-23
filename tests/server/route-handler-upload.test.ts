/**
 * Tests for File upload support and request stream preservation in createHandler & body-parser.
 * @vitest-environment node
 */
import { describe, it, expect, vi } from "vitest";
import { createHandler } from "../../packages/server/src/adapters/next/index.js";
import { normalizeInput, formDataToObject } from "../../packages/server/src/lib/utils.js";
import { createProcedure } from "../../packages/server/src/core/server.js";

// Mock nextAdapter
vi.mock("../../packages/server/src/adapters/next/next-headers.js", () => ({
  nextAdapter: vi.fn(async () => ({
    headers: new Headers(),
    cookies: new Map(),
  })),
}));

describe("File Upload and Stream Cloning in Route Handler", () => {
  it("should parse direct bare File input tagged with __direct_file__", async () => {
    let receivedInput: any;

    const testProc = createProcedure().mutation(async ({ input }: any) => {
      receivedInput = input;
      return { fileName: input.name, fileSize: input.size, fileType: input.type };
    });

    const handler = createHandler({
      uploadBare: testProc,
    });

    const fd = new FormData();
    const file = new File(["hello world from bare file"], "test.txt", { type: "text/plain" });
    fd.append("file", file, file.name);
    fd.append("__direct_file__", "true");

    const req = new Request("http://localhost/api/rpc/uploadBare", {
      method: "POST",
      body: fd,
    });

    const res = await handler(req, { params: { rpc: ["uploadBare"] } });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.fileName).toBe("test.txt");
    expect(data.fileSize).toBe(26);
    expect(data.fileType).toBe("text/plain");
    expect(receivedInput).toBeInstanceOf(File);
  });

  it("should parse object containing a File instance", async () => {
    let receivedInput: any;

    const uploadAvatarProc = createProcedure().mutation(async ({ input }: { input: { avatar: any; username: string } }) => {
      receivedInput = input;
      return {
        username: input.username,
        fileName: input.avatar.name,
        content: await input.avatar.text(),
      };
    });

    const handler = createHandler({
      uploadAvatar: uploadAvatarProc,
    });

    const fd = new FormData();
    const file = new File(["avatar-binary-data"], "avatar.png", { type: "image/png" });
    fd.append("avatar", file, file.name);
    fd.append("username", "alice");

    const req = new Request("http://localhost/api/rpc/uploadAvatar", {
      method: "POST",
      body: fd,
    });

    const res = await handler(req, { params: { rpc: ["uploadAvatar"] } });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.username).toBe("alice");
    expect(data.fileName).toBe("avatar.png");
    expect(data.content).toBe("avatar-binary-data");
    expect(receivedInput.avatar).toBeInstanceOf(File);
  });

  it("should parse array of files (e.g. files: File[])", async () => {
    let receivedInput: any;

    const uploadFilesProc = createProcedure().mutation(async ({ input }: { input: { files: any[]; title: string } }) => {
      receivedInput = input;
      return {
        title: input.title,
        fileCount: input.files.length,
        names: input.files.map((f: any) => f.name),
      };
    });

    const handler = createHandler({
      uploadMulti: uploadFilesProc,
    });

    const fd = new FormData();
    const file1 = new File(["file-1-content"], "doc1.pdf", { type: "application/pdf" });
    const file2 = new File(["file-2-content"], "doc2.pdf", { type: "application/pdf" });
    fd.append("files[0]", file1, file1.name);
    fd.append("files[1]", file2, file2.name);
    fd.append("title", "My Documents");

    const req = new Request("http://localhost/api/rpc/uploadMulti", {
      method: "POST",
      body: fd,
    });

    const res = await handler(req, { params: { rpc: ["uploadMulti"] } });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.title).toBe("My Documents");
    expect(data.fileCount).toBe(2);
    expect(data.names).toEqual(["doc1.pdf", "doc2.pdf"]);
    expect(Array.isArray(receivedInput.files)).toBe(true);
    expect(receivedInput.files[0]).toBeInstanceOf(File);
    expect(receivedInput.files[1]).toBeInstanceOf(File);
  });

  it("should preserve unconsumed req body stream for downstream procedure access via req.clone()", async () => {
    let downstreamFormDataCanBeRead = false;
    let downstreamText = "";

    const inspectStreamProc = createProcedure({
      createContext: async (baseCtx, req) => ({ ok: true, ctx: { req } }),
    }).mutation(async function ({ ctx }: any) {
      // Access the original request via ctx.req in procedure context
      const req = ctx.req as Request;
      expect(req).toBeDefined();

      // Read cloned stream downstream - this will FAIL if body was not cloned prior to body-parser
      const cloned = req.clone();
      const fd = await cloned.formData();
      downstreamFormDataCanBeRead = fd.has("file");
      const file = fd.get("file") as File;
      downstreamText = await file.text();

      return { success: true };
    });

    const handler = createHandler({
      inspectStream: inspectStreamProc,
    });

    const fd = new FormData();
    const file = new File(["stream-content-test"], "stream.txt", { type: "text/plain" });
    fd.append("file", file, file.name);
    fd.append("__direct_file__", "true");

    const req = new Request("http://localhost/api/rpc/inspectStream", {
      method: "POST",
      body: fd,
    });

    const res = await handler(req, { params: { rpc: ["inspectStream"] } });
    expect(res.status).toBe(200);
    expect(downstreamFormDataCanBeRead).toBe(true);
    expect(downstreamText).toBe("stream-content-test");
  });

  it("should normalize input identically for Server Actions and HTTP Route Handlers", async () => {
    // 1. Bare File
    const bareFile = new File(["bare-content"], "bare.txt", { type: "text/plain" });
    const directResult = normalizeInput(bareFile);
    expect(directResult).toBe(bareFile);

    // Bare File wrapped in FormData (from client or server action)
    const bareFd = new FormData();
    bareFd.append("file", bareFile, bareFile.name);
    bareFd.append("__direct_file__", "true");
    const fdBareResult = normalizeInput(bareFd);
    expect(fdBareResult).toBeInstanceOf(File);
    expect((fdBareResult as any).name).toBe("bare.txt");

    // 2. Object with files & numeric arrays
    const complexFd = new FormData();
    const f1 = new File(["1"], "1.txt");
    const f2 = new File(["2"], "2.txt");
    complexFd.append("items[0][file]", f1, f1.name);
    complexFd.append("items[0][label]", "First");
    complexFd.append("items[1][file]", f2, f2.name);
    complexFd.append("items[1][label]", "Second");
    complexFd.append("metadata", JSON.stringify({ author: "Bob", count: 42 }));

    const parsed = normalizeInput(complexFd) as any;
    expect(Array.isArray(parsed.items)).toBe(true);
    expect(parsed.items.length).toBe(2);
    expect(parsed.items[0].label).toBe("First");
    expect(parsed.items[0].file).toBeInstanceOf(File);
    expect(parsed.items[1].label).toBe("Second");
    expect(parsed.items[1].file).toBeInstanceOf(File);
    expect(parsed.metadata).toEqual({ author: "Bob", count: 42 });
  });
});
