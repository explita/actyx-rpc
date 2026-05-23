"use client";

import { useIsMutating } from "@/dist/react";
import { Loader2 } from "lucide-react";
import Link from "next/link";

export function Header() {
  const isMutating = useIsMutating();

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors"
        >
          Actyx RPC Demo
        </Link>

        <div className="flex items-center gap-3">
          {isMutating && (
            <div className="flex items-center gap-2 text-sm text-blue-600 font-medium">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Syncing...</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
