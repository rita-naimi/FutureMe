export type AnthropicChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_VERSION = '2023-06-01';

export class AnthropicChatError extends Error {
  status?: number;
  details?: string;

  constructor(message: string, status?: number, details?: string) {
    super(message);
    this.name = 'AnthropicChatError';
    this.status = status;
    this.details = details;
  }
}

export function getAnthropicApiKey() {
  return process.env.ANTHROPIC_API_KEY;
}

export function getConfiguredAnthropicModel(...envKeys: string[]) {
  for (const key of envKeys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return DEFAULT_ANTHROPIC_MODEL;
}

export function getPositiveNumberFromEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function fetchAnthropicMessage(params: {
  model: string;
  system: string;
  messages: AnthropicChatMessage[];
  maxTokens: number;
  temperature: number;
  stream: boolean;
}) {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    throw new AnthropicChatError('Missing ANTHROPIC_API_KEY');
  }

  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.maxTokens,
      system: params.system,
      messages: params.messages,
      temperature: params.temperature,
      stream: params.stream
    })
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new AnthropicChatError(`Anthropic request failed (${response.status})`, response.status, details.slice(0, 500));
  }

  return response;
}

export async function generateAnthropicText(params: {
  model: string;
  system: string;
  messages: AnthropicChatMessage[];
  maxTokens: number;
  temperature: number;
}) {
  const response = await fetchAnthropicMessage({
    ...params,
    stream: false
  });

  const data = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };

  const text = data.content
    ?.filter((block) => block.type === 'text' && block.text)
    .map((block) => block.text)
    .join('')
    .trim();

  if (text) return text;

  throw new AnthropicChatError('No text content returned by Anthropic');
}
