// This adapter requires `next` to be installed in the consuming project.
// It is intentionally not listed as a dependency to keep actyx-rpc framework-agnostic.

import { headers, cookies } from "next/headers";

export async function nextAdapter() {
  const h = await headers();
  const c = await cookies();

  const ip = h.get("x-forwarded-for")?.split(",")[0] ?? "127.0.0.1";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const pathname = h.get("x-pathname") ?? "";
  const searchParamsRaw = h.get("x-search-params");
  const platform = h.get("sec-ch-ua-platform")?.replace(/"/g, "") ?? "";
  const secChUa = h.get("sec-ch-ua") ?? "";
  const browser =
    [...secChUa.matchAll(/"([^"]+)";v="([^"]+)"/g)]
      .find((m) => m[1] !== "Not.A/Brand" && m[1] !== "Chromium")
      ?.slice(1, 3)
      .join("/") ?? "";

  return {
    ip,
    host,
    origin: h.get("origin") ?? `${proto}://${host}`,
    referer: h.get("referer") ?? "",
    pathname,
    searchParams: searchParamsRaw
      ? (JSON.parse(searchParamsRaw) as Record<string, string>)
      : {},
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
