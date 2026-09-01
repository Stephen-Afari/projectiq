import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config.js';
import type { LlmClient, StructuredCompletionRequest, StructuredCompletionResult } from './types.js';

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

/**
 * Forces structured output via Anthropic tool-use: the model must call a
 * single tool whose input_schema is our JSON Schema, so the response is
 * schema-shaped JSON rather than free text we'd have to parse ourselves.
 */
export const anthropicClient: LlmClient = {
  async generateStructured(req: StructuredCompletionRequest): Promise<StructuredCompletionResult> {
    const message = await anthropic.messages.create({
      model: config.anthropicModel,
      max_tokens: req.maxTokens ?? 4096,
      system: req.system,
      messages: [{ role: 'user', content: req.user }],
      tools: [
        {
          name: req.toolName,
          description: req.toolDescription,
          input_schema: req.jsonSchema as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: 'tool', name: req.toolName },
    });

    const toolUse = message.content.find((block) => block.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error('[llm] Anthropic response did not include a tool_use block');
    }

    return { raw: toolUse.input, model: message.model };
  },
};
