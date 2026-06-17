import Link from "next/link";
import {
  ArrowRight,
  ListTodo,
  Layers,
  Zap,
  Activity,
  Wrench,
  Sparkles,
} from "lucide-react";

const demos = [
  {
    title: "Todo List",
    description: "Basic queries and mutations with optimistic updates",
    href: "/todos",
    icon: ListTodo,
    accent: "from-blue-500/10 to-cyan-500/10 dark:from-blue-500/5 dark:to-cyan-500/5 border-blue-100 dark:border-blue-500/10",
    iconBg: "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400",
    gradient: "from-blue-600 to-cyan-600",
  },
  {
    title: "Pagination",
    description: "Infinite scrolling with useInfiniteQuery",
    href: "/pagination",
    icon: Layers,
    accent: "from-purple-500/10 to-pink-500/10 dark:from-purple-500/5 dark:to-pink-500/5 border-purple-100 dark:border-purple-500/10",
    iconBg: "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400",
    gradient: "from-purple-600 to-pink-600",
  },
  {
    title: "Caching & Resilience",
    description: "Built-in cache, invalidation, and automatic retries",
    href: "/caching",
    icon: Zap,
    accent: "from-amber-500/10 to-orange-500/10 dark:from-amber-500/5 dark:to-orange-500/5 border-amber-100 dark:border-amber-500/10",
    iconBg: "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400",
    gradient: "from-amber-600 to-orange-600",
  },
  {
    title: "Server-Sent Events",
    description: "Real-time stock ticker stream from server to client",
    href: "/sse",
    icon: Activity,
    accent: "from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/5 dark:to-teal-500/5 border-emerald-100 dark:border-emerald-500/10",
    iconBg: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400",
    gradient: "from-emerald-600 to-teal-600",
  },
  {
    title: "Cache Helpers",
    description: "prepend, append, insert, remove, update, snapshot — live demo",
    href: "/helpers",
    icon: Wrench,
    accent: "from-rose-500/10 to-pink-500/10 dark:from-rose-500/5 dark:to-pink-500/5 border-rose-100 dark:border-rose-500/10",
    iconBg: "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400",
    gradient: "from-rose-600 to-pink-600",
  },
];

export default function Home() {
  return (
    <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-linear-to-b from-blue-500/5 via-cyan-500/5 to-transparent blur-3xl pointer-events-none" />

      <div className="relative z-10 text-center mb-16 space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-linear-to-r from-blue-500/10 to-cyan-500/10 dark:from-blue-500/20 dark:to-cyan-500/20 border border-blue-200/50 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs font-semibold select-none shadow-xs">
          <Sparkles size={12} className="text-blue-500 dark:text-blue-400" />
          <span>Interactive Examples</span>
        </div>

        <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight sm:text-5xl">
          Playground
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          Explore the features of Actyx RPC with these interactive examples.
        </p>
      </div>

      <div className="relative z-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2">
        {demos.map((demo) => {
          const Icon = demo.icon;
          return (
            <Link
              key={demo.href}
              href={`/playground${demo.href}`}
              className={`group relative overflow-hidden bg-white dark:bg-slate-900/40 border ${demo.accent} rounded-2xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col`}
            >
              {/* Gradient top accent bar */}
              <div className={`absolute top-0 left-0 right-0 h-[2px] bg-linear-to-r ${demo.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

              <div
                className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${demo.iconBg} border border-slate-100 dark:border-slate-800 group-hover:scale-110 transition-transform duration-300`}
              >
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-200 mb-2">
                {demo.title}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 flex-1 leading-relaxed">
                {demo.description}
              </p>
              <div className={`flex items-center text-sm font-medium bg-linear-to-r ${demo.gradient} bg-clip-text text-transparent`}>
                View demo
                <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
