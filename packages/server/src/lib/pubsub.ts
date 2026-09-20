import type { Redis } from "ioredis";
import { EventEmitter } from "node:events";

export interface PubSubAdapter {
  publish<TData = any>(topic: string, data: TData): Promise<void> | void;
  subscribe<TData = any>(
    topic: string,
    callback: (data: TData) => void,
  ): (() => void) | Promise<() => void>;
}

/**
 * In-memory PubSub for local development.
 */
export class MemoryPubSub implements PubSubAdapter {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  publish<TData = any>(topic: string, data: TData) {
    this.emitter.emit(topic, data);
  }

  subscribe<TData = any>(topic: string, callback: (data: TData) => void) {
    this.emitter.on(topic, callback);
    return () => {
      this.emitter.off(topic, callback);
    };
  }
}

/**
 * Redis-backed PubSub for distributed environments.
 */
export class RedisPubSub implements PubSubAdapter {
  private pub: Redis;
  private sub: Redis;

  constructor(redisInstance: Redis) {
    this.pub = redisInstance;
    this.sub = this.pub.duplicate();
  }

  async publish<TData = any>(topic: string, data: TData) {
    await this.pub.publish(topic, JSON.stringify(data));
  }

  async subscribe<TData = any>(topic: string, callback: (data: TData) => void) {
    await this.sub.subscribe(topic);

    const handler = (channel: string, message: string) => {
      if (channel === topic) {
        try {
          callback(JSON.parse(message));
        } catch {
          callback(message as TData);
        }
      }
    };

    this.sub.on("message", handler);

    return async () => {
      this.sub.off("message", handler);
      await this.sub.unsubscribe(topic);
    };
  }
}
