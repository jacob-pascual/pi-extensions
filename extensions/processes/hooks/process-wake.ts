import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { MESSAGE_TYPE_PROCESS_WAKE, type ProcessInfo } from "../constants";
import type { ProcessManager } from "../manager";
import { formatRuntime } from "../utils";

export interface ProcessWakeDetails {
  processId: string;
  processName: string;
  command: string;
  status: string;
  runtime: string;
  wakeDuration: number;
}

export function setupProcessWakeHook(
  pi: ExtensionAPI,
  manager: ProcessManager,
) {
  let latestContext: ExtensionContext | null = null;

  pi.on("session_start", async (_event, ctx) => {
    latestContext = ctx;
  });

  pi.on("turn_start", async (_event, ctx) => {
    latestContext = ctx;
  });

  pi.on("turn_end", async (_event, ctx) => {
    latestContext = ctx;
  });

  manager.onEvent((event) => {
    if (event.type !== "process_wake") return;

    const info: ProcessInfo = event.info;
    const runtime = formatRuntime(info.startTime, info.endTime);

    const message = `Process '${info.name}' is still running after ${info.wakeDuration}s (${runtime} elapsed). Check on it with: processes output id="${info.id}"`;

    if (latestContext?.hasUI) {
      latestContext.ui.notify(message, "info");
    }

    const details: ProcessWakeDetails = {
      processId: info.id,
      processName: info.name,
      command: info.command,
      status: info.status,
      runtime,
      wakeDuration: info.wakeDuration ?? 0,
    };

    pi.sendMessage(
      {
        customType: MESSAGE_TYPE_PROCESS_WAKE,
        content: message,
        display: true,
        details,
      },
      { triggerTurn: true },
    );
  });
}
