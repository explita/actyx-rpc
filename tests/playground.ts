import { createServer } from "http";
// @ts-ignore
import XMLHttpRequest from "xhr2";
// @ts-ignore
global.XMLHttpRequest = XMLHttpRequest;

import { createNextHandler } from "../src/adapters/next/next-handler.js";
import { progressFetch } from "../src/client/progress-fetch.js";
import { Readable } from "stream";

// 1. Define a dummy procedure that simulates a file upload
const testUpload = async (input: any, fileStream: any) => {
  console.log("[Server] Received upload request");

  if (fileStream) {
    console.log("[Server] Reading binary stream...");
    let bytesRead = 0;
    for await (const chunk of fileStream) {
      bytesRead += chunk.length;
      // Simulate slow processing
      await new Promise((r) => setTimeout(r, 10));
    }
    console.log(`[Server] Finished reading ${bytesRead} bytes`);
  }

  return [
    { success: true, message: "Upload simulated successfully" },
    null,
  ] as const;
};

// 2. Create the Next.js-like handler
const handler = createNextHandler(testUpload as any);

// 3. Start a local HTTP server to host the handler
const server = createServer(async (req, res) => {
  // Shim req to look like a Web Request for createNextHandler
  const chunks: any[] = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);

  const webReq = new Request(`http://localhost:3001${req.url}`, {
    method: req.method,
    headers: req.headers as any,
    body: req.method === "POST" ? body : null,
    // @ts-ignore - node-fetch / undici support
    duplex: "half",
  });

  const response = await handler(webReq);

  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  const resBody = await response.text();
  console.log(`[Server] Sending response: ${resBody}`);
  res.end(resBody);
});

server.listen(3001, async () => {
  console.log("[Playground] Server running at http://localhost:3001");

  // 4. Simulate the client call using progressFetch
  console.log("[Client] Starting FormData upload...");
  
  const fd = new FormData();
  // @ts-ignore
  fd.append("file", "dummy file content");

  try {
    const res = await progressFetch("http://localhost:3001", {
      method: "POST",
      body: fd,
      onProgress: (p) => {
        process.stdout.write(`\r[Client] Upload Progress: ${p.toFixed(2)}%`);
      }
    });

    const text = await res.text();
    console.log(`\n[Client] Raw Response: ${text}`);
    const data = JSON.parse(text);
    console.log("[Client] Parsed Data:", data);
  } catch (err) {
    console.error("\n[Client] Error:", err);
  } finally {
    server.close();
    console.log("[Playground] Server closed");
  }
});
