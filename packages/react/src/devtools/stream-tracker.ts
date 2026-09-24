export type StreamType = "sse" | "ws";

export type StreamConnection = {
  id: string;
  type: StreamType;
  url: string;
  status: "connecting" | "connected" | "disconnected" | "error";
  connectedAt: number;
  eventCount: number;
  lastEventAt?: number;
  error?: string;
};

export type StreamEvent = {
  id: string;
  streamId: string;
  streamType: StreamType;
  streamUrl: string;
  eventName?: string;
  data: any;
  timestamp: number;
};

class ActyxStreamTracker {
  private streams = new Map<string, StreamConnection>();
  private events: StreamEvent[] = [];
  private maxEvents = 200;
  private listeners = new Set<() => void>();

  registerStream(type: StreamType, url: string): string {
    const id = "stream_" + Math.random().toString(36).slice(2, 9);
    this.streams.set(id, {
      id,
      type,
      url,
      status: "connecting",
      connectedAt: Date.now(),
      eventCount: 0,
    });
    this.notify();
    return id;
  }

  updateStatus(
    id: string,
    status: StreamConnection["status"],
    error?: string,
  ): void {
    const stream = this.streams.get(id);
    if (stream) {
      stream.status = status;
      if (error) stream.error = error;
      this.notify();
    }
  }

  recordEvent(id: string, eventName: string | undefined, data: any): void {
    const stream = this.streams.get(id);
    if (stream) {
      stream.eventCount++;
      stream.lastEventAt = Date.now();
      stream.status = "connected";
    }

    const event: StreamEvent = {
      id: "ev_" + Math.random().toString(36).slice(2, 9) + "_" + Date.now(),
      streamId: id,
      streamType: stream?.type ?? "sse",
      streamUrl: stream?.url ?? "unknown",
      eventName,
      data,
      timestamp: Date.now(),
    };

    this.events.unshift(event);
    if (this.events.length > this.maxEvents) {
      this.events.pop();
    }
    this.notify();
  }

  unregisterStream(id: string): void {
    this.streams.delete(id);
    this.notify();
  }

  getStreams(): StreamConnection[] {
    return Array.from(this.streams.values());
  }

  getEvents(): StreamEvent[] {
    return [...this.events];
  }

  clearEvents(): void {
    this.events = [];
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const actyxStreamTracker = new ActyxStreamTracker();
