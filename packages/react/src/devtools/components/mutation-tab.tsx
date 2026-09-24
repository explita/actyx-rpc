import React from "react";
import type { MutationLogEntry } from "../../types/query-client.js";
import {
  MutationStatusPill,
  LatencyPill,
  JsonTree,
} from "./ui.js";

export type MutationTabProps = {
  mutations: MutationLogEntry[];
  selectedMutationId: string | null;
  setSelectedMutationId: (id: string) => void;
};

export const MutationTab: React.FC<MutationTabProps> = ({
  mutations,
  selectedMutationId,
  setSelectedMutationId,
}) => {
  const activeMutation =
    mutations.find((m) => m.id === selectedMutationId) || mutations[0];

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      {/* Left Column: Mutation Logs */}
      <div
        style={{
          width: "350px",
          borderRight: "1px solid rgba(255, 255, 255, 0.08)",
          display: "flex",
          flexDirection: "column",
          background: "rgba(15, 23, 42, 0.3)",
        }}
      >
        <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
          {mutations.length === 0 ? (
            <div
              style={{
                padding: "24px",
                textAlign: "center",
                color: "#64748b",
                fontSize: "12px",
              }}
            >
              No mutation calls recorded yet
            </div>
          ) : (
            mutations.map((m) => {
              const isSelected = activeMutation?.id === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedMutationId(m.id)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: "8px",
                    background: isSelected
                      ? "rgba(168, 85, 247, 0.12)"
                      : "transparent",
                    border: isSelected
                      ? "1px solid rgba(168, 85, 247, 0.3)"
                      : "1px solid transparent",
                    cursor: "pointer",
                    marginBottom: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      flex: 1,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: isSelected ? 600 : 500,
                        color: isSelected ? "#c084fc" : "#e2e8f0",
                        fontSize: "12.5px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {m.mutationKey}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#64748b",
                        marginTop: "2px",
                      }}
                    >
                      {new Date(m.startedAt).toLocaleTimeString()}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    {m.durationMs !== undefined && (
                      <LatencyPill durationMs={m.durationMs} />
                    )}
                    <MutationStatusPill status={m.status} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Mutation Details */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "rgba(15, 23, 42, 0.6)",
        }}
      >
        {activeMutation ? (
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "12px",
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: "14px",
                    color: "#f8fafc",
                  }}
                >
                  {activeMutation.mutationKey}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#94a3b8",
                    marginTop: "2px",
                  }}
                >
                  Latency:{" "}
                  {activeMutation.durationMs !== undefined
                    ? `${activeMutation.durationMs}ms`
                    : "Pending..."}
                </div>
              </div>
              <MutationStatusPill status={activeMutation.status} />
            </div>

            <div style={{ marginBottom: "14px" }}>
              <div
                style={{
                  fontSize: "11.5px",
                  fontWeight: 600,
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "6px",
                }}
              >
                Input Variables
              </div>
              <JsonTree data={activeMutation.variables} />
            </div>

            {activeMutation.data && (
              <div style={{ marginBottom: "14px" }}>
                <div
                  style={{
                    fontSize: "11.5px",
                    fontWeight: 600,
                    color: "#10b981",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "6px",
                  }}
                >
                  Response Result
                </div>
                <JsonTree data={activeMutation.data} />
              </div>
            )}

            {activeMutation.error && (
              <div>
                <div
                  style={{
                    fontSize: "11.5px",
                    fontWeight: 600,
                    color: "#ef4444",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "6px",
                  }}
                >
                  Mutation Error
                </div>
                <JsonTree data={activeMutation.error} />
              </div>
            )}
          </div>
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
            Select a mutation to view details
          </div>
        )}
      </div>
    </div>
  );
};
