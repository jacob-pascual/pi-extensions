import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { setupAgentationTools } from "./tools";

export default function (pi: ExtensionAPI) {
  setupAgentationTools(pi);
}
