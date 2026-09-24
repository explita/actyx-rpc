import { Activity, Server, RefreshCw } from "lucide-react";

interface HealthInspectorProps {
  health?: { status?: string; uptime?: number };
  lastCall: string;
  onRefetch: () => void;
  isRefetching: boolean;
}

export function HealthInspector({
  health,
  lastCall,
  onRefetch,
  isRefetching,
}: HealthInspectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
            <Activity size={18} />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Endpoint Health
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              {health?.status === "ok" ? "200 OK — Healthy" : "Checking..."}
            </div>
          </div>
        </div>
        {health?.uptime !== undefined && (
          <span className="text-xs font-mono text-slate-400">
            uptime: {health.uptime}s
          </span>
        )}
      </div>

      <div className="p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
            <Server size={18} />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Last Routed Call
            </div>
            <div className="text-sm font-mono font-medium text-slate-900 dark:text-white">
              {lastCall}
            </div>
          </div>
        </div>
        <button
          onClick={onRefetch}
          disabled={isRefetching}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Refetch todos"
        >
          <RefreshCw
            size={14}
            className={isRefetching ? "animate-spin text-blue-500" : ""}
          />
        </button>
      </div>
    </div>
  );
}
