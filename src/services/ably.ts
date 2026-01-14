import { Realtime, Types } from "ably";
import type { ControlEvent, ControlPayload } from "../types/events";

export type AblyStatus = "disconnected" | "connecting" | "connected" | "error";

export interface AblyManagerOptions {
  // Either provide API key directly (for standalone mode)
  apiKey?: string;
  // Or provide a token endpoint URL (recommended for secure production)
  tokenEndpoint?: string;
  channelName?: string;
}

export class AblyManager {
  private client: Realtime | null = null;
  private channel: Types.RealtimeChannel | null = null;
  private status: AblyStatus = "disconnected";
  private statusListeners = new Set<(s: AblyStatus) => void>();
  private logListeners = new Set<(msg: string) => void>();
  private messageListeners = new Map<ControlEvent, Set<(payload: ControlPayload) => void>>();

  private options: AblyManagerOptions;

  constructor(options: AblyManagerOptions) {
    this.options = {
      channelName: "control-commands",
      ...options,
    };
  }

  onStatus(cb: (s: AblyStatus) => void) {
    this.statusListeners.add(cb);
    cb(this.status);
    return () => this.statusListeners.delete(cb);
  }

  onLog(cb: (msg: string) => void) {
    this.logListeners.add(cb);
    return () => this.logListeners.delete(cb);
  }

  onMessage(event: ControlEvent, cb: (payload: ControlPayload) => void) {
    if (!this.messageListeners.has(event)) {
      this.messageListeners.set(event, new Set());
    }
    this.messageListeners.get(event)!.add(cb);
    return () => this.messageListeners.get(event)?.delete(cb);
  }

  private setStatus(s: AblyStatus) {
    this.status = s;
    this.statusListeners.forEach((cb) => cb(s));
  }

  private log(msg: string) {
    this.logListeners.forEach((cb) => cb(msg));
  }

  private async getAuthToken(): Promise<string> {
    if (this.options.tokenEndpoint) {
      // Fetch token from backend (secure method)
      try {
        const response = await fetch(this.options.tokenEndpoint, { method: "POST" });
        if (!response.ok) throw new Error(`Token endpoint returned ${response.status}`);
        const data = await response.json();
        this.log("Retrieved auth token from server");
        return data.token;
      } catch (error) {
        throw new Error(`Failed to fetch auth token: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else if (this.options.apiKey) {
      // Use API key directly (for local testing only)
      return this.options.apiKey;
    } else {
      throw new Error("No API key or token endpoint provided");
    }
  }

  async connect() {
  if (this.client?.connection.state === "connected") return;

  this.setStatus("connecting");
  this.log(`Connecting to Ably...`);

  try {
    if (this.options.tokenEndpoint) {
      this.client = new Realtime({
        authUrl: this.options.tokenEndpoint,
        authMethod: 'POST',
      });
    } else if (this.options.apiKey) {
      this.client = new Realtime({
        key: this.options.apiKey,
      });
    } else {
      throw new Error("No API key or token endpoint provided");
    }

    // Add more detailed connection event logging
    this.client.connection.on("connecting", () => {
      this.log(`Ably connecting...`);
    });

    this.client.connection.on("connected", () => {
      this.setStatus("connected");
      this.log(`Ably connected. Client ID: ${this.client?.auth.clientId || "unknown"}`);
      this.subscribeToChannel();
    });

    this.client.connection.on("disconnected", () => {
      this.setStatus("disconnected");
      this.log(`Ably disconnected`);
    });

    this.client.connection.on("suspended", () => {
      this.log(`Ably connection suspended`);
    });

    this.client.connection.on("closing", () => {
      this.log(`Ably connection closing`);
    });

    this.client.connection.on("closed", () => {
      this.log(`Ably connection closed`);
    });

    this.client.connection.on("failed", (err) => {
      this.setStatus("error");
      this.log(`Ably connection failed: ${err?.message ?? String(err)}`);
    });

    this.client.connection.on("update", (stateChange) => {
      this.log(`Ably connection update: ${stateChange.previous} -> ${stateChange.current}, reason: ${stateChange.reason?.message || 'none'}`);
    });

  } catch (error) {
    this.setStatus("error");
    this.log(`Failed to initialize Ably: ${error instanceof Error ? error.message : String(error)}`);
  }
}
  private subscribeToChannel() {
    if (!this.client) return;

    this.channel = this.client.channels.get(this.options.channelName!);

    this.channel.subscribe((message) => {
      const { name, data } = message;
      this.log(`Received message on ${name}: ${JSON.stringify(data)}`);

      // Dispatch to specific event listeners
      const listeners = this.messageListeners.get(name as ControlEvent);
      if (listeners) {
        listeners.forEach((cb) => cb(data as ControlPayload));
      }
    });
  }

  disconnect() {
    if (!this.client) return;
    this.log("Disconnecting from Ably...");
    this.channel?.unsubscribe();
    this.client.connection.close();
    this.client = null;
    this.setStatus("disconnected");
  }

  emit(event: ControlEvent, payload: ControlPayload) {
    if (!this.channel) {
      this.log(`Cannot emit "${event}" — not connected`);
      return;
    }
    try {
      this.channel.publish(event, payload);
      this.log(`Published "${event}" with payload=${JSON.stringify(payload)}`);
    } catch (error) {
      this.log(`Failed to publish "${event}": ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
