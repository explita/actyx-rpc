import React from "react";
import type { StreamConnection } from "../stream-tracker.js";

export const ActyxIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 18,
  color = "#38bdf8",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ color }}
  >
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    <circle cx="12" cy="12" r="3" fill={color} />
  </svg>
);

export const CloseIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

export const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
  pulse?: boolean;
  pulseColor?: string;
}> = ({ active, onClick, label, pulse, pulseColor = "#38bdf8" }) => (
  <button
    onClick={onClick}
    style={{
      background: active ? "rgba(255, 255, 255, 0.12)" : "transparent",
      color: active ? "#f8fafc" : "#94a3b8",
      border: "none",
      borderRadius: "6px",
      padding: "5px 10px",
      fontSize: "12px",
      fontWeight: active ? 600 : 500,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: "6px",
      transition: "all 0.15s ease",
    }}
  >
    {label}
    {pulse && (
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: pulseColor,
          animation: "actyx-pulse 1.5s infinite",
        }}
      />
    )}
  </button>
);

export const ActionButton: React.FC<{
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}> = ({ onClick, children, title }) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      background: "rgba(255, 255, 255, 0.08)",
      border: "1px solid rgba(255, 255, 255, 0.1)",
      color: "#e2e8f0",
      borderRadius: "6px",
      padding: "4px 8px",
      fontSize: "11px",
      fontWeight: 500,
      cursor: "pointer",
      transition: "all 0.15s ease",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
      e.currentTarget.style.color = "#fff";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
      e.currentTarget.style.color = "#e2e8f0";
    }}
  >
    {children}
  </button>
);

export const FilterBadge: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
}> = ({ active, onClick, label, color }) => (
  <button
    onClick={onClick}
    style={{
      background: active
        ? "rgba(255, 255, 255, 0.12)"
        : "rgba(255, 255, 255, 0.04)",
      border: active
        ? "1px solid rgba(255, 255, 255, 0.2)"
        : "1px solid transparent",
      color: active ? "#f8fafc" : color || "#94a3b8",
      borderRadius: "6px",
      padding: "2px 8px",
      fontSize: "11px",
      cursor: "pointer",
    }}
  >
    {label}
  </button>
);

export const StatusPill: React.FC<{ state: any; isStale: boolean }> = ({
  state,
  isStale,
}) => {
  if (state.isFetching) {
    return (
      <span
        style={{
          background: "rgba(56, 189, 248, 0.2)",
          color: "#38bdf8",
          fontSize: "10px",
          fontWeight: 700,
          padding: "2px 6px",
          borderRadius: "10px",
        }}
      >
        FETCHING
      </span>
    );
  }
  if (state.isError) {
    return (
      <span
        style={{
          background: "rgba(239, 68, 68, 0.2)",
          color: "#ef4444",
          fontSize: "10px",
          fontWeight: 700,
          padding: "2px 6px",
          borderRadius: "10px",
        }}
      >
        ERROR
      </span>
    );
  }
  if (isStale) {
    return (
      <span
        style={{
          background: "rgba(245, 158, 11, 0.2)",
          color: "#f59e0b",
          fontSize: "10px",
          fontWeight: 700,
          padding: "2px 6px",
          borderRadius: "10px",
        }}
      >
        STALE
      </span>
    );
  }
  return (
    <span
      style={{
        background: "rgba(16, 185, 129, 0.2)",
        color: "#10b981",
        fontSize: "10px",
        fontWeight: 700,
        padding: "2px 6px",
        borderRadius: "10px",
      }}
    >
      FRESH
    </span>
  );
};

export const MutationStatusPill: React.FC<{
  status: "pending" | "success" | "error";
}> = ({ status }) => {
  const styles = {
    pending: {
      bg: "rgba(168, 85, 247, 0.2)",
      color: "#c084fc",
      text: "PENDING",
    },
    success: {
      bg: "rgba(16, 185, 129, 0.2)",
      color: "#10b981",
      text: "SUCCESS",
    },
    error: { bg: "rgba(239, 68, 68, 0.2)", color: "#ef4444", text: "ERROR" },
  }[status];

  return (
    <span
      style={{
        background: styles.bg,
        color: styles.color,
        fontSize: "10px",
        fontWeight: 700,
        padding: "2px 6px",
        borderRadius: "10px",
      }}
    >
      {styles.text}
    </span>
  );
};

export const LatencyPill: React.FC<{ durationMs: number }> = ({ durationMs }) => {
  const color =
    durationMs < 150 ? "#10b981" : durationMs < 500 ? "#f59e0b" : "#ef4444";
  return (
    <span
      style={{
        fontSize: "11px",
        color,
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {durationMs}ms
    </span>
  );
};

export const StreamStatusDot: React.FC<{
  status: StreamConnection["status"];
}> = ({ status }) => {
  const color =
    status === "connected"
      ? "#10b981"
      : status === "connecting"
        ? "#f59e0b"
        : status === "error"
          ? "#ef4444"
          : "#64748b";

  return (
    <span
      style={{
        width: "7px",
        height: "7px",
        borderRadius: "50%",
        background: color,
      }}
      title={`Stream: ${status}`}
    />
  );
};

export const JsonTree: React.FC<{ data: any }> = ({ data }) => {
  if (data === undefined) {
    return (
      <span style={{ color: "#64748b", fontStyle: "italic" }}>undefined</span>
    );
  }
  if (data === null) {
    return <span style={{ color: "#f43f5e" }}>null</span>;
  }
  return (
    <pre
      style={{
        margin: 0,
        padding: "10px 12px",
        background: "rgba(15, 23, 42, 0.8)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "8px",
        fontSize: "11.5px",
        color: "#cbd5e1",
        lineHeight: 1.5,
        overflowX: "auto",
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      }}
    >
      {JSON.stringify(data, null, 2)}
    </pre>
  );
};

export function formatTimeAgo(timestamp: number): string {
  if (!timestamp) return "never";
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 2) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

export const DevtoolsKeyframes: React.FC = () => (
  <style
    dangerouslySetInnerHTML={{
      __html: `
        @keyframes actyx-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
        @keyframes actyx-panel-in {
          from { opacity: 0; transform: scale(0.97) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `,
    }}
  />
);
