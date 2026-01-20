import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

/**
 * Prevents bash tool calls that attempt to spawn another instance of pi.
 * Running nested pi instances can cause resource conflicts and unexpected behavior.
 */

// Patterns that indicate attempting to run pi as a command
const PI_SPAWN_PATTERNS = [
  // Direct invocation at start of command or after shell operators
  /(?:^|&&|\|\||;|\||&|\$\(|`)\s*pi(?:\s|$|;|&|\|)/,
  // With explicit path
  /(?:^|&&|\|\||;|\||&|\$\(|`)\s*\.\/pi(?:\s|$|;|&|\|)/,
  // Via common command wrappers
  /\b(?:exec|nohup|command|env)\s+pi(?:\s|$)/,
  // Via npx or similar runners
  /\b(?:npx|pnpx)\s+pi(?:\s|$)/,
];

export function setupPreventPiSpawnHook(pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return;

    const command = String(event.input.command ?? "");

    for (const pattern of PI_SPAWN_PATTERNS) {
      if (pattern.test(command)) {
        ctx.ui.notify(
          "Blocked attempt to spawn another pi instance.",
          "warning",
        );
        return {
          block: true,
          reason:
            "Spawning another pi instance from within pi is not allowed. Running nested pi instances can cause resource conflicts and unexpected behavior. If you need to perform a task, do it directly within this session.",
        };
      }
    }
    return;
  });
}
