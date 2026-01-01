import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import { SocketManager, type SocketStatus } from "./services/socket";
import { EVENTS } from "./types/events";
import { logger } from "./services/logger";

export default function App() {
  const [url, setUrl] = useState("http://localhost:3001");
  const [status, setStatus] = useState<SocketStatus>("disconnected");
  const [logs, setLogs] = useState<string[]>([]);

  const socketManager = useMemo(() => {
    // 注意：url 变化就 new 一个 manager（简单粗暴但清晰）
    return new SocketManager({ url });
  }, [url]);

  useEffect(() => {
    const offStatus = socketManager.onStatus(setStatus);
    const offLog = socketManager.onLog((m) =>
      setLogs((prev) => [`${new Date().toLocaleTimeString()}  ${m}`, ...prev].slice(0, 200))
    );
    return () => {
      offStatus();
      offLog();
      socketManager.disconnect();
    };
  }, [socketManager]);

  const canSend = status === "connected";

  async function sendStart() {
    const payload = { source: "web-manager", ts: Date.now(), note: "start clicked" } as const;
    socketManager.emit(EVENTS.START, payload);
    await logger.logControlAction(EVENTS.START, payload);
  }

  async function sendStop() {
    const payload = { source: "web-manager", ts: Date.now(), note: "stop clicked" } as const;
    socketManager.emit(EVENTS.STOP, payload);
    await logger.logControlAction(EVENTS.STOP, payload);
  }

  return (
    <div className="page">
      <h1>WebSocket / Socket.IO Manager</h1>

      <div className="card">
        <div className="row">
          <label>Server URL</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://localhost:3001" />
        </div>

        <div className="row">
          <div className="status">
            Status: <b>{status}</b>
          </div>

          <div className="actions">
            <button
              onClick={() => socketManager.connect()}
              disabled={status === "connecting" || status === "connected"}
            >
              Connect
            </button>
            <button onClick={() => socketManager.disconnect()} disabled={status === "disconnected"}>
              Disconnect
            </button>
          </div>
        </div>

        <div className="row">
          <button className="primary" onClick={sendStart} disabled={!canSend}>
            Start
          </button>
          <button className="danger" onClick={sendStop} disabled={!canSend}>
            Stop
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Logs</h2>
        <pre className="logbox">{logs.join("\n")}</pre>
      </div>
    </div>
  );
}