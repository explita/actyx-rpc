"use client";

import { useState } from "react";
import { rpc } from "@/lib/rpc/client";
import {
  Loader2,
  Plus,
  CheckCircle2,
  Circle,
  AlertCircle,
} from "lucide-react";

interface TodosDemoProps {
  todos: any;
  onLogCall?: (call: string) => void;
}

export function TodosDemo({ todos, onLogCall }: TodosDemoProps) {
  const [inputText, setInputText] = useState("");

  const {
    mutate: addTodo,
    isPending: isAdding,
    error,
  } = rpc.todos.add.useMutation({
    onSuccess: () => {
      setInputText("");
      onLogCall?.("POST /api/rpc/todos.add");
      rpc.todos.list.invalidate();
    },
  });

  const { mutate: toggleTodo } = rpc.todos.toggle.useMutation({
    onSuccess: () => {
      onLogCall?.("POST /api/rpc/todos.toggle");
      rpc.todos.list.invalidate();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAdding) return;
    addTodo({ text: inputText.trim() });
  };

  const todoItems = todos.data ?? [];

  return (
    <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden mb-8">
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Router Todos Demo
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Fetched via{" "}
            <code className="font-mono text-blue-600 dark:text-blue-400">
              rpc.todos.list.useQuery()
            </code>{" "}
            (hydrated from Server Component)
          </p>
        </div>
        <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          {todoItems.length} items
        </span>
      </div>

      {/* Add Todo Input */}
      <div className="border-b border-slate-100 dark:border-slate-800">
        <form onSubmit={handleSubmit} className="p-4 flex gap-2">
          <input
            type="text"
            placeholder="Add new task via rpc.todos.add.useMutation()..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isAdding}
            className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
          <button
            type="submit"
            disabled={isAdding || !inputText.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-xs transition-colors cursor-pointer"
          >
            {isAdding ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Plus size={16} />
            )}
            <span>Add</span>
          </button>
          <button
            type="button"
            disabled={isAdding}
            onClick={async () => {
              const [res, err] = await rpc.todos.add({
                text: "new item",
              });
              if (res) todos.append(res);
              else console.log({ res, err });
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-xs transition-colors cursor-pointer"
          >
            Push
          </button>
        </form>
        {error && (
          <div className="p-4 pt-0 flex items-center gap-2">
            <AlertCircle
              size={18}
              className="text-red-600 dark:text-red-400"
            />
            <span className="text-sm text-red-600 dark:text-red-400">
              {error.errors?.text ?? error.message}
            </span>
          </div>
        )}
      </div>

      {/* Todos List */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {todos.isLoading ? (
          <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
            <Loader2 size={18} className="animate-spin text-blue-500" />
            <span className="text-sm">Loading todos from router...</span>
          </div>
        ) : todoItems.length > 0 ? (
          todoItems.map((todo: any) => (
            <div
              key={todo.id}
              onClick={() => toggleTodo({ id: todo.id })}
              className="group p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                {todo.completed ? (
                  <CheckCircle2 size={18} className="text-emerald-500" />
                ) : (
                  <Circle
                    size={18}
                    className="text-slate-400 group-hover:text-blue-500 transition-colors"
                  />
                )}
                <span
                  className={`text-sm ${
                    todo.completed
                      ? "line-through text-slate-400 dark:text-slate-500"
                      : "text-slate-800 dark:text-slate-200"
                  }`}
                >
                  {todo.text}
                </span>
              </div>
              <span className="text-xs text-slate-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                toggle
              </span>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-sm text-slate-500">
            No todos yet. Add one above!
          </div>
        )}
      </div>
    </div>
  );
}
