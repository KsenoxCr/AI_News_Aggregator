import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
// import { OpenRouter } from "@openrouter/sdk";
import { AGENT, type AgentEndpoint } from "~/config/business";

type EndpointType = "oai" | "anthropic";

export interface OAIInput {
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
  usage?: { prompt_tokens: number; completion_tokens: number };
}

interface AnthropicOutput {
  endpointType: "anthropic";
  content: string;
  usage?: { input_tokens: number; output_tokens: number };
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

export type ParseResponseResult =
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

type ValidateAPIKeyResult =
  | { status: "success"; models: string[] }
  | { status: "failure"; error: { code: string; message: string } };

export interface AgentAdapter {
  endpoint: AgentEndpoint;
  sendRequest(input: AgentInput, apiKey: string): Promise<ParseResponseResult>;
  validateAPIKey(apiKey: string): Promise<ValidateAPIKeyResult>;
}

export const OAIAdapter: AgentAdapter = {
  endpoint: AGENT.ENDPOINTS.OpenAI,
  // TODO: response format coercion

  validateAPIKey: async (apiKey) => {
    try {
      const client = new OpenAI({ apiKey });
      const page = await client.models.list();
      return { status: "success", models: page.data.map((m) => m.id) };
    } catch {
      return {
        status: "failure",
        error: { code: "UNAUTHORIZED", message: "errors.api.invalidApiKey" },
      };
    }
  },
  sendRequest: async (input, apiKey) => {
    const client = new OpenAI({ apiKey });
    const i = input as OAIInput;
    const res = await client.chat.completions.create({
      model: i.model,
      messages: i.messages,
    });
    const content = res.choices[0]?.message.content;
    if (!content) {
      return {
        status: "failure",
        error: {
          code: "EMPTY_RESPONSE",
          message: "validation.agent.content.emptyResponse",
        },
      };
    }
    return {
      status: "success",
      response: { endpointType: "oai", content },
    };
  },
};

// export const OpenRouterAdapter: AgentAdapter = {
//   endpoint: AGENT.SUPPORTED_ENDPOINTS.OpenRouter,
//   sendRequest: async (input, apiKey) => {
//     const client = new OpenRouter({ apiKey });
//     const i = input as OAIInput;
//     const res = await client.chat.send({
//       chatRequest: {
//         model: i.model,
//         messages: i.messages as any,
//         stream: false,
//       },
//     });
//     const content = res.choices[0]?.message.content;
//     if (typeof content !== "string" || !content) {
//       return {
//         status: "failure",
//         error: {
//           code: "EMPTY_RESPONSE",
//           message: "validation.agent.content.emptyResponse",
//         },
//       };
//     }
//     return {
//       status: "success",
//       response: { endpointType: "oai", content },
//     };
//   },
// };

export const AnthropicAdapter: AgentAdapter = {
  endpoint: AGENT.ENDPOINTS.Anthropic,
  validateAPIKey: async (apiKey) => {
    try {
      const client = new Anthropic({ apiKey });
      const page = await client.models.list();
      return { status: "success", models: page.data.map((m) => m.id) };
    } catch {
      return {
        status: "failure",
        error: { code: "UNAUTHORIZED", message: "errors.api.invalidApiKey" },
      };
    }
  },
  sendRequest: async (input, apiKey) => {
    const client = new Anthropic({ apiKey });
    const i = input as AnthropicInput;
    const res = await client.messages.create({
      model: i.model,
      messages: i.messages,
      max_tokens: i.max_tokens,
      ...(i.system && { system: i.system }),
    });
    const block = res.content[0];
    if (!block || block.type !== "text") {
      return {
        status: "failure",
        error: {
          code: "EMPTY_RESPONSE",
          message: "validation.agent.content.emptyResponse",
        },
      };
    }
    return {
      status: "success",
      response: {
        endpointType: "anthropic",
        content: block.text,
        usage: {
          input_tokens: res.usage.input_tokens,
          output_tokens: res.usage.output_tokens,
        },
      },
    };
  },
};
