/**
 * Tool call formatter for rush subagent display.
 */

import type { SubagentToolCall } from "../../lib/types";

interface FormattedToolCall {
  label: string;
  detail?: string;
}

/** Format a tool call for human-readable display */
export function formatRushToolCall(tc: SubagentToolCall): FormattedToolCall {
  const { toolName, args } = tc;

  switch (toolName) {
    case "Read":
    case "read": {
      const filePath = args.file_path as string | undefined;
      if (filePath) {
        // Show just filename for brevity
        const parts = filePath.split("/");
        return { label: "Read", detail: parts[parts.length - 1] };
      }
      return { label: "Read" };
    }

    case "Glob":
    case "glob": {
      const pattern = args.pattern as string | undefined;
      return { label: "Glob", detail: pattern };
    }

    case "Grep":
    case "grep": {
      const pattern = args.pattern as string | undefined;
      return { label: "Grep", detail: pattern };
    }

    case "Bash":
    case "bash": {
      const command = args.command as string | undefined;
      if (command) {
        // Show first part of command
        const preview = command.length > 40 ? `${command.slice(0, 40)}...` : command;
        return { label: "Bash", detail: preview };
      }
      return { label: "Bash" };
    }

    case "Edit":
    case "edit": {
      const filePath = args.file_path as string | undefined;
      if (filePath) {
        const parts = filePath.split("/");
        return { label: "Edit", detail: parts[parts.length - 1] };
      }
      return { label: "Edit" };
    }

    case "Write":
    case "write": {
      const filePath = args.file_path as string | undefined;
      if (filePath) {
        const parts = filePath.split("/");
        return { label: "Write", detail: parts[parts.length - 1] };
      }
      return { label: "Write" };
    }

    default:
      return { label: toolName };
  }
}
