import { WebPubSubClient } from "@azure/web-pubsub-client";

export type AzureStatus = "disconnected" | "connecting" | "connected" | "error";

type Listener = (...args: any[]) => void;
type Unsubscribe = () => void;

export class AzureManager {
  private client: WebPubSubClient | null = null;
  private tokenEndpoint: string;
  private status: AzureStatus = "disconnected";
  private statusListeners = new Set<(status: AzureStatus) => void>();
  private logListeners = new Set<(message: string) => void>();
  private eventListeners = new Map<string, Set<Listener>>();
  private groupName = "control-group";

  constructor(options: { tokenEndpoint: string }) {
    this.tokenEndpoint = options.tokenEndpoint;
  }

  private log(message: string) {
    console.log(`[AzureManager] ${message}`);
    this.logListeners.forEach((fn) => fn(message));
  }

  private setStatus(status: AzureStatus) {
    this.status = status;
    this.statusListeners.forEach((fn) => fn(status));
  }

  async connect() {
    if (this.status === "connecting" || this.status === "connected") {
      this.log("Already connecting or connected");
      return;
    }

    this.setStatus("connecting");
    this.log("Fetching Azure token...");

    try {
      const response = await fetch(this.tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Token fetch failed: ${response.statusText}`);
      }

      const { url } = await response.json();
      this.log("Token received, connecting to Azure Web PubSub...");

      this.client = new WebPubSubClient(url);

      this.client.on("connected", () => {
        this.log("Connected to Azure Web PubSub");
        this.setStatus("connected");
        
        // Join the control group for broadcasting
        this.client?.joinGroup(this.groupName);
        this.log(`Joined group: ${this.groupName}`);
      });

      this.client.on("disconnected", () => {
        this.log("Disconnected from Azure Web PubSub");
        this.setStatus("disconnected");
      });

      this.client.on("group-message", (e) => {
        const { message, dataType } = e;
        
        if (dataType === "json" && message && typeof message === "object") {
          const { event, payload } = message as { event: string; payload: any };
          
          if (event) {
            this.log(`Received ${event}`);
            const listeners = this.eventListeners.get(event);
            if (listeners) {
              listeners.forEach((fn) => fn(payload));
            }
          }
        }
      });

      await this.client.start();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`Connection error: ${errorMessage}`);
      this.setStatus("error");
    }
  }

  disconnect() {
    if (this.client) {
      this.log("Disconnecting...");
      this.client.stop();
      this.client = null;
    }
    this.setStatus("disconnected");
  }

  emit(event: string, payload: any) {
    if (!this.client || this.status !== "connected") {
      this.log(`Cannot emit ${event}: not connected`);
      return;
    }

    this.log(`Emitting ${event}`);
    
    // Send to the group as JSON
    this.client.sendToGroup(this.groupName, { event, payload }, "json");
  }

  on(event: string, listener: Listener): Unsubscribe {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);

    return () => {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        listeners.delete(listener);
      }
    };
  }

  onStatus(listener: (status: AzureStatus) => void): Unsubscribe {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  onLog(listener: (message: string) => void): Unsubscribe {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  }
}