import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { configLoader } from "../config";
import { MESSAGE_TYPE_PROCESS_UPDATE, type ProcessInfo } from "../constants";
import type { ProcessManager } from "../manager";
import { formatRuntime } from "../utils";

interface ProcessUpdateDetails {
  processId: string;
  processName: string;
  command: string;
  status: "exited" | "killed";
  exitCode: number | null;
  success: boolean;
  runtime: string;
}

export function setupProcessEndHook(pi: ExtensionAPI, manager: ProcessManager) {
  let latestContext: ExtensionContext | null = null;
  const autoHideTimers = new Map<string, ReturnType<typeof setTimeout>>();

  // Capture context from session events
  pi.on("session_start", async (_event, ctx) => {
    latestContext = ctx;
  });

  pi.on("turn_start", async (_event, ctx) => {
    latestContext = ctx;
  });

  pi.on("turn_end", async (_event, ctx) => {
    latestContext = ctx;
  });

  // Clean up auto-hide timers on shutdown
  pi.on("session_shutdown", () => {
    for (const timer of autoHideTimers.values()) {
      clearTimeout(timer);
    }
    autoHideTimers.clear();
  });

  manager.onEvent((event) => {
    if (event.type !== "process_ended") return;

    const info: ProcessInfo = event.info;

    // Determine if the agent should get a turn to react to this process ending.
    // When true, the agent receives the message in its context and can respond
    // (e.g. check results, fix code, restart the process).
    const triggerAgentTurn =
      (info.status === "killed" && info.alertOnKill) ||
      (info.status === "exited" && info.success && info.alertOnSuccess) ||
      (info.status === "exited" && !info.success && info.alertOnFailure);

    const runtime = formatRuntime(info.startTime, info.endTime);

    // Build notification message
    let message: string;
    let level: "info" | "error" | "warning";

    if (info.status === "killed") {
      message = `Process '${info.name}' was terminated (${runtime})`;
      level = "warning";
    } else if (info.success) {
      message = `Process '${info.name}' completed successfully (${runtime})`;
      level = "info";
    } else {
      message = `Process '${info.name}' crashed with exit code ${info.exitCode ?? "?"} (${runtime})`;
      level = "error";
    }

    // Always notify user via UI
    if (latestContext?.hasUI) {
      latestContext.ui.notify(message, level);
    }

    // Always send the message so it appears in the conversation history.
    // Only trigger an agent turn when the notification preferences say so.
    const details: ProcessUpdateDetails = {
      processId: info.id,
      processName: info.name,
      command: info.command,
      status: info.status as "exited" | "killed",
      exitCode: info.exitCode,
      success: info.success ?? false,
      runtime,
    };

    pi.sendMessage(
      {
        customType: MESSAGE_TYPE_PROCESS_UPDATE,
        content: message,
        display: true,
        details,
      },
      { triggerTurn: triggerAgentTurn },
    );

    // Schedule auto-hide if enabled
    const { autoHide } = configLoader.getConfig();
    if (autoHide.enabled) {
      // Cancel any existing timer for this process (shouldn't happen, but be safe)
      const existing = autoHideTimers.get(info.id);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        autoHideTimers.delete(info.id);
        manager.clearProcess(info.id);
      }, autoHide.delayMs);

      autoHideTimers.set(info.id, timer);
    }
  });
}
