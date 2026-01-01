export type ControlEvent =
  | "control:start"
  | "control:stop"
  | "control:start-animation-preview"
  | "control:start-play-record"
  | "control:stop-recording";

export interface ControlPayload {
  source: "web-manager";
  ts: number;               // Date.now()
  note?: string;            // 预留字段
}

export const EVENTS = {
  START: "control:start" as ControlEvent,
  STOP: "control:stop" as ControlEvent,
  START_ANIMATION_PREVIEW: "control:start-animation-preview" as ControlEvent,
  START_PLAY_AND_RECORD: "control:start-play-record" as ControlEvent,
  STOP_RECORDING: "control:stop-recording" as ControlEvent,
};