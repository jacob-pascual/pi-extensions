import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { configLoader } from "../config";
import { LIVE_STATUSES } from "../constants";
import type { ProcessManager } from "../manager";

const WIDGET_ID = "processes-status";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SPINNER_INTERVAL_MS = 80;

export function setupProcessWidget(pi: ExtensionAPI, manager: ProcessManager) {
  let latestContext: ExtensionContext | null = null;
  let spinnerFrame = 0;
  let spinnerInterval: ReturnType<typeof setInterval> | null = null;

  function updateWidget() {
    if (!latestContext?.hasUI) return;

    if (!configLoader.getConfig().widget.showStatusWidget) {
      latestContext.ui.setWidget(WIDGET_ID, undefined);
      stopSpinner();
      return;
    }

    const processes = manager.list();
    if (processes.length === 0) {
      latestContext.ui.setWidget(WIDGET_ID, undefined);
      stopSpinner();
      return;
    }

    const now = Date.now();
    const { autoHide } = configLoader.getConfig();
    const doneExpiryMs = autoHide.enabled ? autoHide.delayMs : 0;

    let active = 0;
    let failed = 0;
    let done = 0;

    for (const p of processes) {
      if (LIVE_STATUSES.has(p.status)) {
        active++;
      } else if (p.success) {
        // Hide "done" after the expiry window (when autoHide is enabled)
        if (doneExpiryMs > 0 && p.endTime && now - p.endTime >= doneExpiryMs) {
          continue;
        }
        done++;
      } else {
        failed++;
      }
    }

    if (active === 0 && failed === 0 && done === 0) {
      latestContext.ui.setWidget(WIDGET_ID, undefined);
      stopSpinner();
      return;
    }

    const theme = latestContext.ui.theme;
    const frame = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length] ?? "⠋";
    const spinner = active > 0 ? `${theme.fg("accent", frame)} ` : "";

    const parts: string[] = [];
    if (active > 0) {
      parts.push(theme.fg("accent", `${active} active`));
    }
    if (failed > 0) {
      parts.push(theme.fg("error", `${failed} failed`));
    }
    if (done > 0) {
      parts.push(theme.fg("success", `${done} done`));
    }

    const line =
      spinner +
      theme.fg("dim", "processes: ") +
      parts.join(theme.fg("dim", ", "));

    latestContext.ui.setWidget(WIDGET_ID, [line], {
      placement: "belowEditor",
    });

    // Run spinner while there are active processes or visible done processes
    if (active > 0) {
      ensureSpinner();
    } else {
      stopSpinner();
      // Schedule a re-render when the next "done" process expires
      scheduleExpiryUpdate(processes, now, doneExpiryMs);
    }
  }

  let expiryTimeout: ReturnType<typeof setTimeout> | null = null;

  function scheduleExpiryUpdate(
    processes: ReturnType<typeof manager.list>,
    now: number,
    doneExpiryMs: number,
  ) {
    if (expiryTimeout) {
      clearTimeout(expiryTimeout);
      expiryTimeout = null;
    }
    if (doneExpiryMs <= 0) return;

    // Find the next "done" process that will expire
    let nextExpiry = Number.POSITIVE_INFINITY;
    for (const p of processes) {
      if (p.success && p.endTime) {
        const expiresAt = p.endTime + doneExpiryMs;
        if (expiresAt > now && expiresAt < nextExpiry) {
          nextExpiry = expiresAt;
        }
      }
    }

    if (nextExpiry < Number.POSITIVE_INFINITY) {
      const delay = nextExpiry - now + 100; // small buffer
      expiryTimeout = setTimeout(() => {
        expiryTimeout = null;
        updateWidget();
      }, delay);
    }
  }

  function ensureSpinner() {
    if (spinnerInterval) return;
    spinnerInterval = setInterval(() => {
      spinnerFrame++;
      updateWidget();
    }, SPINNER_INTERVAL_MS);
  }

  function stopSpinner() {
    if (!spinnerInterval) return;
    clearInterval(spinnerInterval);
    spinnerInterval = null;
    spinnerFrame = 0;
  }

  pi.on("session_start", async (_event, ctx) => {
    latestContext = ctx;
    updateWidget();
  });

  pi.on("session_switch", async (_event, ctx) => {
    latestContext = ctx;
    updateWidget();
  });

  pi.on("session_shutdown", () => {
    stopSpinner();
    if (expiryTimeout) {
      clearTimeout(expiryTimeout);
      expiryTimeout = null;
    }
  });

  manager.onEvent(() => {
    updateWidget();
  });

  return {
    update: updateWidget,
  };
}
