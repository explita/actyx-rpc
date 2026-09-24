import { describe, it, expect, vi } from "vitest";
import { createClient } from "../../packages/react/src/client/create-client.js";

describe("Client Interceptors and Auth Refresh Loop (401 Retry)", () => {
  it("should intercept 401, refresh token, and transparently retry the request", async () => {
    let token = "expired-token";
    let callCount = 0;
    const fetchHeadersReceived: Record<string, string>[] = [];

    const mockFetch = vi.fn(async (url: string, init?: any) => {
      callCount++;
      fetchHeadersReceived.push(init?.headers || {});

      if (init?.headers?.Authorization === "Bearer valid-token") {
        return {
          status: 200,
          ok: true,
          json: async () => ({ id: "item-123", name: "Authenticated Data" }),
        };
      }

      return {
        status: 401,
        ok: false,
        json: async () => ({ message: "Unauthorized: Token Expired" }),
      };
    });

    const rpc = createClient<any>({
      baseUrl: "https://api.example.com/rpc",
      headers: () => ({
        Authorization: `Bearer ${token}`,
      }),
      fetch: mockFetch,
      interceptors: {
        async onResponse({ response, retry }) {
          if (response.status === 401) {
            // Simulate async token refresh
            token = "valid-token";
            return retry();
          }
        },
      },
    });

    const [data, err] = await rpc.users.profile();

    expect(err).toBeNull();
    expect(data).toEqual({ id: "item-123", name: "Authenticated Data" });
    expect(callCount).toBe(2);
    expect(fetchHeadersReceived[0]?.Authorization).toBe("Bearer expired-token");
    expect(fetchHeadersReceived[1]?.Authorization).toBe("Bearer valid-token");
  });

  it("should support passing custom header overrides directly to retry()", async () => {
    let callCount = 0;
    const headersList: Record<string, string>[] = [];

    const mockFetch = vi.fn(async (url: string, init?: any) => {
      callCount++;
      headersList.push(init?.headers || {});

      if (init?.headers?.["X-Refreshed-Token"] === "fresh-secret") {
        return {
          status: 200,
          ok: true,
          json: async () => ({ success: true }),
        };
      }

      return {
        status: 401,
        ok: false,
        json: async () => ({ message: "Need refreshed token" }),
      };
    });

    const rpc = createClient<any>({
      baseUrl: "https://api.example.com/rpc",
      fetch: mockFetch,
      interceptors: {
        async onResponse({ response, retry }) {
          if (response.status === 401) {
            return retry({
              headers: {
                "X-Refreshed-Token": "fresh-secret",
              },
            });
          }
        },
      },
    });

    const [data, err] = await rpc.data.secureAction();

    expect(err).toBeNull();
    expect(data).toEqual({ success: true });
    expect(callCount).toBe(2);
    expect(headersList[1]?.["X-Refreshed-Token"]).toBe("fresh-secret");
  });

  it("should protect against infinite retry loops with maxRetries guard", async () => {
    let attempts = 0;

    const mockFetch = vi.fn(async () => {
      attempts++;
      return {
        status: 401,
        ok: false,
        json: async () => ({ message: "Always fails" }),
      };
    });

    const rpc = createClient<any>({
      baseUrl: "https://api.example.com/rpc",
      fetch: mockFetch,
      maxRetries: 2,
      interceptors: {
        async onResponse({ response, retry }) {
          if (response.status === 401) {
            return retry();
          }
        },
      },
    });

    const [data, err] = await rpc.resource.forbidden();

    expect(data).toBeNull();
    expect(err).toBeDefined();
    expect(err?.reason).toBe("MAX_RETRIES_EXCEEDED");
    // Initial attempt (1) + 2 retries = 3 attempts total
    expect(attempts).toBe(3);
  });

  it("should support onRequest interceptor to modify headers and options", async () => {
    let receivedHeaders: Record<string, string> = {};

    const mockFetch = vi.fn(async (url: string, init?: any) => {
      receivedHeaders = init?.headers || {};
      return {
        status: 200,
        ok: true,
        json: async () => ({ ok: true }),
      };
    });

    const rpc = createClient<any>({
      baseUrl: "https://api.example.com/rpc",
      fetch: mockFetch,
      interceptors: {
        onRequest({ headers, procedure }) {
          return {
            headers: {
              ...headers,
              "X-Trace-Id": "trace-999",
              "X-Target-Proc": procedure,
            },
          };
        },
      },
    });

    const [data, err] = await rpc.orders.checkout({ total: 100 });

    expect(err).toBeNull();
    expect(data).toEqual({ ok: true });
    expect(receivedHeaders["X-Trace-Id"]).toBe("trace-999");
    expect(receivedHeaders["X-Target-Proc"]).toBe("orders.checkout");
  });

  it("should support onError interceptor on network failure with retry", async () => {
    let callCount = 0;

    const mockFetch = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error("Failed to fetch: Network offline");
      }
      return {
        status: 200,
        ok: true,
        json: async () => ({ reconnected: true }),
      };
    });

    const rpc = createClient<any>({
      baseUrl: "https://api.example.com/rpc",
      fetch: mockFetch,
      interceptors: {
        onError({ error, retry }) {
          if (error.message?.includes("Network offline")) {
            return retry();
          }
        },
      },
    });

    const [data, err] = await rpc.network.ping();

    expect(err).toBeNull();
    expect(data).toEqual({ reconnected: true });
    expect(callCount).toBe(2);
  });

  it("should handle Axios-style thrown errors with 401 response and retry", async () => {
    let token = "bad";
    let callCount = 0;

    // Simulate Axios which throws on non-2xx with error.response
    const mockAxiosLikeFetch = vi.fn(async (url: string, config?: any) => {
      callCount++;
      if (config?.headers?.Authorization === "Bearer good") {
        return {
          status: 200,
          data: { greeting: "Hello authenticated user!" },
        };
      }

      const axiosError: any = new Error("Request failed with status code 401");
      axiosError.response = {
        status: 401,
        data: { message: "Unauthorized" },
      };
      throw axiosError;
    });

    const rpc = createClient<any>({
      baseUrl: "https://api.example.com/rpc",
      headers: () => ({
        Authorization: `Bearer ${token}`,
      }),
      fetch: mockAxiosLikeFetch,
      interceptors: {
        async onResponse({ response, retry }) {
          if (response.status === 401) {
            token = "good";
            return retry();
          }
        },
      },
    });

    const [data, err] = await rpc.auth.greeting();

    expect(err).toBeNull();
    expect(data).toEqual({ greeting: "Hello authenticated user!" });
    expect(callCount).toBe(2);
  });
});
