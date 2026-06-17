"use client";

import { useQuery, useMutation } from "@/dist/react";
import {
  getUserProfile,
  updateUserProfile,
  getFlakyData,
} from "../../../../lib/rpc/caching";
import { Loader2, RefreshCw, Zap } from "lucide-react";
import { useState } from "react";

export default function CachingDemo() {
  const { data: profile, isFetching: isProfileFetching } = useQuery(
    getUserProfile,
    {
      queryKey: ["userProfile"],
    },
  );

  const {
    data: flakyData,
    isFetching: isFlakyFetching,
    error: flakyError,
    refetch: refetchFlaky,
  } = useQuery(getFlakyData, {
    queryKey: ["flakyData"],
    enabled: false,
  });

  const updateMutation = useMutation(updateUserProfile);

  const [name, setName] = useState("");
  const [role, setRole] = useState("");

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !role) return;

    await updateMutation.mutate({ name, role });
    setName("");
    setRole("");
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
      <div className="mb-10">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Zap size={24} className="text-amber-600 dark:text-amber-400" />
          Caching &amp; Resilience
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Demonstrating server-side caching, cache invalidation, and automatic
          retries.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-200">
              Profile Cache
            </h3>
            {isProfileFetching && (
              <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
            )}
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/80 rounded-xl p-4 mb-6 text-sm font-mono text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
            {profile ? (
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(profile, null, 2)}
              </pre>
            ) : (
              <span className="text-slate-400 dark:text-slate-500">
                Loading profile...
              </span>
            )}
          </div>

          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Role
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                placeholder="Engineer"
              />
            </div>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="w-full inline-flex justify-center items-center rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white disabled:text-slate-500 dark:disabled:text-slate-600 transition-all duration-200"
            >
              {updateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Update &amp; Invalidate Cache
            </button>
          </form>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 text-center">
            Updating the profile invalidates the server cache for future
            requests.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-200 mb-2">
            Automatic Retries
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
            This endpoint fails the first two times. The RPC framework
            automatically retries with exponential backoff until it succeeds.
          </p>

          <div className="bg-slate-50 dark:bg-slate-950/80 rounded-xl p-4 mb-6 min-h-[120px] flex flex-col justify-center border border-slate-200 dark:border-slate-800">
            {isFlakyFetching ? (
              <div className="flex flex-col items-center justify-center text-amber-600 dark:text-amber-400 gap-2">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-sm font-medium text-center">
                  Fetching... (check server terminal for failure logs)
                </span>
              </div>
            ) : flakyData ? (
              <div className="text-emerald-700 dark:text-emerald-400 text-sm font-medium text-center">
                {flakyData.data}
                <div className="text-xs text-emerald-600/70 dark:text-emerald-500/70 mt-1">
                  {flakyData.timestamp}
                </div>
              </div>
            ) : flakyError ? (
              <div className="text-rose-600 dark:text-rose-400 text-sm font-medium text-center">
                {flakyError.message}
              </div>
            ) : (
              <div className="text-slate-400 dark:text-slate-500 text-sm font-medium text-center">
                Not fetched yet
              </div>
            )}
          </div>

          <button
            onClick={() => refetchFlaky()}
            disabled={isFlakyFetching}
            className="w-full inline-flex justify-center items-center rounded-xl bg-white dark:bg-slate-900/40 px-4 py-2.5 text-sm font-semibold text-slate-900 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-all"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isFlakyFetching ? "animate-spin" : ""}`}
            />
            Trigger Flaky Request
          </button>
        </div>
      </div>
    </div>
  );
}
