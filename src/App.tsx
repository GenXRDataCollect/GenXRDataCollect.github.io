import { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import { SocketManager, type SocketStatus } from "./services/socket";
import { AblyManager, type AblyStatus } from "./services/ably";
import { EVENTS } from "./types/events";
import { logger } from "./services/logger";

type ConnectionMode = "socket.io" | "ably";

export default function App() {
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>("socket.io");
  const [url, setUrl] = useState("http://localhost:3001");
  const [status, setStatus] = useState<SocketStatus | AblyStatus>("disconnected");
  const [logs, setLogs] = useState<string[]>([]);
  const [demoId, setDemoId] = useState(0);
  const demoIdRef = useRef(demoId);

  const socketManager = useMemo(() => {
    return new SocketManager({ url });
  }, [url]);

  const ablyManager = useMemo(() => {
    // Use token endpoint for secure authentication
    // The server endpoint handles the API key securely
    return new AblyManager({ tokenEndpoint: `${url.replace(':3001', ':3001')}/api/ably-token` });
  }, [url]);

  useEffect(() => {
    demoIdRef.current = demoId;
  }, [demoId]);

  const manager = connectionMode === "socket.io" ? socketManager : ablyManager;

  useEffect(() => {
    const offStatus = manager.onStatus(setStatus);
    const offLog = manager.onLog((m) =>
      setLogs((prev) => {
        const id = demoIdRef.current;
        return [`${new Date().toLocaleTimeString()}  [demoID:${id}] ${m}`, ...prev].slice(0, 200);
      })
    );
    return () => {
      offStatus();
      offLog();
      manager.disconnect();
    };
  }, [manager]);

  const canSend = status === "connected";

  const buildPayload = (note: string, currentDemoId: number) =>
    ({ source: "web-manager", ts: Date.now(), note, demoId: currentDemoId } as const);

  async function sendStartAnimationPreview() {
    const nextDemoId = demoId + 1;
    demoIdRef.current = nextDemoId;
    setDemoId(nextDemoId);
    const payload = buildPayload("start animation preview clicked", nextDemoId);
    manager.emit(EVENTS.START_ANIMATION_PREVIEW, payload);
    await logger.logControlAction(EVENTS.START_ANIMATION_PREVIEW, payload);
  }

  async function sendStartPlayAndRecord() {
    const payload = buildPayload("start playing and recording clicked", demoId);
    manager.emit(EVENTS.START_PLAY_AND_RECORD, payload);
    await logger.logControlAction(EVENTS.START_PLAY_AND_RECORD, payload);
  }

  async function sendStopRecording() {
    const payload = buildPayload("stop recording clicked", demoId);
    manager.emit(EVENTS.STOP_RECORDING, payload);
    await logger.logControlAction(EVENTS.STOP_RECORDING, payload);
  }

  return (
    <div className="page">
      <h1>Control Manager (Multi-Device)</h1>

      <div className="card">
        <div className="row">
          <label>Connection Mode</label>
          <select value={connectionMode} onChange={(e) => setConnectionMode(e.target.value as ConnectionMode)}>
            <option value="socket.io">Socket.IO (Local Dev)</option>
            <option value="ably">Ably (Multi-Device)</option>
          </select>
        </div>

        {connectionMode === "socket.io" ? (
          <div className="row">
            <label>Server URL</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://localhost:3001" />
          </div>
        ) : (
          <div className="row">
            <label>Server URL</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://localhost:3001" />
            <small style={{ display: "block", marginTop: "4px" }}>
              Make sure your server has <code>ABLY_API_KEY</code> in environment
            </small>
          </div>
        )}

        <div className="row">
          <label>Demo ID</label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={demoId}
            onChange={(e) => {
              const next = Number(e.target.value) || 0;
              demoIdRef.current = next;
              setDemoId(next);
            }}
            title="Scroll or type to set the current demo ID"
          />
        </div>

        <div className="row">
          <div className="status">
            Status: <b>{status}</b>
          </div>

          <div className="actions">
            <button
              onClick={() => manager.connect()}
              disabled={status === "connecting" || status === "connected"}
            >
              Connect
            </button>
            <button onClick={() => manager.disconnect()} disabled={status === "disconnected"}>
              Disconnect
            </button>
          </div>
        </div>

        <div className="row">
          <button className="primary" onClick={sendStartAnimationPreview} disabled={!canSend}>
            Start animation preview
          </button>
          <button className="primary" onClick={sendStartPlayAndRecord} disabled={!canSend}>
            Start playing and recording
          </button>
          <button className="danger" onClick={sendStopRecording} disabled={!canSend}>
            Stop recording
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