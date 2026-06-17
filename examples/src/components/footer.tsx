import { Package } from "lucide-react";

export function Footer() {
  return (
    <footer className="w-full py-10 px-4 mt-auto border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
        <div>
          <span>
            © {new Date().getFullYear()}{" "}
            <a
              href="https://explita.ng"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-600"
            >
              Explita
            </a>
          </span>
        </div>

        <div className="flex items-center gap-6">
          <a
            href="https://github.com/explita/actyx-rpc"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
              <path d="M9 18c-4.51 2-5-2-7-2" />
            </svg>
            GitHub Repository
          </a>
          <a
            href="https://www.npmjs.com/package/@explita/actyx-rpc"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <Package size={14} />
            npm Registry
          </a>
        </div>
      </div>
    </footer>
  );
}
