"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useQueryClient, getCachedQueryClient } from "../provider.js";
import type { QueryClient } from "../lib/query-client.js";
import type { QueryCacheEntry, MutationLogEntry } from "../types/query-client.js";
import {
  actyxStreamTracker,
  type StreamConnection,
  type StreamEvent,
} from "./stream-tracker.js";
import type { ActyxDevtoolsProps, DevtoolsTab, QueryFilter } from "./types.js";
import {
  ActyxIcon,
  CloseIcon,
  TabButton,
  ActionButton,
  DevtoolsKeyframes,
} from "./components/ui.js";
import { FloatingToggle } from "./components/floating-toggle.js";
import { QueryTab } from "./components/query-tab.js";
import { MutationTab } from "./components/mutation-tab.js";
import { StreamTab } from "./components/stream-tab.js";

export type { ActyxDevtoolsProps } from "./types.js";

export const ActyxDevtools: React.FC<ActyxDevtoolsProps> = ({
  client: explicitClient,
  initialIsOpen = false,
  position = "bottom-right",
  enabled,
  style,
}) => {
  // Check if enabled (default to true in development or browser when not explicitly false)
  const isEnabled = useMemo(() => {
    if (enabled !== undefined) return enabled;
    try {
      const proc =
        typeof globalThis !== "undefined"
          ? (globalThis as any).process
          : undefined;
      return !proc || proc.env?.NODE_ENV !== "production";
    } catch {
      return true;
    }
  }, [enabled]);

  const resolvedContextClient = useQueryClient(explicitClient);
  const [activeClient, setActiveClient] = useState<QueryClient>(() => resolvedContextClient);

  useEffect(() => {
    if (explicitClient) {
      setActiveClient(explicitClient);
      return;
    }
    if (resolvedContextClient) {
      setActiveClient(resolvedContextClient);
    }
  }, [explicitClient, resolvedContextClient]);

  // If initially rendered outside ActyxProvider before context or module cache settled,
  // latch onto the module-level active client as soon as ActyxProvider mounts
  useEffect(() => {
    if (explicitClient) return;
    const checkClient = () => {
      const cached = getCachedQueryClient();
      if (cached && cached !== activeClient) {
        setActiveClient(cached);
      }
    };
    checkClient();
    const interval = setInterval(checkClient, 800);
    return () => clearInterval(interval);
  }, [explicitClient, activeClient]);

  const [isOpen, setIsOpen] = useState(initialIsOpen);
  const [activeTab, setActiveTab] = useState<DevtoolsTab>("queries");
  const [searchQuery, setSearchQuery] = useState("");
  const [queryFilter, setQueryFilter] = useState<QueryFilter>("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedMutationId, setSelectedMutationId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Live state from QueryClient and StreamTracker
  const [queries, setQueries] = useState<QueryCacheEntry[]>(() =>
    activeClient.getCacheEntries(),
  );
  const [mutations, setMutations] = useState<MutationLogEntry[]>(() =>
    activeClient.getMutationHistory(),
  );
  const [streams, setStreams] = useState<StreamConnection[]>(() =>
    actyxStreamTracker.getStreams(),
  );
  const [streamEvents, setStreamEvents] = useState<StreamEvent[]>(() =>
    actyxStreamTracker.getEvents(),
  );

  // Subscribe to changes on activeClient
  useEffect(() => {
    if (!isEnabled) return;

    // Immediately sync when activeClient changes
    setQueries(activeClient.getCacheEntries());
    setMutations(activeClient.getMutationHistory());

    const unsubQueries = activeClient.subscribeAll(() => {
      setQueries(activeClient.getCacheEntries());
    });

    const unsubMutations = activeClient.subscribeMutations(() => {
      setMutations(activeClient.getMutationHistory());
    });

    const unsubStreams = actyxStreamTracker.subscribe(() => {
      setStreams(actyxStreamTracker.getStreams());
      setStreamEvents(actyxStreamTracker.getEvents());
    });

    // Periodic heartbeat to refresh stale status countdowns
    const timer = setInterval(() => {
      setQueries(activeClient.getCacheEntries());
    }, 1500);

    return () => {
      unsubQueries();
      unsubMutations();
      unsubStreams();
      clearInterval(timer);
    };
  }, [isEnabled, activeClient]);

  // Global hotkey listener (Alt+A / ⌥A, Ctrl+Shift+A, or ⌘+Shift+A)
  useEffect(() => {
    if (!isEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isKeyA = e.key === "a" || e.key === "A";
      const isTrigger =
        isKeyA &&
        (e.altKey ||
          (e.ctrlKey && e.shiftKey) ||
          (e.metaKey && e.shiftKey));

      if (isTrigger) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEnabled]);

  const copyToClipboard = useCallback((text: string, id: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedKey(id);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // Ignore clipboard write failures
    }
  }, []);

  if (!isEnabled) return null;

  // Filtered queries
  const filteredQueries = queries.filter((q) => {
    if (
      searchQuery &&
      !q.queryKey.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    if (queryFilter === "fresh") return !q.isStale && q.state.isSuccess;
    if (queryFilter === "stale") return q.isStale && !q.state.isFetching;
    if (queryFilter === "fetching") return q.state.isFetching;
    if (queryFilter === "error") return q.state.isError;
    return true;
  });

  const activeQuery =
    queries.find((q) => q.queryKey === selectedKey) || filteredQueries[0];
  const isFetchingCount = queries.filter((q) => q.state.isFetching).length;
  const isMutatingCount = mutations.filter((m) => m.status === "pending").length;
  const connectedStreamsCount = streams.filter(
    (s) => s.status === "connected",
  ).length;

  // Positioning
  const isTop = position.startsWith("top");
  const isLeft = position.endsWith("left");

  return (
    <div
      style={{
        position: "fixed",
        zIndex: 999999,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", "Helvetica Neue", Arial, sans-serif',
        fontSize: "13px",
        color: "#e2e8f0",
        ...(isTop ? { top: 16 } : { bottom: 16 }),
        ...(isLeft ? { left: 16 } : { right: 16 }),
        ...style,
      }}
    >
      {/* Floating Toggle Button */}
      {!isOpen && (
        <FloatingToggle
          onClick={() => setIsOpen(true)}
          queryCount={queries.length}
          isFetchingCount={isFetchingCount}
          isMutatingCount={isMutatingCount}
        />
      )}

      {/* Main DevTools Panel */}
      {isOpen && (
        <div
          style={{
            width: "780px",
            maxWidth: "calc(100vw - 32px)",
            height: "530px",
            maxHeight: "calc(100vh - 32px)",
            background: "rgba(15, 23, 42, 0.96)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "16px",
            boxShadow:
              "0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "actyx-panel-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 16px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              background: "rgba(30, 41, 59, 0.5)",
            }}
          >
            {/* Title & Brand */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontWeight: 700,
                  fontSize: "14px",
                  color: "#f8fafc",
                }}
              >
                <span
                  style={{
                    color: "#38bdf8",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <ActyxIcon size={18} color="#38bdf8" />
                </span>
                <span>Actyx DevTools</span>
              </div>

              {/* Tabs */}
              <div
                style={{
                  display: "flex",
                  background: "rgba(15, 23, 42, 0.6)",
                  padding: "2px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                }}
              >
                <TabButton
                  active={activeTab === "queries"}
                  onClick={() => setActiveTab("queries")}
                  label={`Queries (${queries.length})`}
                  pulse={isFetchingCount > 0}
                />
                <TabButton
                  active={activeTab === "mutations"}
                  onClick={() => setActiveTab("mutations")}
                  label={`Mutations (${mutations.length})`}
                  pulse={isMutatingCount > 0}
                  pulseColor="#a855f7"
                />
                <TabButton
                  active={activeTab === "streams"}
                  onClick={() => setActiveTab("streams")}
                  label={`Streams (${connectedStreamsCount})`}
                  pulse={connectedStreamsCount > 0}
                  pulseColor="#10b981"
                />
              </div>
            </div>

            {/* Actions & Close */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {activeTab === "queries" && (
                <>
                  <ActionButton
                    onClick={() => activeClient.invalidateAll()}
                    title="Invalidate all queries (refetch active)"
                  >
                    Invalidate All
                  </ActionButton>
                  <ActionButton
                    onClick={() => activeClient.clearCache()}
                    title="Clear query cache"
                  >
                    Clear Cache
                  </ActionButton>
                </>
              )}
              {activeTab === "mutations" && (
                <ActionButton
                  onClick={() => activeClient.clearMutationHistory()}
                  title="Clear mutation history"
                >
                  Clear History
                </ActionButton>
              )}
              {activeTab === "streams" && (
                <ActionButton
                  onClick={() => actyxStreamTracker.clearEvents()}
                  title="Clear event stream log"
                >
                  Clear Events
                </ActionButton>
              )}
              <button
                onClick={() => setIsOpen(false)}
                title="Close DevTools"
                style={{
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  padding: "4px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#f1f5f9")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
              >
                <CloseIcon size={18} />
              </button>
            </div>
          </div>

          {/* Active Tab View */}
          {activeTab === "queries" && (
            <QueryTab
              queries={queries}
              filteredQueries={filteredQueries}
              activeQuery={activeQuery}
              selectedKey={selectedKey}
              setSelectedKey={setSelectedKey}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              queryFilter={queryFilter}
              setQueryFilter={setQueryFilter}
              isFetchingCount={isFetchingCount}
              queryClient={activeClient}
              copiedKey={copiedKey}
              copyToClipboard={copyToClipboard}
            />
          )}

          {activeTab === "mutations" && (
            <MutationTab
              mutations={mutations}
              selectedMutationId={selectedMutationId}
              setSelectedMutationId={setSelectedMutationId}
            />
          )}

          {activeTab === "streams" && (
            <StreamTab
              streams={streams}
              streamEvents={streamEvents}
              selectedEventId={selectedEventId}
              setSelectedEventId={setSelectedEventId}
            />
          )}
        </div>
      )}

      {/* Global CSS keyframes for pulse & panel in */}
      <DevtoolsKeyframes />
    </div>
  );
};
