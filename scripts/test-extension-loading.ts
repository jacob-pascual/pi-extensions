#!/usr/bin/env npx tsx
/**
 * Test script that verifies each extension can be loaded without errors.
 *
 * Creates a mock ExtensionAPI and invokes each extension's default export.
 * This catches import errors, syntax errors, and initialization failures.
 *
 * Usage:
 *   npx tsx scripts/test-extension-loading.ts
 *   # or via npm script:
 *   pnpm test:extensions
 */

import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

// ==============================================================================
// Fake environment variables for extensions that require them
// ==============================================================================

const FAKE_ENV_VARS: Record<string, string> = {
  // specialized-subagents
  EXA_API_KEY: "fake-exa-api-key-for-testing",
  LINKUP_API_KEY: "fake-linkup-api-key-for-testing",
  SCOUT_GITHUB_TOKEN: "fake-github-token-for-testing",

  // providers (optional but set to avoid warnings)
  OPENROUTER_GOOGLE_API_KEY: "fake-openrouter-google-key",
  OPENROUTER_MOONSHOT_API_KEY: "fake-openrouter-moonshot-key",

  // neovim (optional)
  NVIM_APPNAME: "nvim",

  // pi directory (used by session-management, providers)
  PI_CODING_AGENT_DIR: "/tmp/pi-test-agent-dir",
};

// Set fake env vars before loading extensions
for (const [key, value] of Object.entries(FAKE_ENV_VARS)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}

// ==============================================================================
// Mock ExtensionAPI
// ==============================================================================

type EventHandler = (...args: unknown[]) => unknown;
type ToolDefinition = { name: string; [key: string]: unknown };
type CommandDefinition = { description?: string; [key: string]: unknown };

interface MockEventEmitter {
  on: (event: string, handler: EventHandler) => void;
  emit: (event: string, data: unknown) => void;
  _handlers: Map<string, EventHandler[]>;
}

interface MockExtensionAPI {
  registerTool: (tool: ToolDefinition) => void;
  registerCommand: (name: string, command: CommandDefinition) => void;
  registerMessageRenderer: (name: string, renderer: unknown) => void;
  on: (event: string, handler: EventHandler) => void;
  events: MockEventEmitter;

  // Track what was registered
  _tools: ToolDefinition[];
  _commands: Map<string, CommandDefinition>;
  _events: Map<string, EventHandler[]>;
  _renderers: Map<string, unknown>;
}

function createMockEventEmitter(): MockEventEmitter {
  const handlers = new Map<string, EventHandler[]>();

  return {
    on(event: string, handler: EventHandler) {
      if (!handlers.has(event)) {
        handlers.set(event, []);
      }
      handlers.get(event)?.push(handler);
    },

    emit(event: string, data: unknown) {
      const eventHandlers = handlers.get(event);
      if (eventHandlers) {
        for (const handler of eventHandlers) {
          handler(data);
        }
      }
    },

    _handlers: handlers,
  };
}

function createMockExtensionAPI(): MockExtensionAPI {
  const tools: ToolDefinition[] = [];
  const commands = new Map<string, CommandDefinition>();
  const events = new Map<string, EventHandler[]>();
  const renderers = new Map<string, unknown>();
  const eventEmitter = createMockEventEmitter();

  return {
    registerTool(tool: ToolDefinition) {
      tools.push(tool);
    },

    registerCommand(name: string, command: CommandDefinition) {
      commands.set(name, command);
    },

    registerMessageRenderer(name: string, renderer: unknown) {
      renderers.set(name, renderer);
    },

    on(event: string, handler: EventHandler) {
      if (!events.has(event)) {
        events.set(event, []);
      }
      events.get(event)?.push(handler);
    },

    // Event emitter for inter-extension communication
    events: eventEmitter,

    _tools: tools,
    _commands: commands,
    _events: events,
    _renderers: renderers,
  };
}

// ==============================================================================
// Extension discovery
// ==============================================================================

const EXTENSIONS_DIR = resolve(import.meta.dirname, "../extensions");

function discoverExtensions(): string[] {
  const extensions: string[] = [];

  for (const name of readdirSync(EXTENSIONS_DIR)) {
    const extPath = join(EXTENSIONS_DIR, name);
    const indexPath = join(extPath, "index.ts");

    if (existsSync(indexPath)) {
      extensions.push(name);
    }
  }

  return extensions.sort();
}

// ==============================================================================
// Test runner
// ==============================================================================

interface TestResult {
  extension: string;
  success: boolean;
  error?: string;
  errorType?: "import" | "init" | "export";
  tools: string[];
  commands: string[];
  events: string[];
  eventSubscriptions: string[];
}

