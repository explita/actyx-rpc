"use client";

import { useInfiniteQuery } from "@/dist/react";
import { getPosts } from "../../lib/rpc/pagination";
import { Loader2 } from "lucide-react";

export default function PaginationDemo() {
  const { data, hasNext, fetchNext, isFetching, error, isError } =
    useInfiniteQuery(getPosts, {
      initialInput: { limit: 5 },
      queryKey: ["posts"],
    });

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Pagination Demo</h2>
        <p className="mt-2 text-gray-600">
          Fetching posts using <code>useInfiniteQuery</code> and cursor-based
          pagination.
        </p>
      </div>

      {isError && (
        <div className="rounded-md bg-red-50 p-4 mb-6">
          <p className="text-sm text-red-700">
            {error?.message || "An error occurred"}
          </p>
        </div>
      )}

      <div className="space-y-6">
        {data.map((post) => (
          <div
            key={post.id}
            className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {post.title}
            </h3>
            <p className="text-gray-600">{post.excerpt}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-center">
        {hasNext ? (
          <button
            onClick={() => fetchNext()}
            disabled={isFetching}
            className="inline-flex items-center rounded-md bg-white px-6 py-3 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 transition-all"
          >
            {isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isFetching ? "Loading more..." : "Load more posts"}
          </button>
        ) : (
          <p className="text-gray-500 text-sm">
            You have reached the end of the internet.
          </p>
        )}
      </div>
    </div>
  );
}
