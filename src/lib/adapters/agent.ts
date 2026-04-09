import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
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

export interface RateLimits {
  RPI: number;
  TPI: number;
  requestsRemaining: number;
  tokensRemaining: number;
  RR: number;
  TR: number;
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

// TODO: Update AgentAdapter so satisfies not required (fixed the errors)

export interface AgentAdapter {
  endpoint: AgentEndpoint;
  _model: string;
  _apiKey: string;
  get model(): string;
  get apiKey(): string;
  rateLimits: RateLimits | null;
  configure(apiKey: string, model: string): Promise<ValidateAPIKeyResult>;
  sendRequest(input: AgentInput): Promise<ParseResponseResult>;
}

function ParseOAIInterval(s: string): number {
  const h = s.match(/(\d+)h/);
  const m = s.match(/(\d+)m(?!s)/);
  const sec = s.match(/(\d+)s/);
  const ms = s.match(/(\d+)ms/);
  return (
    (h ? parseInt(h[1]!) * 3_600_000 : 0) +
    (m ? parseInt(m[1]!) * 60_000 : 0) +
    (sec ? parseInt(sec[1]!) * 1_000 : 0) +
    (ms ? parseInt(ms[1]!) : 0)
  );
}

function ParseAnthropicReset(s: string | null): number {
  return s ? Math.max(0, new Date(s).getTime() - Date.now()) : 0;
}

export const OAIAdapter: AgentAdapter = {
  endpoint: AGENT.ENDPOINTS.OpenAI as AgentEndpoint,
  _model: "",
  _apiKey: "",
  get model() {
    return this._model;
  },
  get apiKey() {
    return this._apiKey;
  },
  rateLimits: null as RateLimits | null,
  // TODO: response format coercion

  async configure(
    apiKey: string,
    model: string,
  ): Promise<ValidateAPIKeyResult> {
    try {
      const client = new OpenAI({ apiKey });
      const page = await client.models.list();
      this._apiKey = apiKey;
      this._model = model;
      return { status: "success", models: page.data.map((m) => m.id) };
    } catch {
      return {
        status: "failure",
        error: { code: "UNAUTHORIZED", message: "errors.api.invalidApiKey" },
      };
    }
  },
  async sendRequest(input: AgentInput): Promise<ParseResponseResult> {
    const client = new OpenAI({ apiKey: this.apiKey });
    const i = input as OAIInput;
    const { data: res, response } = await client.chat.completions
      .create({ model: i.model, messages: i.messages })
      .withResponse();
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
    this.rateLimits = {
      RPI: parseInt(response.headers.get("x-ratelimit-limit-requests") ?? "0"),
      TPI: parseInt(response.headers.get("x-ratelimit-limit-tokens") ?? "0"),
      requestsRemaining: parseInt(
        response.headers.get("x-ratelimit-remaining-requests") ?? "0",
      ),
      tokensRemaining: parseInt(
        response.headers.get("x-ratelimit-remaining-tokens") ?? "0",
      ),
      RR: ParseOAIInterval(
        response.headers.get("x-ratelimit-reset-requests") ?? "0s",
      ),
      TR: ParseOAIInterval(
        response.headers.get("x-ratelimit-reset-tokens") ?? "0s",
      ),
    };
    return {
      status: "success",
      response: { endpointType: "oai", content },
    };
  },
};

export const AnthropicAdapter: AgentAdapter = {
  endpoint: AGENT.ENDPOINTS.Anthropic as AgentEndpoint,
  _model: "",
  _apiKey: "",
  get model() {
    return this._model;
  },
  get apiKey() {
    return this._apiKey;
  },
  rateLimits: null as RateLimits | null,

  async configure(
    apiKey: string,
    model: string,
  ): Promise<ValidateAPIKeyResult> {
    try {
      const client = new Anthropic({ apiKey });
      const page = await client.models.list();
      this._apiKey = apiKey;
      this._model = model;
      return { status: "success", models: page.data.map((m) => m.id) };
    } catch {
      return {
        status: "failure",
        error: { code: "UNAUTHORIZED", message: "errors.api.invalidApiKey" },
      };
    }
  },
  async sendRequest(input: AgentInput): Promise<ParseResponseResult> {
    const safetyBuffer = 50; // ms

    const client = new Anthropic({ apiKey: this.apiKey });
    const i = input as AnthropicInput;
    const { data: res, response } = await client.messages
      .create({
        model: i.model,
        messages: i.messages,
        max_tokens: i.max_tokens,
        ...(i.system && { system: i.system }),
      })
      .withResponse();
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
    this.rateLimits = {
      RPI: parseInt(
        response.headers.get("anthropic-ratelimit-requests-limit") ?? "0",
      ),
      TPI: parseInt(
        response.headers.get("anthropic-ratelimit-tokens-limit") ?? "0",
      ),
      requestsRemaining: parseInt(
        response.headers.get("anthropic-ratelimit-requests-remaining") ?? "0",
      ),
      tokensRemaining: parseInt(
        response.headers.get("anthropic-ratelimit-tokens-remaining") ?? "0",
      ),
      RR:
        ParseAnthropicReset(
          response.headers.get("anthropic-ratelimit-requests-reset"),
        ) + safetyBuffer,
      TR:
        ParseAnthropicReset(
          response.headers.get("anthropic-ratelimit-tokens-reset"),
        ) + safetyBuffer,
    };
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
