import { AGENT } from "~/config/business";
import type { AgentProvider } from "~/config/business";
import {
  AnthropicAdapter,
  OAIAdapter,
  type AgentAdapter,
  type AgentInput,
} from "../adapters/agent";

export async function AgentAdapterFactory(
  provider: AgentProvider,
  apiKey: string,
  model = "",
): Promise<
  | { status: "success"; models: string[]; adapter: AgentAdapter }
  | {
      status: "failure";
      error: { code: string; message: string };
      adapter: AgentAdapter;
    }
> {
  let adapter: AgentAdapter;
  switch (provider) {
    case "OpenAI":
      adapter = OAIAdapter;
      break;
    case "Anthropic":
      adapter = AnthropicAdapter;
      break;
    default:
      throw new Error(`Unhandled provider: ${provider}`);
  }
  const result = await adapter.configure(apiKey, model);
  return { ...result, adapter };
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
    case AGENT.OpenAI.endpoint:
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
      };
    case AGENT.Anthropic.endpoint:
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
      throw new Error(`Unhandled case: ${endpoint}`);
  }
}
