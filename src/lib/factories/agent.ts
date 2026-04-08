import { AGENT } from "~/config/business";
import type { AgentEndpoint, AgentProvider } from "~/config/business";
import {
  AnthropicAdapter,
  OAIAdapter,
  // OpenRouterAdapter,
  type AgentAdapter,
  type AgentInput,
} from "../adapters/agent";

export function AgentAdapterFactory(
  provider: AgentProvider,
  apiKey: string,
  model: string,
): AgentAdapter {
  let adapter: AgentAdapter;

  switch (provider) {
    case AGENT.PROVIDERS.OpenAI:
      adapter = OAIAdapter;
      break;
    // case AGENT.PROVIDERS.OpenRouter:
    //   adapter = OpenRouterAdapter;
    //   break;
    case AGENT.PROVIDERS.Anthropic:
      adapter = AnthropicAdapter;
      break;
    default:
      const _exhaustive: never = provider;
      throw new Error(`Unhandled provider: ${provider}`);
  }

  adapter.apiKey = apiKey;
  adapter.model = model;
  return adapter;
}

export function AgentInputFactory(
  adapter: AgentAdapter,
  prompt: string,
  systemPrompt: string,
  // responseSchema?: string,
): AgentInput {
  // TODO: add responseSchema param if completion output schema coherence not reliable enough
  // (needs control flow for new OAI models -> Structured Outputs, old OAI Models -> JSON Mode,  non OAI but OAI request schema -> no response_format)

  const { endpoint, model } = adapter;
  switch (endpoint) {
    case AGENT.ENDPOINTS.OpenAI:
      // case AGENT.ENDPOINTS.OpenRouter:
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
    case AGENT.ENDPOINTS.Anthropic:
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
