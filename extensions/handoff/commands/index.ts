/**
 * Handoff command — transfer context to a new focused session.
 *
 * Usage:
 *   /handoff <goal for new thread>
 *
 * Compacts the current conversation into a self-contained prompt
 * targeted at the stated goal, then opens a new linked session
 * and submits the prompt automatically.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { BorderedLoader } from "@mariozechner/pi-coding-agent";
import {
  buildFinalPrompt,
  generateHandoffPrompt,
} from "../lib/context-generator";

export function setupHandoffCommands(pi: ExtensionAPI) {
  pi.registerCommand("handoff", {
    description: "Transfer context to a new focused session",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("handoff requires interactive mode", "error");
        return;
      }

      if (!ctx.model) {
        ctx.ui.notify("No model selected", "error");
        return;
      }

      const goal = args.trim();
      if (!goal) {
        ctx.ui.notify("Usage: /handoff <goal for new thread>", "error");
        return;
      }

      const branch = ctx.sessionManager.getBranch();
      const hasMessages = branch.some((e) => e.type === "message");
      if (!hasMessages) {
        ctx.ui.notify("No conversation to hand off", "error");
        return;
      }

      const currentSessionFile = ctx.sessionManager.getSessionFile();

      // Generate the handoff prompt, showing a loader while working.
      const result = await ctx.ui.custom<string | null>(
        (tui, theme, _kb, done) => {
          const loader = new BorderedLoader(
            tui,
            theme,
            "Generating handoff prompt\u2026",
          );
          loader.onAbort = () => done(null);

          generateHandoffPrompt(ctx, goal, loader.signal)
            .then(done)
            .catch((err) => {
              console.error("Handoff generation failed:", err);
              done(null);
            });

          return loader;
        },
      );

      if (result === null) {
        ctx.ui.notify("Cancelled", "info");
        return;
      }

      // Create a new session linked to the current one.
      const newSessionResult = await ctx.newSession({
        parentSession: currentSessionFile ?? undefined,
      });

      if (newSessionResult.cancelled) {
        ctx.ui.notify("New session cancelled", "info");
        return;
      }

      // Name the new session after the goal for easy identification.
      pi.setSessionName(goal);

      // Build and submit the prompt so the agent starts immediately.
      const finalPrompt = buildFinalPrompt(
        goal,
        result,
        currentSessionFile ?? null,
      );
      pi.sendUserMessage(finalPrompt);
    },
  });
}
