import React from "react";
import type { QueryCacheEntry } from "../../types/query-client.js";
import type { QueryClient } from "../../lib/query-client.js";
import type { QueryFilter } from "../types.js";
import {
  FilterBadge,
  StatusPill,
  ActionButton,
  JsonTree,
  formatTimeAgo,
} from "./ui.js";

export type QueryTabProps = {
  queries: QueryCacheEntry[];
  filteredQueries: QueryCacheEntry[];
  activeQuery: QueryCacheEntry | undefined;
  selectedKey: string | null;
  setSelectedKey: (key: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  queryFilter: QueryFilter;
  setQueryFilter: (filter: QueryFilter) => void;
  isFetchingCount: number;
  queryClient: QueryClient;
  copiedKey: string | null;
  copyToClipboard: (text: string, id: string) => void;
};

/**
 * Parses queryKey into structured path segments and optional serialized arguments.
 * E.g. "media|files|list|{"page":1}" -> { path: ["media", "files", "list"], argsObj: { page: 1 }, argsString: '{"page":1}' }
 */
function parseQueryKey(rawKey: string): {
  path: string[];
  argsString?: string;
  argsObj?: any;
} {
  const parts = rawKey.split("|");
  if (parts.length === 1) {
    return { path: parts };
  }
  const lastPart = parts[parts.length - 1];
  if (lastPart && (lastPart.startsWith("{") || lastPart.startsWith("["))) {
    try {
      const argsObj = JSON.parse(lastPart);
      return {
        path: parts.slice(0, -1),
        argsString: lastPart,
        argsObj,
      };
    } catch {
      // Not valid json, treat as regular path part
    }
  }
  return { path: parts };
}

export const QueryTab: React.FC<QueryTabProps> = ({
  queries,
  filteredQueries,
  activeQuery,
  setSelectedKey,
  searchQuery,
  setSearchQuery,
  queryFilter,
  setQueryFilter,
  isFetchingCount,
  queryClient,
  copiedKey,
  copyToClipboard,
}) => {
  const parsedActive = activeQuery ? parseQueryKey(activeQuery.queryKey) : null;

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      {/* Left Column: Query List */}
      <div
        style={{
          width: "350px",
          borderRight: "1px solid rgba(255, 255, 255, 0.08)",
          display: "flex",
          flexDirection: "column",
          background: "rgba(15, 23, 42, 0.3)",
        }}
      >
        {/* Search & Filters */}
        <div
          style={{
            padding: "10px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <input
            type="text"
            placeholder="Search queries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: "rgba(30, 41, 59, 0.8)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "6px",
              padding: "6px 10px",
              color: "#f8fafc",
              fontSize: "12px",
              outline: "none",
            }}
          />
          <div style={{ display: "flex", gap: "4px" }}>
            <FilterBadge
              active={queryFilter === "all"}
              onClick={() => setQueryFilter("all")}
              label={`All (${queries.length})`}
            />
            <FilterBadge
              active={queryFilter === "fresh"}
              onClick={() => setQueryFilter("fresh")}
              label={`Fresh (${queries.filter((q) => !q.isStale && q.state.isSuccess).length})`}
              color="#10b981"
            />
            <FilterBadge
              active={queryFilter === "stale"}
              onClick={() => setQueryFilter("stale")}
              label={`Stale (${queries.filter((q) => q.isStale && !q.state.isFetching).length})`}
              color="#f59e0b"
            />
            <FilterBadge
              active={queryFilter === "fetching"}
              onClick={() => setQueryFilter("fetching")}
              label={`Fetching (${isFetchingCount})`}
              color="#38bdf8"
            />
          </div>
        </div>

        {/* List Items */}
        <div style={{ flex: 1, overflowY: "auto", padding: "6px" }}>
          {filteredQueries.length === 0 ? (
            <div
              style={{
                padding: "24px",
                textAlign: "center",
                color: "#64748b",
                fontSize: "12px",
              }}
            >
              No matching queries found in cache
            </div>
          ) : (
            filteredQueries.map((q) => {
              const isSelected = activeQuery?.queryKey === q.queryKey;
              const parsed = parseQueryKey(q.queryKey);

              return (
                <div
                  key={q.queryKey}
                  onClick={() => setSelectedKey(q.queryKey)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: "8px",
                    background: isSelected
                      ? "rgba(56, 189, 248, 0.12)"
                      : "transparent",
                    border: isSelected
                      ? "1px solid rgba(56, 189, 248, 0.3)"
                      : "1px solid transparent",
                    cursor: "pointer",
                    marginBottom: "4px",
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "8px",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background =
                        "rgba(255, 255, 255, 0.04)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  <div
                    title={q.queryKey}
                    style={{
                      overflow: "hidden",
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {/* Procedure Path */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        fontWeight: isSelected ? 600 : 500,
                        color: isSelected ? "#38bdf8" : "#f1f5f9",
                        fontSize: "12.5px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {parsed.path.map((seg, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && (
                            <span
                              style={{ color: "#64748b", fontSize: "10px" }}
                            >
                              /
                            </span>
                          )}
                          <span
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {seg}
                          </span>
                        </React.Fragment>
                      ))}
                    </div>

                    {/* Serialized Args Preview */}
                    {parsed.argsString && (
                      <div
                        style={{
                          fontSize: "10.5px",
                          fontFamily:
                            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                          color: isSelected ? "#7dd3fc" : "#94a3b8",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          marginTop: "2px",
                          opacity: 0.85,
                        }}
                      >
                        {parsed.argsString}
                      </div>
                    )}

                    <div
                      style={{
                        fontSize: "10.5px",
                        color: "#64748b",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginTop: "3px",
                      }}
                    >
                      <span>{formatTimeAgo(q.state.updatedAt)}</span>
                      <span>•</span>
                      <span>{q.listenersCount} obs</span>
                    </div>
                  </div>

                  <div style={{ marginTop: "2px", flexShrink: 0 }}>
                    <StatusPill state={q.state} isStale={q.isStale} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Query Details */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "rgba(15, 23, 42, 0.6)",
        }}
      >
        {activeQuery ? (
          <>
            {/* Query Detail Header */}
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                background: "rgba(30, 41, 59, 0.4)",
              }}
            >
              {/* Key Title & Path Badges (Full Width) */}
              <div style={{ width: "100%", minWidth: 0 }}>
                {/* Segment Badges */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "5px",
                    marginBottom: "6px",
                  }}
                >
                  {parsedActive?.path.map((seg, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && (
                        <span style={{ color: "#64748b", fontSize: "11px" }}>
                          /
                        </span>
                      )}
                      <span
                        style={{
                          background: "rgba(56, 189, 248, 0.12)",
                          border: "1px solid rgba(56, 189, 248, 0.25)",
                          color: "#38bdf8",
                          fontSize: "12px",
                          fontWeight: 600,
                          padding: "1px 6px",
                          borderRadius: "5px",
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {seg}
                      </span>
                    </React.Fragment>
                  ))}
                </div>

                {/* Full Wrapped Query Key */}
                <div
                  title={activeQuery.queryKey}
                  style={{
                    fontSize: "11px",
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    color: "#94a3b8",
                    wordBreak: "break-all",
                    overflowWrap: "anywhere",
                    lineHeight: 1.45,
                    maxHeight: "56px",
                    overflowY: "auto",
                    padding: "2px 0",
                  }}
                >
                  {activeQuery.queryKey}
                </div>
              </div>

              {/* Action Toolbar on New Line: Updated timestamp on left, Buttons right-aligned */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "8px",
                  paddingTop: "8px",
                  borderTop: "1px solid rgba(255, 255, 255, 0.05)",
                }}
              >
                <div
                  style={{
                    fontSize: "10.5px",
                    color: "#64748b",
                  }}
                >
                  Updated:{" "}
                  {activeQuery.state.updatedAt
                    ? new Date(activeQuery.state.updatedAt).toLocaleTimeString()
                    : "Never"}
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    flexWrap: "wrap",
                    marginLeft: "auto",
                  }}
                >
                  <ActionButton
                    onClick={() => queryClient.invalidate(activeQuery.queryKey)}
                    title="Refetch and mark stale"
                  >
                    Invalidate
                  </ActionButton>
                  <ActionButton
                    onClick={() => queryClient.resetQuery(activeQuery.queryKey)}
                    title="Reset query state to initial undefined"
                  >
                    Reset
                  </ActionButton>
                  <ActionButton
                    onClick={() =>
                      copyToClipboard(
                        activeQuery.queryKey,
                        activeQuery.queryKey + "_key",
                      )
                    }
                    title="Copy full query key string"
                  >
                    {copiedKey === activeQuery.queryKey + "_key"
                      ? "Copied Key!"
                      : "Copy Key"}
                  </ActionButton>
                  <ActionButton
                    onClick={() =>
                      copyToClipboard(
                        JSON.stringify(activeQuery.state.data, null, 2),
                        activeQuery.queryKey + "_data",
                      )
                    }
                    title="Copy query data JSON"
                  >
                    {copiedKey === activeQuery.queryKey + "_data"
                      ? "Copied Data!"
                      : "Copy Data"}
                  </ActionButton>
                </div>
              </div>
            </div>

            {/* Metadata Badges */}
            <div
              style={{
                padding: "8px 16px",
                background: "rgba(15, 23, 42, 0.4)",
                borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                display: "flex",
                gap: "12px",
                fontSize: "11.5px",
                color: "#94a3b8",
              }}
            >
              <span>
                Status:{" "}
                <strong
                  style={{
                    color: activeQuery.isStale ? "#f59e0b" : "#10b981",
                  }}
                >
                  {activeQuery.isStale ? "Stale" : "Fresh"}
                </strong>
              </span>
              <span>
                Fetching:{" "}
                <strong
                  style={{
                    color: activeQuery.state.isFetching ? "#38bdf8" : "#94a3b8",
                  }}
                >
                  {String(activeQuery.state.isFetching)}
                </strong>
              </span>
              <span>
                Subscribers: <strong>{activeQuery.listenersCount}</strong>
              </span>
            </div>

            {/* JSON Data Viewer */}
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
              {/* Arguments Tree if parsed */}
              {parsedActive?.argsObj && (
                <div style={{ marginBottom: "16px" }}>
                  <div
                    style={{
                      fontSize: "11.5px",
                      fontWeight: 600,
                      color: "#38bdf8",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: "6px",
                    }}
                  >
                    Query Input Arguments
                  </div>
                  <JsonTree data={parsedActive.argsObj} />
                </div>
              )}

              <div
                style={{
                  fontSize: "11.5px",
                  fontWeight: 600,
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "8px",
                }}
              >
                Cached Data Output
              </div>
              <JsonTree data={activeQuery.state.data} />

              {activeQuery.state.error && (
                <div style={{ marginTop: "16px" }}>
                  <div
                    style={{
                      fontSize: "11.5px",
                      fontWeight: 600,
                      color: "#ef4444",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: "8px",
                    }}
                  >
                    Query Error
                  </div>
                  <JsonTree data={activeQuery.state.error} />
                </div>
              )}
            </div>
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
            }}
          >
            Select a query from the left pane to view details
          </div>
        )}
      </div>
    </div>
  );
};
