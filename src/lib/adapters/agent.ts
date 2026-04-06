import { AGENT, type AgentEndpoint } from "~/config/business";
import {
  OAIResponseSchema,
  AnthropicResponseSchema,
} from "~/lib/validators/agent";

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
  endpointType: "anthropic";
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

type ParseResponseResult =
  | {
      status: "success";
      response: AgentOutput;
    }
  | {
      status: "failure";
      error: {
        code: string;
        message: string;
      };
    };

export interface AgentAdapter {
  endpoint: AgentEndpoint;
  buildRequest(input: AgentInput): RequestInit;
  parseResponse(raw: unknown): ParseResponseResult;
  authHeaders(key: string): Record<string, string>;
}

export const OAIAdapter: AgentAdapter = {
  endpoint: AGENT.SUPPORTED_ENDPOINTS.OpenAI,
  buildRequest: (input) => ({
    body: JSON.stringify({ model: input.model, messages: input.messages }),
  }),
  parseResponse: (raw) => {
    console.log(raw);

    const parsed = OAIResponseSchema.safeParse(raw);

    if (parsed.error) {
      return {
        status: "failure",
        error: {
          code: "SCHEMA_MISMATCH",
          message: "validation.output.schemaMismatch",
        },
      };
    }

    return {
      status: "success",
      response: {
        endpointType: "oai",
        content: parsed.data.choices[0]!.message.content,
        usage: {
          prompt_tokens: parsed.data.usage.prompt_tokens,
          completion_tokens: parsed.data.usage.completion_tokens,
        },
      },
    };
  },
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
  parseResponse: (raw) => {
    const parsed = AnthropicResponseSchema.safeParse(raw);

    if (parsed.error) {
      return {
        status: "failure",
        error: {
          code: "SCHEMA_MISMATCH",
          message: "validation.output.schemaMismatch",
        },
      };
    }

    return {
      status: "success",
      response: {
        endpointType: "anthropic",
        content: parsed.data.content[0]!.text,
        usage: {
          input_tokens: parsed.data.usage.input_tokens,
          output_tokens: parsed.data.usage.output_tokens,
        },
      },
    };
  },
  authHeaders: (key) => ({
    "x-api-key": key,
    "anthropic-version": "2023-06-01",
  }),
};
