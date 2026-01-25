import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { setupGenerateTool } from "./generate-tool";

export function setupAgentationTools(pi: ExtensionAPI) {
  setupGenerateTool(pi);
}
