"use client";

import { useState } from "react";
import { Upload, UploadCloud, Info } from "lucide-react";
import { MultipartUpload } from "./components/multipart-upload";
import { StreamingUpload } from "./components/streaming-upload";

export default function UploadsDemo() {
  const [activeTab, setActiveTab] = useState<"multipart" | "streaming">("multipart");

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
      <div className="mb-10">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Upload size={24} className="text-blue-600 dark:text-blue-400" />
          File Upload Strategies
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Compare the two upload mechanisms supported by Actyx RPC: standard Multipart/Form-Data and memory-efficient Binary Streaming.
        </p>
      </div>

      {/* Tabs selector */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 mb-8">
        <button
          onClick={() => setActiveTab("multipart")}
          className={`flex items-center gap-2 py-3 px-6 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "multipart"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
          }`}
        >
          <Upload size={16} />
          Multipart Form-Data
        </button>
        <button
          onClick={() => setActiveTab("streaming")}
          className={`flex items-center gap-2 py-3 px-6 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "streaming"
              ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
          }`}
        >
          <UploadCloud size={16} />
          Binary Streaming
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Tab Component */}
        <div className="lg:col-span-2">
          {activeTab === "multipart" ? <MultipartUpload /> : <StreamingUpload />}
        </div>

        {/* Informational Sidebar */}
        <div className="space-y-6">
          <div className="bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
              <Info size={16} className="text-blue-600 dark:text-blue-400" />
              Which should you choose?
            </h3>
            
            <div className="space-y-4 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-slate-200 mb-1">Multipart Mode</h4>
                <p>
                  Ideal when submitting small to medium files accompanied by structured form fields (e.g. description, category, tags).
                </p>
                <code className="block mt-1.5 p-1.5 bg-slate-100 dark:bg-slate-950 rounded text-slate-800 dark:text-slate-300 font-mono text-[10px]">
                  mutate({"{"} file, desc {"}"})
                </code>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 dark:text-slate-200 mb-1">Binary Streaming</h4>
                <p>
                  Best for uploading large files (50MB+). Streams the file raw in the request body, bypassing parsing boundaries entirely to save server CPU/RAM.
                </p>
                <code className="block mt-1.5 p-1.5 bg-slate-100 dark:bg-slate-950 rounded text-slate-800 dark:text-slate-300 font-mono text-[10px]">
                  mutate(file)
                </code>
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
            Real-time progress reporting works natively in both modes using progress XHR listeners. Under the hood, Actyx RPC manages browser transport and formats content headers automatically.
          </div>
        </div>
      </div>
    </div>
  );
}
