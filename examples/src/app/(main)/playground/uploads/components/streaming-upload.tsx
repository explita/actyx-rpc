"use client";

import { useMutation } from "@/dist/react";
import { useState, useRef } from "react";
import {
  UploadCloud,
  File as FileIcon,
  X,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";

export function StreamingUpload() {
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    mutate,
    progress,
    status: mutationStatus,
    reset: resetMutation,
    data: result,
    error,
  } = useMutation<any, [File]>("/api/uploads/stream");

  const status = mutationStatus === "pending" ? "uploading" : mutationStatus;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      resetMutation();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      resetMutation();
    }
  };

  const removeFile = () => {
    setFile(null);
    resetMutation();
  };

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    mutate(file);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
          <UploadCloud size={18} className="text-emerald-600 dark:text-emerald-400" />
          Binary Stream Mode
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
          Streams raw file bytes directly to the server body as a binary payload. Extremely fast, lightweight, and bypasses multipart parsing.
        </p>

        <form onSubmit={handleUpload} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Select File
            </label>
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors flex flex-col items-center justify-center ${
                file
                  ? "border-emerald-500/50 bg-emerald-50/20 dark:bg-emerald-950/10"
                  : "border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600"
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
              />
              {file ? (
                <div className="space-y-3">
                  <FileIcon className="mx-auto h-12 w-12 text-emerald-500" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-[200px] mx-auto">
                      {file.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <UploadCloud className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-600" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Drag & drop file or click to browse
                  </p>
                  <p className="text-xs text-slate-500">
                    Any file size (highly efficient streaming)
                  </p>
                </div>
              )}
            </div>
          </div>

          {status === "uploading" && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-slate-500">
                <span>Streaming...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2">
                <div
                  className="bg-emerald-600 h-2 rounded-full transition-all duration-155"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!file || status === "uploading"}
              className="flex-1 justify-center rounded-xl bg-emerald-600 text-white py-2.5 px-4 text-sm font-semibold hover:bg-emerald-700 focus:outline-hidden disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center gap-2"
            >
              {status === "uploading" ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Streaming...
                </>
              ) : (
                "Stream Upload File"
              )}
            </button>
            {file && status !== "uploading" && (
              <button
                type="button"
                onClick={removeFile}
                className="rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={16} className="text-slate-500" />
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Result Display */}
      {status !== "idle" && (
        <div className="bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-200 mb-4">
            Upload Response (Stream)
          </h4>

          {status === "success" && result && (
            <div className="space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 p-4 rounded-xl flex items-center gap-3 text-sm">
                <CheckCircle size={20} className="shrink-0" />
                <div>
                  <span className="font-semibold">
                    File Streamed Successfully!
                  </span>
                </div>
              </div>
              <div className="rounded-xl bg-slate-950 p-4 font-mono text-xs text-slate-300 overflow-x-auto">
                <pre>{JSON.stringify(result, null, 2)}</pre>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4">
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 p-4 rounded-xl flex items-center gap-3 text-sm">
                <AlertTriangle size={20} className="shrink-0" />
                <div>
                  <span className="font-semibold">Stream Upload Failed</span>
                  <p className="text-xs mt-0.5">{error?.message}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
