import React from "react";
import type { StreamConnection, StreamEvent } from "../stream-tracker.js";
import { StreamStatusDot, JsonTree } from "./ui.js";

export type StreamTabProps = {
  streams: StreamConnection[];
  streamEvents: StreamEvent[];
  selectedEventId: string | null;
  setSelectedEventId: (id: string) => void;
};

export const StreamTab: React.FC<StreamTabProps> = ({
  streams,
  streamEvents,
  selectedEventId,
  setSelectedEventId,
}) => {
  const activeStreams = streams.filter((s) => s.status !== "disconnected");
  const activeStreamEvent =
    streamEvents.find((e) => e.id === selectedEventId) || streamEvents[0];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        overflow: "hidden",
      }}
    >
      {/* Active Connections Grid */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          background: "rgba(30, 41, 59, 0.4)",
        }}
      >
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
          Active Connections ({activeStreams.length})
        </div>
        {activeStreams.length === 0 ? (
          <div style={{ fontSize: "12px", color: "#64748b" }}>
            No active SSE or WebSocket connections currently mounted.
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {activeStreams.map((s) => (
              <div
                key={s.id}
                style={{
                  background: "rgba(15, 23, 42, 0.8)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "8px",
                  padding: "6px 10px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span
                  style={{
                    background: s.type === "sse" ? "#0284c7" : "#0d9488",
                    color: "#fff",
                    fontSize: "10px",
                    fontWeight: 700,
                    padding: "2px 5px",
                    borderRadius: "4px",
                  }}
                >
                  {s.type.toUpperCase()}
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    maxWidth: "160px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.url}
                </span>
                <StreamStatusDot status={s.status} />
                <span style={{ fontSize: "11px", color: "#64748b" }}>
                  {s.eventCount} ev
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live Events Stream List & Inspector */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Events list */}
        <div
          style={{
            width: "360px",
            borderRight: "1px solid rgba(255, 255, 255, 0.08)",
            overflowY: "auto",
            padding: "8px",
            background: "rgba(15, 23, 42, 0.2)",
          }}
        >
          {streamEvents.length === 0 ? (
            <div
              style={{
                padding: "24px",
                textAlign: "center",
                color: "#64748b",
                fontSize: "12px",
              }}
            >
              Awaiting incoming stream events...
            </div>
          ) : (
            streamEvents.map((ev) => {
              const isSelected = activeStreamEvent?.id === ev.id;
              return (
                <div
                  key={ev.id}
                  onClick={() => setSelectedEventId(ev.id)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "6px",
                    background: isSelected
                      ? "rgba(16, 185, 129, 0.12)"
                      : "transparent",
                    border: isSelected
                      ? "1px solid rgba(16, 185, 129, 0.3)"
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
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        color:
                          ev.streamType === "sse" ? "#38bdf8" : "#2dd4bf",
                      }}
                    >
                      {ev.streamType.toUpperCase()}
                    </span>
                    <span style={{ fontSize: "12px", color: "#e2e8f0" }}>
                      {ev.eventName || "data"}
                    </span>
                  </div>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    {new Date(ev.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Event Payload Inspector */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "14px 16px",
            background: "rgba(15, 23, 42, 0.6)",
          }}
        >
          {activeStreamEvent ? (
            <div>
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
                Event Payload ({activeStreamEvent.eventName || "data"})
              </div>
              <JsonTree data={activeStreamEvent.data} />
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                height: "100%",
                alignItems: "center",
                justifyContent: "center",
                color: "#64748b",
              }}
            >
              Select an event from the feed to inspect payload
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
