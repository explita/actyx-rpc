// This adapter requires `next` to be installed in the consuming project.
// It is intentionally not listed as a dependency to keep actyx-rpc framework-agnostic.

import { ReadonlyHeaders } from "next/dist/server/web/spec-extension/adapters/headers";
import { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { headers, cookies } from "next/headers";

export async function nextAdapter() {
  let h: ReadonlyHeaders;
  let c: ReadonlyRequestCookies;

  try {
    h = await headers();
    c = await cookies();
  } catch (e) {
    h = new Headers();
    c = {
      get: () => undefined,
      set: () => {},
      delete: () => {},
      getAll: () => [],
      has: () => false,
      [Symbol.iterator]: function* () {},
    } as any;
  }

  const ip = h.get("x-forwarded-for")?.split(",")[0] ?? "127.0.0.1";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const referer = h.get("referer") ?? h.get("referrer") ?? "";
  const port = h.get("x-forwarded-port") ?? "";
  const platform = h.get("sec-ch-ua-platform")?.replace(/"/g, "") ?? "";
  const secChUa = h.get("sec-ch-ua") ?? "";
  const browser =
    [...secChUa.matchAll(/"([^"]+)";v="([^"]+)"/g)]
      .find((m) => m[1] !== "Not.A/Brand" && m[1] !== "Chromium")
      ?.slice(1, 3)
      .join("/") ?? "";
  let pathname = h.get("x-pathname") || "";
  if (!pathname && referer) {
    try {
      pathname = new URL(referer).pathname;
    } catch (e) {}
  }

  let searchParams: Record<string, string> = {};

  try {
    const searchParamsRaw = h.get("x-search-params");
    searchParams = searchParamsRaw ? JSON.parse(searchParamsRaw) : {};
  } catch (error) {}

  try {
    const search = referer
      ? Object.fromEntries(new URL(referer).searchParams.entries())
      : {};
    searchParams = {
      ...search,
      ...searchParams,
    };
  } catch (error) {}

  return {
    ip,
    host,
    port,
    origin: h.get("origin") ?? `${proto}://${host}`,
    referer,
    pathname,
    searchParams,
    proto,
    userAgent: h.get("user-agent") ?? "",
    browser,
    platform,
    locale: h.get("accept-language")?.split(",")[0] ?? "",
    contentType: h.get("content-type") ?? "",
    headers: h,
    cookies: c,
  };
}

export type NextAdapter = Awaited<ReturnType<typeof nextAdapter>>;
