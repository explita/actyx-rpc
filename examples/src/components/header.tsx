"use client";

import { useIsMutating } from "@/dist/react";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./logo";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/playground", label: "Playground" },
  { href: "/docs", label: "Docs" },
];

export function Header() {
  const isMutating = useIsMutating();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="text-lg font-bold bg-linear-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent hover:from-blue-500 hover:to-cyan-500 transition-all duration-200"
          >
            <div className="flex flex-row items-center gap-2">
              <Logo />
              Actyx RPC
            </div>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {isMutating && (
            <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-950/40 px-3 py-1.5 rounded-lg">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Syncing...</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
