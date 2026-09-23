/**
 * Tests for Client file serialization, bare file uploads, and upload progress.
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { executeFetch, hasFile, objectToFormData } from "../../packages/react/src/lib/client-helpers.js";

describe("Client Helpers: File Upload & Progress", () => {
  describe("hasFile", () => {
    it("should return false for primitives and plain objects without files", () => {
      expect(hasFile(null)).toBe(false);
      expect(hasFile(undefined)).toBe(false);
      expect(hasFile("string")).toBe(false);
      expect(hasFile(123)).toBe(false);
      expect(hasFile({ a: 1, b: "hello", c: [1, 2, 3] })).toBe(false);
    });

    it("should return true for bare File / Blob", () => {
      const file = new File(["test"], "test.txt");
      const blob = new Blob(["blob"]);
      expect(hasFile(file)).toBe(true);
      expect(hasFile(blob)).toBe(true);
    });

    it("should return true for nested objects and arrays containing File / Blob", () => {
      const file = new File(["test"], "test.txt");
      expect(hasFile({ avatar: file })).toBe(true);
      expect(hasFile({ nested: { deep: { file } } })).toBe(true);
      expect(hasFile([file])).toBe(true);
      expect(hasFile({ files: [{ file }] })).toBe(true);
    });
  });

  describe("objectToFormData", () => {
    it("should serialize objects with files and bracketed keys", () => {
      const file = new File(["content"], "doc.txt", { type: "text/plain" });
      const fd = objectToFormData({
        title: "Report",
        doc: file,
        tags: ["a", "b"],
      });

      expect(fd.get("title")).toBe("Report");
      expect(fd.get("doc")).toBeInstanceOf(File);
      expect((fd.get("doc") as File).name).toBe("doc.txt");
      // tags is an array without files, so it is JSON stringified to preserve types
      expect(fd.get("tags")).toBe(JSON.stringify(["a", "b"]));
    });

    it("should serialize arrays of files with index brackets", () => {
      const f1 = new File(["1"], "1.txt");
      const f2 = new File(["2"], "2.txt");
      const fd = objectToFormData({
        files: [f1, f2],
      });

      expect(fd.get("files[0]")).toBeInstanceOf(File);
      expect((fd.get("files[0]") as File).name).toBe("1.txt");
      expect(fd.get("files[1]")).toBeInstanceOf(File);
      expect((fd.get("files[1]") as File).name).toBe("2.txt");
    });
  });

  describe("executeFetch file handling", () => {
    it("should wrap bare File in FormData with __direct_file__ tag and omit Content-Type", async () => {
      let capturedRequest: any;

      const mockFetch = vi.fn(async (url: string, init: any) => {
        capturedRequest = { url, init };
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      const file = new File(["bare-test"], "bare.txt", { type: "text/plain" });

      const [data, err] = await executeFetch(
        "http://localhost/api/rpc",
        { baseUrl: "http://localhost/api/rpc", fetch: mockFetch },
        "uploadBare",
        file,
        { defaultMethod: "POST" },
      );

      expect(err).toBeNull();
      expect(data).toEqual({ ok: true });
      expect(capturedRequest.init.method).toBe("POST");
      expect(capturedRequest.init.body).toBeInstanceOf(FormData);

      const fd = capturedRequest.init.body as FormData;
      expect(fd.get("__direct_file__")).toBe("true");
      expect(fd.get("file")).toBeInstanceOf(File);
      expect((fd.get("file") as File).name).toBe("bare.txt");
      // Crucial: Content-Type header must NOT be manually set so browser adds boundary
      expect(capturedRequest.init.headers["Content-Type"]).toBeUndefined();
    });

    it("should convert object containing files to FormData and omit Content-Type", async () => {
      let capturedRequest: any;

      const mockFetch = vi.fn(async (url: string, init: any) => {
        capturedRequest = { url, init };
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      const file = new File(["avatar-bytes"], "avatar.png", { type: "image/png" });

      const [data, err] = await executeFetch(
        "http://localhost/api/rpc",
        { baseUrl: "http://localhost/api/rpc", fetch: mockFetch },
        "updateProfile",
        { avatar: file, username: "bob" },
        { defaultMethod: "POST" },
      );

      expect(err).toBeNull();
      expect(data).toEqual({ ok: true });
      expect(capturedRequest.init.body).toBeInstanceOf(FormData);

      const fd = capturedRequest.init.body as FormData;
      expect(fd.get("username")).toBe("bob");
      expect(fd.get("avatar")).toBeInstanceOf(File);
      expect((fd.get("avatar") as File).name).toBe("avatar.png");
      expect(capturedRequest.init.headers["Content-Type"]).toBeUndefined();
    });

    it("should pass through raw FormData unmodified", async () => {
      let capturedRequest: any;

      const mockFetch = vi.fn(async (url: string, init: any) => {
        capturedRequest = { url, init };
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      const rawFd = new FormData();
      rawFd.append("custom", "val");

      const [data, err] = await executeFetch(
        "http://localhost/api/rpc",
        { baseUrl: "http://localhost/api/rpc", fetch: mockFetch },
        "customAction",
        rawFd,
        { defaultMethod: "POST" },
      );

      expect(err).toBeNull();
      expect(capturedRequest.init.body).toBe(rawFd);
      expect(capturedRequest.init.headers["Content-Type"]).toBeUndefined();
    });

    it("should invoke onProgress callback using progressFetch", async () => {
      const progressEvents: number[] = [];

      // Mock XMLHttpRequest in jsdom
      const originalXHR = globalThis.XMLHttpRequest;
      class MockXHR {
        upload = {
          onprogress: null as any,
        };
        onload: any = null;
        onerror: any = null;
        status = 200;
        statusText = "OK";
        response = JSON.stringify({ uploaded: true });
        open(method: string, url: string) {}
        setRequestHeader(k: string, v: string) {}
        getAllResponseHeaders() {
          return "content-type: application/json\r\n";
        }
        send(body: any) {
          // Simulate progress
          setTimeout(() => {
            this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
            setTimeout(() => {
              this.upload.onprogress?.({ lengthComputable: true, loaded: 100, total: 100 });
              this.onload?.();
            }, 10);
          }, 10);
        }
      }

      (globalThis as any).XMLHttpRequest = MockXHR;

      try {
        const file = new File(["progress-test"], "file.dat");

        const [data, err] = await executeFetch(
          "http://localhost/api/rpc",
          { baseUrl: "http://localhost/api/rpc" },
          "uploadWithProgress",
          file,
          {
            defaultMethod: "POST",
            onProgress: (p: number) => {
              progressEvents.push(p);
            },
          },
        );

        expect(err).toBeNull();
        expect(data).toEqual({ uploaded: true });
        expect(progressEvents).toEqual([50, 100]);
      } finally {
        globalThis.XMLHttpRequest = originalXHR;
      }
    });
  });
});
