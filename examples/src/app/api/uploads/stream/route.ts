import { procedure } from "@/lib/rpc/init";
import { createRouteHandler } from "@/dist/adapters/next";
import fs from "fs";
import path from "path";
import { Readable } from "stream";

const streamHandler = procedure.webRoute(async ({ input, ctx }, req) => {
  const stream = req.body;
  if (!stream) {
    return new Response(
      JSON.stringify({ success: false, message: "No stream body" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const filenameEncoded = req.headers.get("x-file-name");
  const name = filenameEncoded || `streamed-${Date.now()}`;

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await fs.promises.mkdir(uploadsDir, { recursive: true });
  const filePath = path.join(uploadsDir, name);

  const nodeStream = Readable.fromWeb(stream as any);
  const writeStream = fs.createWriteStream(filePath);

  await new Promise<void>((resolve, reject) => {
    nodeStream.pipe(writeStream);
    nodeStream.on("error", reject);
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
  });

  return {
    success: true,
    file: {
      name,
      url: `/uploads/${name}`,
      savedPath: filePath,
      description: "Uploaded via Binary Stream Mode",
    },
  };
});

export const POST = createRouteHandler(streamHandler);
