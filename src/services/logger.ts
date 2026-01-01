import type { ControlEvent, ControlPayload } from "../types/events";

export interface LogWriter {
  logControlAction: (event: ControlEvent, payload: ControlPayload) => Promise<void>;
}

/**
 * 默认空实现：你后面要接 Google Sheet 的时候，把这里替换掉即可。
 * 推荐：改成 fetch("https://your-server/api/log", {...})
 */
export const logger: LogWriter = {
  async logControlAction(event, payload) {
    // TODO: integrate Google Sheets logging later
    // await fetch("/api/log", { method:"POST", headers:{...}, body: JSON.stringify({event, payload}) })
    console.debug("[logger stub]", event, payload);
  },
};