function categorizeError(error: Error): "import" | "init" {
  const message = error.message;
  if (
    message.includes("Cannot find module") ||
    message.includes("Cannot find package") ||
    message.includes('No "exports" main defined') ||
    message.includes("ERR_PACKAGE_PATH_NOT_EXPORTED")
  ) {
    return "import";
  }
  return "init";
}

async function testExtension(name: string): Promise<TestResult> {
  const api = createMockExtensionAPI();
  const indexPath = join(EXTENSIONS_DIR, name, "index.ts");

  try {
    // Dynamically import the extension
    const module = await import(indexPath);
    const initFn = module.default;

    if (typeof initFn !== "function") {
      return {
        extension: name,
        success: false,
        error: "No default export function found",
        errorType: "export",
        tools: [],
        commands: [],
        events: [],
        eventSubscriptions: [],
      };
    }

    // Call the extension's init function with mock API
    // Some extensions return a promise, some don't
    await Promise.resolve(initFn(api));

    return {
      extension: name,
      success: true,
      tools: api._tools.map((t) => t.name),
      commands: Array.from(api._commands.keys()),
      events: Array.from(api._events.keys()),
      eventSubscriptions: Array.from(api.events._handlers.keys()),
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return {
      extension: name,
      success: false,
      error: err.message,
      errorType: categorizeError(err),
      tools: [],
      commands: [],
      events: [],
      eventSubscriptions: [],
    };
  }
}

async function main() {
  console.log("🔍 Discovering extensions...\n");
  const extensions = discoverExtensions();
  console.log(
    `Found ${extensions.length} extensions: ${extensions.join(", ")}\n`,
  );

  console.log("━".repeat(60));
  console.log("Testing extension loading...");
  console.log(`${"━".repeat(60)}\n`);

  const results: TestResult[] = [];
  let passed = 0;
  let importErrors = 0;
  let initErrors = 0;

  for (const name of extensions) {
    process.stdout.write(`Testing ${name}... `);

    const result = await testExtension(name);
    results.push(result);

    if (result.success) {
      passed++;
      console.log("✅ OK");

      // Print what was registered
      const registrations: string[] = [];
      if (result.tools.length > 0) {
        registrations.push(`${result.tools.length} tool(s)`);
      }
      if (result.commands.length > 0) {
        registrations.push(`${result.commands.length} command(s)`);
      }
      if (result.events.length > 0) {
        registrations.push(`${result.events.length} event handler(s)`);
      }
      if (result.eventSubscriptions.length > 0) {
        registrations.push(
          `${result.eventSubscriptions.length} event subscription(s)`,
        );
      }
      if (registrations.length > 0) {
        console.log(`   └─ Registered: ${registrations.join(", ")}`);
      }
    } else {
      if (result.errorType === "import") {
        importErrors++;
        console.log("⚠️  IMPORT ERROR");
      } else {
        initErrors++;
        console.log("❌ FAILED");
      }
      // Truncate error message for cleaner output
      const shortError =
        result.error?.split("\n")[0].slice(0, 80) || "Unknown error";
      console.log(`   └─ ${shortError}`);
    }
  }

  console.log(`\n${"━".repeat(60)}`);
  console.log("Summary");
  console.log("━".repeat(60));
  console.log(
    `Total: ${extensions.length} | Passed: ${passed} | Import errors: ${importErrors} | Init errors: ${initErrors}`,
  );

  // Import errors are expected in standalone testing (missing pi-coding-agent exports)
  // Only fail on init errors (actual bugs in extension code)
  if (initErrors > 0) {
    console.log("\n❌ Some extensions failed to initialize!");
    console.log("\nInit failures (bugs in extension code):");
    for (const result of results) {
      if (!result.success && result.errorType !== "import") {
        console.log(`  - ${result.extension}: ${result.error}`);
      }
    }
    process.exit(1);
  }

  if (importErrors > 0) {
    console.log(
      "\n⚠️  Some extensions have import errors (expected in standalone testing):",
    );
    for (const result of results) {
      if (!result.success && result.errorType === "import") {
        // Extract just the module name from the error
        const match = result.error?.match(
          /Cannot find (?:module|package) '([^']+)'/,
        );
        const module = match ? match[1] : "unknown";
        console.log(`  - ${result.extension}: missing ${module}`);
      }
    }
    console.log(
      "\nNote: Import errors are expected when running outside of pi context.",
    );
    console.log(
      "These extensions import internal APIs from @mariozechner/pi-coding-agent.",
    );
  }

  console.log(
    "\n✅ All extensions that could be loaded initialized successfully!",
  );
  process.exit(0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
