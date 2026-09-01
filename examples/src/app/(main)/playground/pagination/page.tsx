"use client";

import { useInfiniteQuery } from "@/dist/react";
import { getPosts } from "../../../../lib/rpc/pagination";
import { Loader2, Layers } from "lucide-react";

export default function PaginationDemo() {
  const { data, hasNext, fetchNext, isFetching, error, isError } =
    useInfiniteQuery(getPosts, {
      input: { limit: 5 },
      queryKey: ["posts"],
    });

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
      <div className="mb-10">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Layers size={24} className="text-purple-600 dark:text-purple-400" />
          Pagination Demo
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Fetching posts using{" "}
          <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs font-mono text-purple-600 dark:text-purple-400">
            useInfiniteQuery
          </code>{" "}
          and cursor-based pagination.
        </p>
      </div>

      {isError && (
        <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 p-4 mb-6 border border-rose-200 dark:border-rose-900/50">
          <p className="text-sm text-rose-700 dark:text-rose-300">
            {error?.message || "An error occurred"}
          </p>
        </div>
      )}

      <div className="space-y-4">
        {data.map((post) => (
          <div
            key={post.id}
            className="bg-white dark:bg-slate-900/40 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-all hover:shadow-md hover:-translate-y-0.5 duration-200"
          >
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-200 mb-2">
              {post.title}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {post.excerpt}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-10 flex justify-center">
        {hasNext ? (
          <button
            onClick={() => fetchNext()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 rounded-xl bg-white dark:bg-slate-900/40 px-6 py-3 text-sm font-semibold text-slate-900 dark:text-slate-200 shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-all"
          >
            {isFetching && <Loader2 className="h-4 w-4 animate-spin" />}
            {isFetching ? "Loading more..." : "Load more posts"}
          </button>
        ) : (
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            You have reached the end.
          </p>
        )}
      </div>
    </div>
  );
}
