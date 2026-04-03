import { AGENT, type AgentEndpoint } from "~/config/business";

type EndpointType = "oai" | "anthropic";

export interface OAIInput {
  endpoint: string;
  model: string;
  messages: {
    role: "system" | "user" | "assistant";
    content: string;
  }[];
  max_tokens?: number;
  temperature?: number;
  response_format?: {
    type: "text" | "json_object" | "json_schema";
    json_schema?: {
      name: string;
      schema: object;
      strict?: boolean;
    };
  };
  stream?: boolean;
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
}

export interface AnthropicInput {
  endpoint: string;
  model: string;
  system?: string;
  messages: {
    role: "user" | "assistant";
    content: string;
  }[];
  max_tokens: number;
  temperature?: number;
  stream?: boolean;
  stop_sequences?: string[];
  top_p?: number;
  top_k?: number;
}

interface OAIOutput {
  endpointType: "oai";
  content: string;
  usage: { prompt_tokens: number; completion_tokens: number };
}

interface AnthropicOutput {
  endPointType: "anthropic";
  content: string;
  usage: { input_tokens: number; output_tokens: number };
}

export type AgentInput<T extends EndpointType = EndpointType> = T extends "oai"
  ? OAIInput
  : T extends "anthropic"
    ? AnthropicInput
    : never;

export type AgentOutput<T extends EndpointType = EndpointType> = T extends "oai"
  ? OAIOutput
  : T extends "anthropic"
    ? AnthropicOutput
    : never;

export interface AgentAdapter {
  endpoint: AgentEndpoint;
  buildRequest(input: AgentInput): RequestInit;
  parseResponse(raw: unknown): AgentOutput;
  authHeaders(key: string): Record<string, string>;
}

export const OAIAdapter: AgentAdapter = {
  endpoint: AGENT.SUPPORTED_ENDPOINTS.OpenAI,
  buildRequest: (input) => ({
    body: JSON.stringify({ model: input.model, messages: input.messages }),
  }),
  parseResponse: (raw) => OAIResponseSchema.parse(raw),
  authHeaders: (key) => ({ Authorization: `Bearer ${key}` }),
};

export const AnthropicAdapter: AgentAdapter = {
  endpoint: AGENT.SUPPORTED_ENDPOINTS.Anthropic,
  buildRequest: (input) => ({
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      max_tokens: input.max_tokens,
    }),
  }),
  parseResponse: (raw) => AnthropicResponseSchema.parse(raw),
  authHeaders: (key) => ({
    "x-api-key": key,
    "anthropic-version": "2023-06-01",
  }),
};
