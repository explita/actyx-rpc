import React from "react";
import { ActyxIcon } from "./ui.js";

export type FloatingToggleProps = {
  onClick: () => void;
  queryCount: number;
  isFetchingCount: number;
  isMutatingCount: number;
};

export const FloatingToggle: React.FC<FloatingToggleProps> = ({
  onClick,
  queryCount,
  isFetchingCount,
  isMutatingCount,
}) => {
  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const shortcutTooltip = isMac ? "⌥A or ⌘⇧A" : "Alt+A or Ctrl+Shift+A";

  return (
    <button
      onClick={onClick}
      title={`Open Actyx DevTools (${shortcutTooltip})`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        background: "rgba(15, 23, 42, 0.88)",
        color: "#f8fafc",
        border: "1px solid rgba(255, 255, 255, 0.16)",
        backdropFilter: "blur(12px)",
        padding: "8px 14px",
        borderRadius: "9999px",
        cursor: "pointer",
        boxShadow:
          "0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4)",
        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        userSelect: "none",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px) scale(1.03)";
        e.currentTarget.style.borderColor = "#38bdf8";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.16)";
      }}
    >
      <ActyxIcon size={18} color="#38bdf8" />
      <span style={{ fontWeight: 600, letterSpacing: "-0.01em" }}>Actyx</span>
      <span
        style={{
          background: "#1e293b",
          color: "#94a3b8",
          fontSize: "11px",
          padding: "1px 6px",
          borderRadius: "10px",
          fontWeight: 500,
        }}
      >
        {queryCount}
      </span>
      {isFetchingCount > 0 && (
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: "#38bdf8",
            animation: "actyx-pulse 1.5s infinite",
          }}
          title={`${isFetchingCount} fetching`}
        />
      )}
      {isMutatingCount > 0 && (
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: "#a855f7",
            animation: "actyx-pulse 1.5s infinite",
          }}
          title={`${isMutatingCount} mutating`}
        />
      )}
    </button>
  );
};
