import type {
  AgentToolResult,
  ExtensionAPI,
  ExtensionContext,
  Theme,
  ToolRenderResultOptions,
} from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";

const GenerateParams = Type.Object({
  template: StringEnum([
    "basic",
    "with-callbacks",
    "custom-handler",
    "types",
  ] as const),
});

type GenerateParamsType = {
  template: "basic" | "with-callbacks" | "custom-handler" | "types";
};

interface GenerateDetails {
  template: string;
  code: string;
}

type ExecuteResult = AgentToolResult<GenerateDetails>;

const TEMPLATES: Record<string, string> = {
  basic: `import { Agentation } from "agentation";

function App() {
  return (
    <>
      <YourApp />
      <Agentation />
    </>
  );
}

export default App;`,

  "with-callbacks": `import { Agentation, type Annotation } from "agentation";

function App() {
  const handleAnnotationAdd = (annotation: Annotation) => {
    console.log("Added:", annotation.element, annotation.comment);
    // Send to your backend, analytics, etc.
  };

  const handleAnnotationUpdate = (annotation: Annotation) => {
    console.log("Updated:", annotation.id, annotation.comment);
  };

  const handleAnnotationDelete = (annotation: Annotation) => {
    console.log("Deleted:", annotation.id);
  };

  const handleAnnotationsClear = (annotations: Annotation[]) => {
    console.log("Cleared:", annotations.length, "annotations");
  };

  const handleCopy = (markdown: string) => {
    console.log("Copied markdown:", markdown);
    // Custom clipboard handling
  };

  return (
    <>
      <YourApp />
      <Agentation
        onAnnotationAdd={handleAnnotationAdd}
        onAnnotationUpdate={handleAnnotationUpdate}
        onAnnotationDelete={handleAnnotationDelete}
        onAnnotationsClear={handleAnnotationsClear}
        onCopy={handleCopy}
        copyToClipboard={false}
      />
    </>
  );
}

export default App;`,

  "custom-handler": `import { Agentation, type Annotation } from "agentation";
import { useState, useCallback } from "react";

interface AnnotationStore {
  annotations: Annotation[];
  add: (annotation: Annotation) => void;
  update: (annotation: Annotation) => void;
  remove: (annotation: Annotation) => void;
  clear: () => void;
}

function useAnnotationStore(): AnnotationStore {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  const add = useCallback((annotation: Annotation) => {
    setAnnotations((prev) => [...prev, annotation]);
  }, []);

  const update = useCallback((annotation: Annotation) => {
    setAnnotations((prev) =>
      prev.map((a) => (a.id === annotation.id ? annotation : a))
    );
  }, []);

  const remove = useCallback((annotation: Annotation) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== annotation.id));
  }, []);

  const clear = useCallback(() => {
    setAnnotations([]);
  }, []);

  return { annotations, add, update, remove, clear };
}

function App() {
  const store = useAnnotationStore();

  return (
    <>
      <YourApp />
      <AnnotationSidebar annotations={store.annotations} />
      <Agentation
        onAnnotationAdd={store.add}
        onAnnotationUpdate={store.update}
        onAnnotationDelete={store.remove}
        onAnnotationsClear={store.clear}
      />
    </>
  );
}

function AnnotationSidebar({ annotations }: { annotations: Annotation[] }) {
  return (
    <aside>
      <h2>Annotations ({annotations.length})</h2>
      <ul>
        {annotations.map((a) => (
          <li key={a.id}>
            <strong>{a.element}</strong>: {a.comment}
          </li>
        ))}
      </ul>
    </aside>
  );
}

export default App;`,

  types: `/**
 * Agentation Type Definitions
 *
 * Core types for working with the Agentation annotation library.
 */

export interface Annotation {
  /** Unique identifier for the annotation */
  id: string;

  /** Human-readable element name */
  element: string;

  /** CSS selector path to the element */
  elementPath: string;

  /** User's annotation comment text */
  comment: string;

  /** Unix timestamp when annotation was created */
  timestamp: number;

  /** Viewport X position */
  x: number;

  /** Viewport Y position */
  y: number;

  /** Text selected by user (optional) */
  selectedText?: string;

  /** Element bounding box dimensions (optional) */
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  // Additional fields available in Detailed/Forensic modes:
  nearbyText?: string;
  cssClasses?: string[];
  nearbyElements?: string[];
  computedStyles?: Record<string, string>;
  fullPath?: string;
  accessibility?: {
    role?: string;
    label?: string;
    description?: string;
  };
  isMultiSelect?: boolean;
  isFixed?: boolean;
}

export interface AgentationProps {
  /** Called when an annotation is created */
  onAnnotationAdd?: (annotation: Annotation) => void;

  /** Called when an annotation is removed */
  onAnnotationDelete?: (annotation: Annotation) => void;

  /** Called when annotation comments are edited */
  onAnnotationUpdate?: (annotation: Annotation) => void;

  /** Called when all annotations are cleared */
  onAnnotationsClear?: (annotations: Annotation[]) => void;

  /** Called when copy is clicked, receives markdown string */
  onCopy?: (markdown: string) => void;

  /**
   * Set to false to disable automatic clipboard writing
   * and handle via onCopy callback instead
   * @default true
   */
  copyToClipboard?: boolean;
}`,
};

export function setupGenerateTool(pi: ExtensionAPI) {
  pi.registerTool<typeof GenerateParams, GenerateDetails>({
    name: "agentation_generate",
    label: "Agentation Generate",
    description: `Generate Agentation integration code for React applications.

Agentation is a library for adding UI annotations to React apps. It provides callbacks for annotation events (add, update, delete, clear, copy).

Available templates:
- basic: Minimal setup with just the Agentation component
- with-callbacks: Full setup with all callback handlers
- custom-handler: Advanced setup with state management and sidebar
- types: TypeScript type definitions for Annotation and AgentationProps`,

    parameters: GenerateParams,

    async execute(
      _toolCallId: string,
      params: GenerateParamsType,
      _onUpdate: unknown,
      _ctx: ExtensionContext,
      _signal?: AbortSignal,
    ): Promise<ExecuteResult> {
      const code = TEMPLATES[params.template];

      if (!code) {
        return {
          content: [
            {
              type: "text",
              text: `Unknown template: ${params.template}. Available: basic, with-callbacks, custom-handler, types`,
            },
          ],
          details: {
            template: params.template,
            code: "",
          },
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Generated ${params.template} template:\n\n\`\`\`typescript\n${code}\n\`\`\``,
          },
        ],
        details: {
          template: params.template,
          code,
        },
      };
    },

    renderCall(args: GenerateParamsType, theme: Theme): Text {
      return new Text(
        theme.fg(
          "toolTitle",
          `${theme.bold("agentation_generate")} ${theme.fg("muted", args.template)}`,
        ),
        0,
        0,
      );
    },

    renderResult(
      result: AgentToolResult<GenerateDetails>,
      _options: ToolRenderResultOptions,
      theme: Theme,
    ): Text {
      const { details } = result;

      if (!details || !details.code) {
        return new Text(theme.fg("error", "Failed to generate template"), 0, 0);
      }

      const lines: string[] = [];
      lines.push(
        theme.fg("success", `Generated ${details.template} template`),
      );
      lines.push("");
      lines.push(theme.fg("muted", `${details.code.split("\n").length} lines`));

      return new Text(lines.join("\n"), 0, 0);
    },
  });
}
