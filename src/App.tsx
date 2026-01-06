import { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import { SocketManager, type SocketStatus } from "./services/socket";
import { EVENTS } from "./types/events";
import { logger } from "./services/logger";

export default function App() {
  const [url, setUrl] = useState("http://localhost:3001");
  const [status, setStatus] = useState<SocketStatus>("disconnected");
  const [logs, setLogs] = useState<string[]>([]);
  const [demoId, setDemoId] = useState(0);
  const demoIdRef = useRef(demoId);

  const socketManager = useMemo(() => {
    // 注意：url 变化就 new 一个 manager（简单粗暴但清晰）
    return new SocketManager({ url });
  }, [url]);

  useEffect(() => {
    demoIdRef.current = demoId;
  }, [demoId]);

  useEffect(() => {
    const offStatus = socketManager.onStatus(setStatus);
    const offLog = socketManager.onLog((m) =>
      setLogs((prev) => {
        const id = demoIdRef.current;
        return [`${new Date().toLocaleTimeString()}  [demoID:${id}] ${m}`, ...prev].slice(0, 200);
      })
    );
    return () => {
      offStatus();
      offLog();
      socketManager.disconnect();
    };
  }, [socketManager]);

  const canSend = status === "connected";

  const buildPayload = (note: string, currentDemoId: number) =>
    ({ source: "web-manager", ts: Date.now(), note, demoId: currentDemoId } as const);

  async function sendStartAnimationPreview() {
    const nextDemoId = demoId + 1;
    demoIdRef.current = nextDemoId;
    setDemoId(nextDemoId);
    const payload = buildPayload("start animation preview clicked", nextDemoId);
    socketManager.emit(EVENTS.START_ANIMATION_PREVIEW, payload);
    await logger.logControlAction(EVENTS.START_ANIMATION_PREVIEW, payload);
  }

  async function sendStartPlayAndRecord() {
    const payload = buildPayload("start playing and recording clicked", demoId);
    socketManager.emit(EVENTS.START_PLAY_AND_RECORD, payload);
    await logger.logControlAction(EVENTS.START_PLAY_AND_RECORD, payload);
  }

  async function sendStopRecording() {
    const payload = buildPayload("stop recording clicked", demoId);
    socketManager.emit(EVENTS.STOP_RECORDING, payload);
    await logger.logControlAction(EVENTS.STOP_RECORDING, payload);
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