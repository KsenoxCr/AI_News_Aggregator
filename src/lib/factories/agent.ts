import { AGENT } from "~/config/business";
import type { AgentEndpoint } from "~/config/business";
import {
  AnthropicAdapter,
  OAIAdapter,
  OpenRouterAdapter,
  type AgentAdapter,
  type AgentInput,
} from "../adapters/agent";

export function AgentAdapterFactory(endpoint: AgentEndpoint): AgentAdapter {
  switch (endpoint) {
    case AGENT.SUPPORTED_ENDPOINTS.OpenAI:
      return OAIAdapter;
    case AGENT.SUPPORTED_ENDPOINTS.OpenRouter:
      return OpenRouterAdapter;
    case AGENT.SUPPORTED_ENDPOINTS.Anthropic:
      return AnthropicAdapter;
    default:
      const _exhaustive: never = endpoint;
      throw new Error(`Unhandled endpoint: ${endpoint}`);
  }
}

export function AgentInputFactory(
  endpoint: AgentEndpoint,
  model: string,
  prompt: string,
  systemPrompt: string,
  // responseSchema?: string,
): AgentInput {
  // TODO: add responseSchema param if completion output schema coherence not reliable enough
  // (needs control flow for new OAI models -> Structured Outputs, old OAI Models -> JSON Mode,  non OAI but OAI request schema -> no response_format)

  switch (endpoint) {
    case AGENT.SUPPORTED_ENDPOINTS.OpenAI:
    case AGENT.SUPPORTED_ENDPOINTS.OpenRouter:
      return {
        endpoint,
        model,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        // response_format: responseSchema
        //   ? {
        //       type: "json_schema",
        //     }
        //   : undefined,
      };
    case AGENT.SUPPORTED_ENDPOINTS.Anthropic:
      return {
        endpoint,
        model,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 1024, // TODO: Fine-tune
      };
    default:
      const _exhaustive: never = endpoint;
      throw new Error(`Unhandled case: ${endpoint}`);
  }
}
