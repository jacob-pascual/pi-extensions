/**
 * Context generator for handoff.
 *
 * Uses an LLM to distill the current conversation into a focused,
 * self-contained prompt for a new session.
 */

import type { Message } from "@mariozechner/pi-ai";
import { complete } from "@mariozechner/pi-ai";
import type { ExtensionCommandContext, SessionEntry } from "@mariozechner/pi-coding-agent";
import { convertToLlm, serializeConversation } from "@mariozechner/pi-coding-agent";

const SYSTEM_PROMPT = `You are a context transfer assistant. Given a conversation history and the user's goal for a new thread, generate a focused prompt that:

1. Summarizes relevant context from the conversation (decisions made, approaches taken, key findings)
2. Lists any relevant files that were discussed or modified
3. Clearly states the next task based on the user's goal
4. Is self-contained - the new thread should be able to proceed without the old conversation

Format your response as a prompt the user can send to start the new thread. Be concise but include all necessary context. Do not include any preamble like "Here's the prompt" - just output the prompt itself.

Example output format:
## Context
We've been working on X. Key decisions:
- Decision 1
- Decision 2

Files involved:
- path/to/file1.ts
- path/to/file2.ts

## Task
[Clear description of what to do next based on user's goal]`;

/**
 * Extract text content from an LLM response.
 */
function extractText(
  content: Array<{ type: string; text?: string }>,
): string {
  return content
    .filter((c): c is { type: "text"; text: string } => c.type === "text")
    .map((c) => c.text)
    .join("\n");
}

/**
 * Generate a handoff prompt from the current session and a goal.
 *
 * Serializes the conversation, sends it to the model with the goal,
 * and returns the generated context prompt.
 */
export async function generateHandoffPrompt(
  ctx: ExtensionCommandContext,
  goal: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const branch = ctx.sessionManager.getBranch();
  const messages = branch
    .filter(
      (entry): entry is SessionEntry & { type: "message" } =>
        entry.type === "message",
    )
    .map((entry) => entry.message);

  if (messages.length === 0) {
    return null;
  }

  const llmMessages = convertToLlm(messages);
  const conversationText = serializeConversation(llmMessages);

  const apiKey = await ctx.modelRegistry.getApiKey(ctx.model!);

  const userMessage: Message = {
    role: "user",
    content: [
      {
        type: "text",
        text: `## Conversation History\n\n${conversationText}\n\n## User's Goal for New Thread\n\n${goal}`,
      },
    ],
    timestamp: Date.now(),
  };

  const response = await complete(
    ctx.model!,
    { systemPrompt: SYSTEM_PROMPT, messages: [userMessage] },
    { apiKey, signal },
  );

  if (response.stopReason === "aborted") {
    return null;
  }

  return extractText(response.content);
}

/**
 * Build the final prompt that gets sent in the new session.
 *
 * Prepends the goal (for easy identification in session lists),
 * includes the parent session reference, and appends the generated context.
 */
export function buildFinalPrompt(
  goal: string,
  generatedContext: string,
  parentSessionFile: string | null,
): string {
  if (parentSessionFile) {
    return `${goal}\n\n**Parent session:** \`${parentSessionFile}\`\n\n${generatedContext}`;
  }
  return `${goal}\n\n${generatedContext}`;
}
