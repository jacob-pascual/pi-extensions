import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { setupHandoffCommands } from "./commands";
import { setupHandoffTools } from "./tools";

export default function (pi: ExtensionAPI) {
  setupHandoffCommands(pi);
  setupHandoffTools(pi);
}
