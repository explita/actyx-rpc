import Link from "next/link";
import { ArrowRight, ListTodo, Layers, Zap, Activity } from "lucide-react";

const demos = [
  {
    title: "Todo List",
    description: "Basic queries and mutations with optimistic updates",
    href: "/todos",
    icon: ListTodo,
    color: "bg-blue-50 text-blue-700",
  },
  {
    title: "Pagination",
    description: "Infinite scrolling with useInfiniteQuery",
    href: "/pagination",
    icon: Layers,
    color: "bg-purple-50 text-purple-700",
  },
  {
    title: "Caching & Resilience",
    description: "Built-in cache, invalidation, and automatic retries",
    href: "/caching",
    icon: Zap,
    color: "bg-amber-50 text-amber-700",
  },
  {
    title: "Server-Sent Events",
    description: "Real-time stock ticker stream from server to client",
    href: "/sse",
    icon: Activity,
    color: "bg-emerald-50 text-emerald-700",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl">
          Actyx RPC Demos
        </h1>
        <p className="mt-4 text-xl text-gray-500 max-w-2xl mx-auto">
          Explore the features of Actyx RPC with these interactive examples.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2">
        {demos.map((demo) => {
          const Icon = demo.icon;
          return (
            <Link
              key={demo.href}
              href={demo.href}
              className="group relative rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-gray-300 flex flex-col"
            >
              <div
                className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg ${demo.color}`}
              >
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {demo.title}
              </h3>
              <p className="text-gray-500 mb-6 flex-1">
                {demo.description}
              </p>
              <div className="flex items-center text-sm font-medium text-blue-600">
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
