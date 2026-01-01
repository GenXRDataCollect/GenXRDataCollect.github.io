import { io, Socket } from "socket.io-client";
import type { ControlEvent, ControlPayload } from "../types/events";

export type SocketStatus =
	| "disconnected"
	| "connecting"
	| "connected"
	| "error";

export interface SocketManagerOptions {
	url: string; // e.g. http://localhost:3001
	path?: string; // 如果你 server.js 有自定义 path
	transports?: ("websocket" | "polling")[];
}

export class SocketManager {
	private socket: Socket | null = null;
	private status: SocketStatus = "disconnected";
	private statusListeners = new Set<(s: SocketStatus) => void>();
	private logListeners = new Set<(msg: string) => void>();

	private options: SocketManagerOptions;

	constructor(options: SocketManagerOptions) {
		this.options = options;
	}

	onStatus(cb: (s: SocketStatus) => void) {
		this.statusListeners.add(cb);
		cb(this.status);
		return () => this.statusListeners.delete(cb);
	}

	onLog(cb: (msg: string) => void) {
		this.logListeners.add(cb);
		return () => this.logListeners.delete(cb);
	}

	private setStatus(s: SocketStatus) {
		this.status = s;
		this.statusListeners.forEach((cb) => cb(s));
	}

	private log(msg: string) {
		this.logListeners.forEach((cb) => cb(msg));
	}

	connect() {
		if (this.socket?.connected) return;

		this.setStatus("connecting");
		this.log(`Connecting to ${this.options.url} ...`);

		const socket = io(this.options.url, {
			path: this.options.path,
			transports: this.options.transports ?? ["websocket"],
			autoConnect: true,
		});

		socket.on("connect", () => {
			this.setStatus("connected");
			this.log(`Connected. socket.id=${socket.id}`);
		});

		socket.on("disconnect", (reason) => {
			this.setStatus("disconnected");
			this.log(`Disconnected: ${reason}`);
		});

		socket.on("connect_error", (err) => {
			this.setStatus("error");
			this.log(`Connect error: ${err?.message ?? String(err)}`);
		});

		this.socket = socket;
	}

	disconnect() {
		if (!this.socket) return;
		this.log("Disconnecting...");
		this.socket.disconnect();
		this.socket = null;
		this.setStatus("disconnected");
	}

	emit(event: ControlEvent, payload: ControlPayload) {
		if (!this.socket || !this.socket.connected) {
			this.log(`Cannot emit "${event}" — not connected`);
			return;
		}
		this.socket.emit(event, payload);
		this.log(`Emitted "${event}" with payload=${JSON.stringify(payload)}`);
	}
}
