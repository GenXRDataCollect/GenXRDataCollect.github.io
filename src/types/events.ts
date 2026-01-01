export type ControlEvent = "control:start" | "control:stop";

export interface ControlPayload {
  source: "web-manager";
  ts: number;               // Date.now()
  note?: string;            // 预留字段
}

export const EVENTS = {
  START: "control:start" as ControlEvent,
  STOP: "control:stop" as ControlEvent,
};