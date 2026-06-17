"use client";

import React from "react";
import { Cable, Puzzle, Plug, ArrowDown } from "lucide-react";

const STEPS = [
  {
    icon: <Cable size={16} />,
    label: "Create Procedure",
    code: `const procedure = createProcedure({\n  createContext: () => ({\n    ok: true,\n    ctx: { userId: "user_1" },\n  }),\n  inputMode: "strict",\n});`,
    description: "Define a base procedure with shared context, error handling, and input mode.",
  },
  {
    icon: <Puzzle size={16} />,
    label: "Chain Builders",
    code: `const getUser = procedure\n  .input(zodResolver(z.object({ id: z.string() })))\n  .cache({ ttl: 60000 })\n  .query(async ({ input }) => {\n    return db.users.findById(input.id);\n  });`,
    description: "Compose input validation, middleware, caching, and execution policies in any order.",
  },
  {
    icon: <Plug size={16} />,
    label: "Call from Client",
    code: `const [user, error] = await getUser({ id: "123" });\n\n// Or in React:\nconst { data, isLoading } = useQuery(\n  () => getUser({ id: "123" }),\n);`,
    description: "Call as a plain function or use React hooks. Full type safety end-to-end.",
  },
];

export function HowItWorks() {
  return (
    <section className="py-16 px-4 max-w-6xl mx-auto space-y-12">
      <div className="text-center space-y-3">
        <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Define Once, Use Everywhere
        </h2>
        <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
          Create a procedure, chain your business logic, and call it from any
          client with full type inference.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {STEPS.map((step, index) => (
          <div key={index} className="relative flex flex-col">
            {index < STEPS.length - 1 && (
              <div className="hidden md:block absolute top-8 left-[calc(50%+1.5rem)] w-[calc(100%-3rem)] h-px bg-linear-to-r from-blue-300 to-cyan-300 dark:from-blue-700 dark:to-cyan-700" />
            )}

            <div className="relative z-10 flex flex-col items-center text-center gap-3">
              <div className="relative inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-linear-to-br from-blue-500 to-cyan-600 dark:from-blue-600 dark:to-cyan-700 shadow-lg shadow-blue-500/20">
                <span className="absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 text-[10px] font-bold flex items-center justify-center shadow-xs ring-2 ring-white dark:ring-slate-950">
                  {index + 1}
                </span>
                {step.icon}
              </div>

              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {step.label}
              </h3>

              <div className="w-full bg-slate-950 dark:bg-slate-900 border border-slate-800 rounded-xl p-3 text-left">
                <pre className="text-[11px] font-mono text-cyan-300 leading-relaxed whitespace-pre-wrap">
                  {step.code}
                </pre>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {step.description}
              </p>
            </div>

            {index < STEPS.length - 1 && (
              <div className="flex md:hidden justify-center py-2 text-slate-300 dark:text-slate-600">
                <ArrowDown size={20} />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
