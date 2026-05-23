"use client";

import { useQuery, useMutation } from "@/dist/react";
import {
  getUserProfile,
  updateUserProfile,
  getFlakyData,
} from "../../lib/rpc/caching";
import { Loader2, RefreshCw } from "lucide-react";
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
    enabled: false, // Don't fetch on mount
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
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-12">
        <h2 className="text-3xl font-bold text-gray-900">
          Caching & Resilience
        </h2>
        <p className="mt-2 text-gray-600">
          Demonstrating server-side caching, cache invalidation, and automatic
          retries.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Caching Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Profile Cache</h3>
            {isProfileFetching && (
              <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
            )}
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm font-mono text-gray-700">
            {profile ? (
              <pre>{JSON.stringify(profile, null, 2)}</pre>
            ) : (
              "Loading profile..."
            )}
          </div>

          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Engineer"
              />
            </div>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="w-full inline-flex justify-center items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
            >
              {updateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Update & Invalidate Cache
            </button>
          </form>
          <p className="text-xs text-gray-500 mt-4 text-center">
            Notice how updating the profile feels instant on the client, but it
            also invalidates the server cache for future requests.
          </p>
        </div>

        {/* Resilience Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Automatic Retries
          </h3>
          <p className="text-sm text-gray-600 mb-6">
            This endpoint is programmed to fail the first two times you call it.
            The RPC framework will automatically catch the errors and retry with
            exponential backoff until it succeeds.
          </p>

          <div className="bg-gray-50 rounded-lg p-4 mb-6 min-h-[120px] flex flex-col justify-center">
            {isFlakyFetching ? (
              <div className="flex flex-col items-center justify-center text-amber-600 gap-2">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-sm font-medium text-center">
                  Fetching... (check terminal for failure logs)
                </span>
              </div>
            ) : flakyData ? (
              <div className="text-emerald-700 text-sm font-medium text-center">
                {flakyData.data}
                <div className="text-xs text-emerald-600/70 mt-1">
                  {flakyData.timestamp}
                </div>
              </div>
            ) : flakyError ? (
              <div className="text-red-600 text-sm font-medium text-center">
                {flakyError.message}
              </div>
            ) : (
              <div className="text-gray-400 text-sm font-medium text-center">
                Not fetched yet
              </div>
            )}
          </div>

          <button
            onClick={() => refetchFlaky()}
            disabled={isFlakyFetching}
            className="w-full inline-flex justify-center items-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
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
