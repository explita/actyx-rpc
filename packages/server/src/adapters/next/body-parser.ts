export type ParsedBodyResult = {
  input: any;
  extraArgs: any[];
};

import { formDataToObject } from "../../lib/utils.js";


/**
 * Parses request input and extra args from URL or request body.
 * Always clones the request before reading to keep the original request body stream unconsumed.
 */
export async function parseRequestBody(
  req: Request,
  url: URL,
): Promise<ParsedBodyResult> {
  let input: any = undefined;
  let extraArgs: any[] = [];

  if (req.method === "GET" || req.method === "HEAD") {
    const argsStr = url.searchParams.get("args");
    if (argsStr) {
      try {
        extraArgs = JSON.parse(argsStr);
        if (!Array.isArray(extraArgs)) extraArgs = [];
      } catch {}
    }
    const inputStr = url.searchParams.get("input");
    if (inputStr) {
      try {
        input = JSON.parse(inputStr);
      } catch {
        input = inputStr;
      }
    } else {
      const entries = Object.fromEntries(url.searchParams.entries());
      delete entries.procedure;
      delete entries.args;
      if (Object.keys(entries).length > 0) {
        input = entries;
      }
    }
    return { input, extraArgs };
  }

  // Always clone request before consuming body so the original req stream remains available downstream
  const clonedReq = req.clone();
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const body = await clonedReq.json();
      if (body !== null && typeof body === "object" && !Array.isArray(body)) {
        if ("args" in body && Array.isArray(body.args)) {
          extraArgs = body.args;
        }
        input = "input" in body ? body.input : body;
      } else {
        input = body;
      }
    } catch {
      input = undefined;
    }
  } else if (
    contentType.includes("multipart/form-data") ||
    contentType.includes("application/x-www-form-urlencoded")
  ) {
    try {
      const formData = await clonedReq.formData();

      // Check for args in formData or query string
      const formArgs = formData.get("args");
      if (typeof formArgs === "string") {
        try {
          extraArgs = JSON.parse(formArgs);
          if (!Array.isArray(extraArgs)) extraArgs = [];
        } catch {}
      } else {
        const queryArgs = url.searchParams.get("args");
        if (queryArgs) {
          try {
            extraArgs = JSON.parse(queryArgs);
            if (!Array.isArray(extraArgs)) extraArgs = [];
          } catch {}
        }
      }

      // Check if a direct file was passed (tagged by client)
      if (formData.get("__direct_file__") === "true") {
        input = formData.get("file");
      } else {
        input = formDataToObject(formData);
      }
    } catch {
      input = undefined;
    }
  } else {
    const inputStr = url.searchParams.get("input");
    if (inputStr) {
      try {
        input = JSON.parse(inputStr);
      } catch {
        input = inputStr;
      }
    }
  }

  return { input, extraArgs };
}
