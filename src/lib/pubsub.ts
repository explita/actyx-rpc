import type { Redis } from "ioredis";
import { EventEmitter } from "node:events";

export interface PubSubAdapter {
  publish(topic: string, data: any): Promise<void> | void;
  subscribe(
    topic: string,
    callback: (data: any) => void,
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

  publish(topic: string, data: any) {
    this.emitter.emit(topic, data);
  }

  subscribe(topic: string, callback: (data: any) => void) {
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

  async publish(topic: string, data: any) {
    await this.pub.publish(topic, JSON.stringify(data));
  }

  async subscribe(topic: string, callback: (data: any) => void) {
    await this.sub.subscribe(topic);

    const handler = (channel: string, message: string) => {
      if (channel === topic) {
        try {
          callback(JSON.parse(message));
        } catch {
          callback(message);
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
