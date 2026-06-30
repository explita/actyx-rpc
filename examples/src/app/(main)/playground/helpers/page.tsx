"use client";

import {
  useInfiniteQuery,
  usePaginatedQuery,
  useQueryClient,
} from "@/dist/react";
import { getTodos } from "@/lib/rpc/actions";
import { getPosts } from "@/lib/rpc/pagination";
import { Loader2, Wrench, Layers } from "lucide-react";
import { useState } from "react";

const INF_KEY = ["helpers-inf"];
const PAG_KEY = ["helpers-pag"];

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${color}`}
    >
      {label}
    </span>
  );
}

function PostRow({
  post,
  index,
  highlight,
}: {
  post: { id: string; title: string; excerpt: string; _tag?: string };
  index: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
        highlight
          ? "border-blue-400 dark:border-blue-500/50 bg-blue-50 dark:bg-blue-950/30"
          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/80 hover:shadow-sm"
      }`}
    >
      <span className="text-xs font-mono text-slate-400 dark:text-slate-500 pt-1 w-5 shrink-0">
        {index}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
          {post.title}
        </p>
        {post._tag && (
          <Badge
            label={post._tag}
            color="bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 mt-1"
          />
        )}
      </div>
    </div>
  );
}

function InfiniteSection() {
  const {
    data,
    isFetching,
    hasNext,
    fetchNext,
    prepend,
    append,
    insert,
    remove,
    update,
    snapshot,
    reset,
  } = useInfiniteQuery(getPosts, {
    initialInput: { limit: 5 },
    queryKey: INF_KEY,
  });

  const [log, setLog] = useState<string[]>([]);
  const addLog = (msg: string) =>
    setLog((l) =>
      [`[${new Date().toLocaleTimeString()}] ${msg}`, ...l].slice(0, 8),
    );

  const syntheticPost = (label: string) => ({
    id: `synthetic-${Date.now()}`,
    title: `${label} — synthetic post`,
    excerpt: "Added client-side only",
    _tag: label,
  });

  function handlePrepend() {
    prepend(syntheticPost("prepend"));
    addLog("prepend — added to beginning");
  }

  function handleAppend() {
    append(syntheticPost("append"));
    addLog("append — added to end");
  }

  function handleInsert() {
    insert(2, syntheticPost("insert@2"));
    addLog("insert(2) — inserted at position 2");
  }

  function handleRemove() {
    if (data.length === 0) return;
    remove(0);
    addLog("remove(0) — removed item at index 0");
  }

  function handleRemovePredicate() {
    remove((item: any) => item.id?.startsWith("synthetic-"));
    addLog("remove(fn) — removed all synthetic posts");
  }

  function handleUpdate() {
    update(0, (item: any) => ({
      ...item,
      title: `[updated] ${item.title}`,
      _tag: "updated",
    }));
    addLog("update(0) — updated item at index 0");
  }

  function handleSnapshot() {
    const restore = snapshot();
    addLog("snapshot() — captured. Appending in 1s, restoring in 3s…");
    setTimeout(() => {
      append(syntheticPost("pre-restore"));
    }, 1000);
    setTimeout(() => {
      restore();
      addLog("snapshot restore() — data rolled back");
    }, 3000);
  }

  function handleReset() {
    reset();
    addLog("reset() — cleared back to initial state");
  }

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-200">
          useInfiniteQuery helpers
        </h2>
        <Badge
          label={`${data.length} items`}
          color="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          {
            label: "prepend",
            fn: handlePrepend,
            color: "bg-blue-600 hover:bg-blue-700",
          },
          {
            label: "append",
            fn: handleAppend,
            color: "bg-indigo-600 hover:bg-indigo-700",
          },
          {
            label: "insert(2)",
            fn: handleInsert,
            color: "bg-violet-600 hover:bg-violet-700",
          },
          {
            label: "remove(0)",
            fn: handleRemove,
            color: "bg-rose-600 hover:bg-rose-700",
          },
          {
            label: "remove synthetics",
            fn: handleRemovePredicate,
            color: "bg-red-600 hover:bg-red-700",
          },
          {
            label: "update(0)",
            fn: handleUpdate,
            color: "bg-amber-500 hover:bg-amber-600",
          },
          {
            label: "snapshot + restore",
            fn: handleSnapshot,
            color: "bg-teal-600 hover:bg-teal-700",
          },
          {
            label: "reset",
            fn: handleReset,
            color: "bg-slate-600 hover:bg-slate-700",
          },
        ].map(({ label, fn, color }) => (
          <button
            key={label}
            onClick={fn}
            className={`px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition-colors ${color}`}
          >
            {label}
          </button>
        ))}
      </div>

      {log.length > 0 && (
        <div className="bg-slate-900 dark:bg-slate-950 text-emerald-400 rounded-lg p-3 text-xs font-mono space-y-1 max-h-36 overflow-auto border border-slate-800">
          {log.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}

      <div className="space-y-2 max-h-72 overflow-auto pr-1">
        {data.map((post: any, i) => (
          <PostRow
            key={post.id}
            post={post}
            index={i}
            highlight={!!post._tag}
          />
        ))}
        {data.length === 0 && (
          <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6">
            Empty
          </p>
        )}
      </div>

      <div className="flex justify-center">
        {hasNext ? (
          <button
            onClick={() => fetchNext()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-all"
          >
            {isFetching && <Loader2 className="h-4 w-4 animate-spin" />}
            Load next page
          </button>
        ) : (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            All pages loaded
          </p>
        )}
      </div>
    </section>
  );
}

function PaginatedSection() {
  const {
    data,
    isFetching,
    hasNext,
    hasPrevious,
    fetchNext,
    fetchPrevious,
    prepend,
    append,
    insert,
    remove,
    update,
    snapshot,
    reset,
  } = usePaginatedQuery(getPosts, {
    initialInput: { limit: 5 },
    queryKey: PAG_KEY,
  });

  const [log, setLog] = useState<string[]>([]);
  const addLog = (msg: string) =>
    setLog((l) =>
      [`[${new Date().toLocaleTimeString()}] ${msg}`, ...l].slice(0, 8),
    );

  const syntheticPost = (label: string) => ({
    id: `synthetic-${Date.now()}`,
    title: `${label} — synthetic post`,
    excerpt: "Added client-side only",
    _tag: label,
  });

  function handlePrepend() {
    prepend(syntheticPost("prepend") as any);
    addLog("prepend — added to beginning");
  }
  function handleAppend() {
    append(syntheticPost("append") as any);
    addLog("append — added to end");
  }
  function handleInsert() {
    insert(1, syntheticPost("insert@1") as any);
    addLog("insert(1) — inserted at position 1");
  }
  function handleRemove() {
    if (data.length === 0) return;
    remove((item: any) => item.id?.startsWith("synthetic-"));
    addLog("remove(fn) — removed all synthetic posts");
  }
  function handleUpdate() {
    update(
      (item: any) => !item.id?.startsWith("synthetic-"),
      (item: any) => ({
        ...item,
        title: `[updated] ${item.title}`,
        _tag: "updated",
      }),
    );
    addLog("update(fn) — updated all real posts");
  }
  function handleSnapshot() {
    const restore = snapshot();
    addLog("snapshot() — captured. Appending in 1s, restoring in 3s…");
    setTimeout(() => append(syntheticPost("snap") as any), 1000);
    setTimeout(() => {
      restore();
      addLog("snapshot restore() — rolled back");
    }, 3000);
  }
  function handleReset() {
    reset();
    addLog("reset() — cleared back to initial");
  }

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-200">
          usePaginatedQuery helpers
        </h2>
        <Badge
          label={`${data.length} items`}
          color="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          {
            label: "prepend",
            fn: handlePrepend,
            color: "bg-blue-600 hover:bg-blue-700",
          },
          {
            label: "append",
            fn: handleAppend,
            color: "bg-indigo-600 hover:bg-indigo-700",
          },
          {
            label: "insert(1)",
            fn: handleInsert,
            color: "bg-violet-600 hover:bg-violet-700",
          },
          {
            label: "remove synthetics",
            fn: handleRemove,
            color: "bg-rose-600 hover:bg-rose-700",
          },
          {
            label: "update all real",
            fn: handleUpdate,
            color: "bg-amber-500 hover:bg-amber-600",
          },
          {
            label: "snapshot + restore",
            fn: handleSnapshot,
            color: "bg-teal-600 hover:bg-teal-700",
          },
          {
            label: "reset",
            fn: handleReset,
            color: "bg-slate-600 hover:bg-slate-700",
          },
        ].map(({ label, fn, color }) => (
          <button
            key={label}
            onClick={fn}
            className={`px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition-colors ${color}`}
          >
            {label}
          </button>
        ))}
      </div>

      {log.length > 0 && (
        <div className="bg-slate-900 dark:bg-slate-950 text-emerald-400 rounded-lg p-3 text-xs font-mono space-y-1 max-h-36 overflow-auto border border-slate-800">
          {log.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}

      <div className="space-y-2 max-h-72 overflow-auto pr-1">
        {data.map((post: any, i) => (
          <PostRow
            key={post.id}
            post={post}
            index={i}
            highlight={!!post._tag}
          />
        ))}
        {data.length === 0 && (
          <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6">
            Empty
          </p>
        )}
      </div>

      <div className="flex justify-center gap-3">
        {hasPrevious && (
          <button
            onClick={() => fetchPrevious()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            {isFetching && <Loader2 className="h-4 w-4 animate-spin" />}
            Previous
          </button>
        )}
        {hasNext ? (
          <button
            onClick={() => fetchNext()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            {isFetching && <Loader2 className="h-4 w-4 animate-spin" />}
            Next page
          </button>
        ) : (
          <p className="text-xs text-slate-400 dark:text-slate-500 self-center">
            All pages loaded
          </p>
        )}
      </div>
    </section>
  );
}

// function QueryCard({
//   label,
//   result,
// }: {
//   label: string;
//   result: {
//     data: unknown;
//     isFetching: boolean;
//     isError: boolean;
//     isFetched: boolean;
//   };
// }) {
//   return (
//     <div className="bg-white dark:bg-slate-900/40 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-2">
//       <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
//         {label}
//       </p>
//       {result.isFetching && !result.data ? (
//         <div className="flex items-center gap-2 text-sm text-slate-400">
//           <Loader2 className="h-4 w-4 animate-spin" /> Loading…
//         </div>
//       ) : result.isError ? (
//         <p className="text-sm text-red-500">Error</p>
//       ) : result.data !== undefined ? (
//         <p className="text-sm text-slate-800 dark:text-slate-200">
//           {Array.isArray(result.data)
//             ? `${result.data.length} items`
//             : JSON.stringify(result.data).slice(0, 60)}
//         </p>
//       ) : null}
//       <div className="flex gap-2 text-xs text-slate-400">
//         <span
//           className={
//             result.isFetching
//               ? "text-amber-500 font-semibold"
//               : "text-emerald-500"
//           }
//         >
//           {result.isFetching ? "fetching…" : "idle"}
//         </span>
//         <span>·</span>
//         <span>fetched: {String(result.isFetched)}</span>
//       </div>
//     </div>
//   );
// }

// function QueriesSection() {
//   const [d1, d2] = useQueries(
//     {
//       proc: getTodos,
//       queryKey: ["todos"],
//       refetchOnWindowFocus: true,
//     },
//     {
//       proc: () => getPosts({ limit: 3 }),
//       queryKey: ["posts-for-queries"],
//     },
//   );
//   d1.data;
//   return (
//     <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30 p-6 space-y-4">
//       <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
//         <Layers size={20} className="text-purple-600 dark:text-purple-400" />
//         useQueries (parallel)
//       </h2>
//       <p className="text-xs text-slate-500 dark:text-slate-400">
//         Fetches both{" "}
//         <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs font-mono">
//           getTodos
//         </code>{" "}
//         and{" "}
//         <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs font-mono">
//           getPosts
//         </code>{" "}
//         in parallel. Todos has{" "}
//         <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs font-mono">
//           refetchOnWindowFocus
//         </code>{" "}
//         enabled.
//       </p>
//       <div className="grid grid-cols-2 gap-4">
//         <QueryCard label="getTodos" result={d1} />
//         <QueryCard label="getPosts" result={d2} />
//       </div>
//     </section>
//   );
// }

function QueryClientSection() {
  const queryClient = useQueryClient();
  const [log, setLog] = useState<string[]>([]);
  const addLog = (msg: string) =>
    setLog((l) =>
      [`[${new Date().toLocaleTimeString()}] ${msg}`, ...l].slice(0, 8),
    );

  function handlePrepend() {
    queryClient.prepend(INF_KEY, {
      id: `qc-${Date.now()}`,
      title: "QueryClient.prepend()",
      excerpt: "",
      _tag: "qc-prepend",
    });
    addLog("queryClient.prepend(INF_KEY)");
  }
  function handleAppend() {
    queryClient.append(PAG_KEY, {
      id: `qc-${Date.now()}`,
      title: "QueryClient.append()",
      excerpt: "",
      _tag: "qc-append",
    });
    addLog("queryClient.append(PAG_KEY)");
  }
  function handleRemove() {
    queryClient.remove(INF_KEY, (item: any) => !!item._tag?.startsWith("qc-"));
    queryClient.remove(PAG_KEY, (item: any) => !!item._tag?.startsWith("qc-"));
    addLog("queryClient.remove() — removed qc-tagged items from both keys");
  }
  function handleSnapshot() {
    const restoreInf = queryClient.snapshot(INF_KEY);
    const restorePag = queryClient.snapshot(PAG_KEY);
    addLog("queryClient.snapshot() — both keys captured. Restoring in 3s…");
    setTimeout(() => {
      queryClient.prepend(INF_KEY, {
        id: `qc-snap-${Date.now()}`,
        title: "pre-restore",
        excerpt: "",
        _tag: "snap",
      });
      queryClient.prepend(PAG_KEY, {
        id: `qc-snap-${Date.now()}`,
        title: "pre-restore",
        excerpt: "",
        _tag: "snap",
      });
    }, 1000);
    setTimeout(() => {
      restoreInf();
      restorePag();
      addLog("queryClient.snapshot restore() — both keys rolled back");
    }, 3000);
  }
  function handleInvalidate() {
    queryClient.invalidate(INF_KEY);
    addLog("queryClient.invalidate(INF_KEY) — refetch triggered");
  }

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30 p-6 space-y-4">
      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-200">
        useQueryClient() direct helpers
      </h2>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        These operate directly on the cache — mutations are reflected in the
        sections above.
      </p>
      <div className="flex flex-wrap gap-2">
        {[
          {
            label: "prepend to INF",
            fn: handlePrepend,
            color: "bg-blue-600 hover:bg-blue-700",
          },
          {
            label: "append to PAG",
            fn: handleAppend,
            color: "bg-indigo-600 hover:bg-indigo-700",
          },
          {
            label: "remove qc-tagged",
            fn: handleRemove,
            color: "bg-rose-600 hover:bg-rose-700",
          },
          {
            label: "snapshot both",
            fn: handleSnapshot,
            color: "bg-teal-600 hover:bg-teal-700",
          },
          {
            label: "invalidate INF",
            fn: handleInvalidate,
            color: "bg-orange-600 hover:bg-orange-700",
          },
        ].map(({ label, fn, color }) => (
          <button
            key={label}
            onClick={fn}
            className={`px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition-colors ${color}`}
          >
            {label}
          </button>
        ))}
      </div>
      {log.length > 0 && (
        <div className="bg-slate-900 dark:bg-slate-950 text-emerald-400 rounded-lg p-3 text-xs font-mono space-y-1 max-h-36 overflow-auto border border-slate-800">
          {log.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function HelpersDemo() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Wrench size={24} className="text-rose-600 dark:text-rose-400" />
          Cache Helper Methods
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          Live test of{" "}
          <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs font-mono text-rose-600 dark:text-rose-400">
            prepend
          </code>
          ,{" "}
          <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs font-mono text-rose-600 dark:text-rose-400">
            append
          </code>
          ,{" "}
          <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs font-mono text-rose-600 dark:text-rose-400">
            insert
          </code>
          ,{" "}
          <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs font-mono text-rose-600 dark:text-rose-400">
            remove
          </code>
          ,{" "}
          <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs font-mono text-rose-600 dark:text-rose-400">
            update
          </code>
          ,{" "}
          <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs font-mono text-rose-600 dark:text-rose-400">
            snapshot
          </code>{" "}
          and{" "}
          <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs font-mono text-rose-600 dark:text-rose-400">
            reset
          </code>{" "}
          from hooks and{" "}
          <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs font-mono text-rose-600 dark:text-rose-400">
            useQueryClient
          </code>
          .
        </p>
      </div>

      {/* <QueriesSection /> */}
      <InfiniteSection />
      <PaginatedSection />
      <QueryClientSection />
    </div>
  );
}
