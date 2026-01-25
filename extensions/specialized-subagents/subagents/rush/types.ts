/**
 * Rush subagent types.
 */

import type { SubagentToolCall, SubagentUsage } from "../../lib/types";

/** Input parameters for the rush subagent */
export interface RushInput {
  /** The task to complete - should be small and well-defined */
  task: string;

  /** Optional file paths to focus on for optimal results */
  files?: string[];

  /** Optional skill names for specialized context */
  skills?: string[];
}

/** Details structure for rush tool rendering */
export interface RushDetails {
  /** Task input */
  task: string;

  /** Files to focus on (if provided) */
  files?: string[];

  /** Tool calls made by the subagent */
  toolCalls: SubagentToolCall[];

  /** Current spinner frame for animation */
  spinnerFrame: number;

  /** The rush response (for final result) */
  response?: string;

  /** Whether the request was aborted */
  aborted?: boolean;

  /** Error message if failed */
  error?: string;

  /** Usage stats from the subagent */
  usage?: SubagentUsage;

  /** Resolved model used for this run (provider + model id) */
  resolvedModel?: { provider: string; id: string };

  /** Whether model family detection was "unknown" (default provider fallback ordering used) */
  familyUnknown?: boolean;

  /** Requested skill names (from input) */
  skills?: string[];

  /** Number of skills successfully resolved */
  skillsResolved?: number;

  /** Skill names that were not found */
  skillsNotFound?: string[];
}
