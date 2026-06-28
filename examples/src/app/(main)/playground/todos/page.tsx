"use client";

import {
  useSuspenseQuery,
  useMutation,
  useQueryClient,
  useQuery,
} from "@/dist/react";
import { getTodos, addTodo, Todo } from "@/lib/rpc/actions";
import { Suspense, useState } from "react";
import { Loader2, Plus, ListTodo, CheckCircle2 } from "lucide-react";
import dynamic from "next/dynamic";

const DynamicTodoList = dynamic(() => Promise.resolve(TodoList), {
  ssr: false,
});

function TodoStats() {
  const { data: completedCount } = useQuery(getTodos, {
    queryKey: ["todos"],
    select: (todos) => todos.filter((t) => t.completed).length,
  });

  return (
    <div className="bg-white dark:bg-slate-900/40 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 mb-6">
      <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">
        Completed Todos
      </h3>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">
        {completedCount ?? 0}
      </p>
    </div>
  );
}

const TodoList = () => {
  const { data: todos } = useSuspenseQuery(getTodos, {
    queryKey: ["todos"],
  });
  const qc = useQueryClient();
  // const { data: todos } = client.todo.get.useSuspenseQuery({
  //   queryKey: ["todos"],
  // });

  function updateItem(id: string) {
    //optimistic ui update
    const rollback = qc.update<Todo>(
      "todos",
      (todo) => todo.id === id,
      (todo) => ({
        ...todo,
        completed: !todo.completed,
      }),
    );

    //call server actions or api service, on failure rollback
    //just call rollback()

    //simulate network delay
    setTimeout(rollback, 2000);
  }

  return (
    <div className="space-y-3">
      {todos.map((todo) => (
        <div
          key={todo.id}
          className="flex items-center gap-3 bg-white dark:bg-slate-900/40 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-all hover:shadow-md hover:-translate-y-0.5 duration-200"
        >
          <span onClick={() => updateItem(todo.id)}>
            <CheckCircle2
              size={20}
              className={`cursor-pointer ${
                todo.completed
                  ? "text-emerald-500"
                  : "text-slate-300 dark:text-slate-600"
              }`}
            />
          </span>
          <span
            className={
              todo.completed
                ? "line-through text-slate-400 dark:text-slate-500"
                : "text-slate-900 dark:text-slate-200"
            }
          >
            {todo.text}
          </span>
        </div>
      ))}
      {todos.length === 0 && (
        <p className="text-slate-500 dark:text-slate-400 text-center py-8">
          No todos yet.
        </p>
      )}
    </div>
  );
};

export default function Page() {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [errorToast, setErrorToast] = useState("");

  const { mutate, isPending } = useMutation(addTodo, {
    mutationKey: ["addTodo"],
    onMutate: () => {
      const rollback = qc.snapshot("todos");

      qc.append<Todo>(["todos"], {
        id: `optimistic-${Date.now()}`,
        text,
        completed: false,
      });

      setText("");
      setErrorToast("");

      return rollback;
    },
    onError: (err, rollback) => {
      if (rollback && typeof rollback === "function") {
        rollback();
      }
      setErrorToast("Whoops! Simulated failure. Rolling back...");
    },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ListTodo size={24} className="text-blue-600 dark:text-blue-400" />
            Todo List
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Testing Next.js Server Actions with optimistic updates
          </p>
        </div>
        <button
          onMouseEnter={() => {
            qc.prefetchQuery(["todos"], () => getTodos());
          }}
          className="px-4 py-2 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-950/60 transition-colors"
        >
          Hover to Prefetch
        </button>
      </div>

      <TodoStats />

      {errorToast && (
        <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-900/50 text-sm">
          {errorToast}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text) mutate({ text });
        }}
        className="flex gap-3 mb-8"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What needs to be done?"
          className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
          disabled={isPending}
        />
        <button
          type="submit"
          disabled={isPending || !text}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white disabled:text-slate-500 dark:disabled:text-slate-600 font-medium rounded-xl px-6 py-3 transition-all duration-200"
        >
          {isPending ? (
            <Loader2 className="animate-spin h-5 w-5" />
          ) : (
            <Plus className="h-5 w-5" />
          )}
          Add
        </button>
      </form>

      <Suspense
        fallback={
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[60px] bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse"
              />
            ))}
          </div>
        }
      >
        <DynamicTodoList />
      </Suspense>
    </div>
  );
}
