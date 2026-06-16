"use server";

import { procedure } from "./init";
import { zodResolver } from "@/dist/resolvers/zod";
import { z } from "zod";

type Post = {
  id: string;
  title: string;
  excerpt: string;
};

// Generate 50 mock posts
const allPosts: Post[] = Array.from({ length: 50 }).map((_, i) => ({
  id: `post_${i + 1}`,
  title: `Actyx RPC Tip #${i + 1}`,
  excerpt: `This is a randomly generated post excerpt for tip #${i + 1}. It showcases how you can easily fetch paginated data using the Actyx RPC framework.`,
}));

export const getPosts = procedure
  .input(
    zodResolver(
      z.object({
        limit: z.number().min(1).max(20).default(5).optional(),
        cursor: z.string().optional(),
      }),
    ),
  )
  .query(async ({ input }) => {
    // Artificial delay to simulate network latency
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Parse the cursor (defaults to 0 for the first page)
    const startIndex = input.cursor ? parseInt(input.cursor, 10) : 0;
    const endIndex = startIndex + (input.limit || 5);

    // Slice the data for the current page
    const data = allPosts.slice(startIndex, endIndex);

    // Determine if there are more pages
    const hasMore = endIndex < allPosts.length;
    const nextCursor = hasMore ? endIndex.toString() : undefined;

    return {
      data,
      nextCursor,
      hasMore,
    };
  });
