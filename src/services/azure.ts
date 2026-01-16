import { SocketManager, type SocketStatus } from "./socket";
import type { ControlEvent, ControlPayload } from "../types/events";

export type AzureStatus = SocketStatus;

export interface AzureManagerOptions {
  url: string; // e.g. https://genxr-server.azurewebsites.net
  path?: string;
  transports?: ("websocket" | "polling")[];
}

/**
 * AzureManager is just a SocketManager pointing at an Azure-hosted server.
 * Azure Web PubSub runs invisibly behind the server.
 */
export class AzureManager {
  private socketManager: SocketManager;

  constructor(options: AzureManagerOptions) {
    this.socketManager = new SocketManager({
      url: options.url,
      path: options.path,
      transports: options.transports ?? ["websocket"],
    });
  }

  // ---- pass-through API ----

  connect() {
    this.socketManager.connect();
  }

  disconnect() {
    this.socketManager.disconnect();
  }

  emit(event: ControlEvent, payload: ControlPayload) {
    this.socketManager.emit(event, payload);
  }

  onStatus(cb: (s: AzureStatus) => void) {
    return this.socketManager.onStatus(cb);
  }

  onLog(cb: (msg: string) => void) {
    return this.socketManager.onLog(cb);
  }
}
