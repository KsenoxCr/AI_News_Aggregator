import assert from "assert";
import { AGENT, type AgentEndpoint } from "~/config/business";
import { OAIAdapter, type AgentAdapter } from "~/lib/adapters/agent";

export async function TestOAIAPI(url: string, apiKey: string) {
  const res = await fetch(`${url}/openai/v1/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  let errorMessage = null;

  if (!res.ok) {
    const error = await res.json();
    errorMessage = error.error?.message ?? `HTTP ${res.status}`;
  }

  return {
    status: res.status,
    error: errorMessage,
  };
}

export function IsDuplicateEntry(err: unknown, key?: string): boolean {
  return (
    err instanceof Error &&
    "code" in err &&
    err.code === "ER_DUP_ENTRY" &&
    (key ? err.message.includes(key) : true)
  );
}

export function isOAIAdapter(
  adapter: AgentAdapter,
): adapter is typeof OAIAdapter {
  return adapter.endpoint === AGENT.SUPPORTED_ENDPOINTS.OpenAI;
}

export function ExtractEndpoint(url: string) {
  const endpointMatch = url.match(/(?<=https?:\/\/.*\/).*/);
  assert(
    endpointMatch !== null,
    `[generateFeed] could not extract endpoint path from URL: "${url}"`,
  );

  return endpointMatch![0] as AgentEndpoint;
}
