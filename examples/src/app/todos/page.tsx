"use client";

import {
  useSuspenseQuery,
  useMutation,
  useQueryClient,
  useQuery,
} from "@/dist/react";
import { getTodos, addTodo, Todo } from "@/lib/rpc/actions";
import { Suspense, useState } from "react";
import { Loader2, Plus } from "lucide-react";

function TodoStats() {
  const { data: completedCount } = useQuery(() => getTodos(), {
    queryKey: ["todos"],
    select: (todos) => todos.filter((t) => t.completed).length,
  });

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
      <h3 className="text-sm font-medium text-gray-500">Completed Todos</h3>
      <p className="text-2xl font-bold text-gray-900">{completedCount ?? 0}</p>
    </div>
  );
}

import dynamic from "next/dynamic";
const TodoListDynamic = dynamic(() => Promise.resolve(TodoList), {
  ssr: false,
});

const TodoList = () => {
  const { data: todos } = useSuspenseQuery(() => getTodos(), {
    queryKey: ["todos"],
  });

  return (
    <div className="space-y-3">
      {todos.map((todo) => (
        <div
          key={todo.id}
          className="flex items-center gap-3 bg-white p-4 rounded-lg shadow-sm border"
        >
          <input
            type="checkbox"
            checked={todo.completed}
            readOnly
            className="h-5 w-5 rounded border-gray-300"
          />
          <span
            className={
              todo.completed ? "line-through text-gray-400" : "text-gray-900"
            }
          >
            {todo.text}
          </span>
        </div>
      ))}
      {todos.length === 0 && (
        <p className="text-gray-500 text-center py-4">No todos yet.</p>
      )}
    </div>
  );
};

export default function Page() {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [errorToast, setErrorToast] = useState("");

  const { mutate, isPending } = useMutation(() => addTodo({ text }), {
    mutationKey: ["addTodo"],
    onMutate: () => {
      // Optimistic update

      const [previousTodos] = queryClient.setQueryData<Todo[]>(
        ["todos"],
        (prevs) => {
          const optimisticTodo = {
            id: `optimistic-${Date.now()}`,
            text,
            completed: false,
          };
          return [...(prevs || []), optimisticTodo];
        },
      );

      setText("");
      setErrorToast("");
      return previousTodos || [];
    },
    onError: (err, context) => {
      // Rollback on failure!
      queryClient.setQueryData(["todos"], context);
      setErrorToast("Whoops! Simulated failure. Rolling back...");
    },
    onSettled: () => {
      queryClient.invalidateQueries(["todos"]);
    },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Actyx RPC Demo</h2>
          <p className="text-gray-500 mt-1">Testing Next.js Server Actions</p>
        </div>
        <button
          onMouseEnter={() => {
            // Prefetch hidden data!
            queryClient.prefetchQuery(["todos"], () => getTodos());
          }}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          Hover to Prefetch
        </button>
      </div>

      <TodoStats />

      {errorToast && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-md border border-red-200">
          {errorToast}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text) mutate();
        }}
        className="flex gap-3 mb-8"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What needs to be done?"
          className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-3"
          disabled={isPending}
        />
        <button
          type="submit"
          disabled={isPending || !text}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50"
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
                className="h-[58px] bg-gray-100 rounded-lg animate-pulse"
              />
            ))}
          </div>
        }
      >
        <TodoListDynamic />
      </Suspense>
    </div>
  );
}
