import { procedure } from "@/lib/rpc/init";
import { zodResolver } from "@/dist/resolvers/zod";
import { z } from "zod";
import fs from "fs";
import path from "path";

export const POST = procedure
  .input(
    zodResolver(
      z.object({
        file: z.instanceof(File),
        description: z.string().optional(),
      }),
    ),
  )
  .webRoute(async ({ input }) => {
    const file = input.file;
    const size = file.size;
    const name = file.name;
    const type = file.type;

    // Save the file to public/uploads directory
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await fs.promises.mkdir(uploadsDir, { recursive: true });

    const filePath = path.join(uploadsDir, name);
    const arrayBuffer = await file.arrayBuffer();
    await fs.promises.writeFile(filePath, Buffer.from(arrayBuffer));

    return {
      success: true,
      file: {
        name,
        size,
        type,
        url: `/uploads/${name}`,
        savedPath: filePath,
        description: input.description || "No description provided",
      },
    };
  });
