export type HuggingFaceChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export const HUGGINGFACE_CHAT_COMPLETIONS_URL = 'https://router.huggingface.co/v1/chat/completions';
export const DEFAULT_OPEN_SOURCE_MODEL = 'openai/gpt-oss-120b:fastest';

export class HuggingFaceChatError extends Error {
  status?: number;
  details?: string;

  constructor(message: string, status?: number, details?: string) {
    super(message);
    this.name = 'HuggingFaceChatError';
    this.status = status;
    this.details = details;
  }
}

export function getHuggingFaceApiKey() {
  return process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN;
}

export function getConfiguredHuggingFaceModel(...envKeys: string[]) {
  for (const key of envKeys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return DEFAULT_OPEN_SOURCE_MODEL;
}

export function getPositiveNumberFromEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function fetchHuggingFaceChatCompletion(params: {
  model: string;
  messages: HuggingFaceChatMessage[];
  maxTokens: number;
  temperature: number;
  stream: boolean;
}) {
  const token = getHuggingFaceApiKey();
  if (!token) {
    throw new HuggingFaceChatError('Missing HUGGINGFACE_API_KEY or HF_TOKEN');
  }

  const response = await fetch(HUGGINGFACE_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      max_tokens: params.maxTokens,
      temperature: params.temperature,
      stream: params.stream
    })
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new HuggingFaceChatError(
      `Hugging Face request failed (${response.status})`,
      response.status,
      details.slice(0, 500)
    );
  }

  return response;
}

export async function generateHuggingFaceChatText(params: {
  model: string;
  messages: HuggingFaceChatMessage[];
  maxTokens: number;
  temperature: number;
}) {
  const response = await fetchHuggingFaceChatCompletion({
    ...params,
    stream: false
  });

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const text = data.choices?.[0]?.message?.content?.trim();
  if (text) return text;

  throw new HuggingFaceChatError('No content returned by Hugging Face model');
}
