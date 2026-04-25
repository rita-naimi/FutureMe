import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/chat/route';

function buildRequest(body: unknown) {
  return new NextRequest('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function readClientSseText(response: Response) {
  const raw = await response.text();
  return raw
    .split('\n\n')
    .map((event) => event.split('\n').find((line) => line.startsWith('data: ')))
    .filter(Boolean)
    .map((line) => line?.slice(6) ?? '')
    .filter((data) => data && data !== '[DONE]')
    .map((data) => (JSON.parse(data) as { text: string }).text)
    .join('');
}

const SYSTEM_PROMPT = `You are Tahri, speaking from 10 years in the future. You are now 35 years old.

Exact facts for factual questions:
- Name: Tahri
- Present age: 25
- Future age: 35
- Sleep: 7 hours per night
- Exercise: 3 days per week
- Cardiovascular risk: 18/100
- Metabolic risk: 22/100`;

describe('POST /api/chat', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.HUGGINGFACE_API_KEY;
    delete process.env.HF_TOKEN;
    delete process.env.HF_MODEL;
    delete process.env.HF_CHAT_MODEL;
    delete process.env.HF_CHAT_MAX_TOKENS;
  });

  it('streams an open-source Hugging Face response to the client SSE format', async () => {
    process.env.HUGGINGFACE_API_KEY = 'test-token';
    process.env.HF_CHAT_MODEL = 'test/open-source-model';
    process.env.HF_CHAT_MAX_TOKENS = '1200';

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        model: string;
        max_tokens: number;
        stream: boolean;
        messages: Array<{ role: string; content: string }>;
      };

      expect(body.model).toBe('test/open-source-model');
      expect(body.max_tokens).toBe(1200);
      expect(body.stream).toBe(true);
      expect(body.messages[0]).toEqual({ role: 'system', content: SYSTEM_PROMPT });

      return new Response(
        [
          'data: {"choices":[{"delta":{"content":"Bonjour "}}]}',
          '',
          'data: {"choices":[{"delta":{"content":"Tahri"}}]}',
          '',
          'data: [DONE]',
          ''
        ].join('\n'),
        { status: 200 }
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(
      buildRequest({
        systemPrompt: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: 'Bonjour' }]
      })
    );

    expect(response.headers.get('X-FutureMe-LLM-Provider')).toBe('huggingface');
    expect(response.headers.get('X-FutureMe-LLM-Model')).toBe('test/open-source-model');
    await expect(readClientSseText(response)).resolves.toBe('Bonjour Tahri');
  });

  it('makes fallback mode explicit and answers simple factual questions', async () => {
    const response = await POST(
      buildRequest({
        systemPrompt: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: 'Quel age ai-je ?' }]
      })
    );

    const text = await readClientSseText(response);

    expect(response.headers.get('X-FutureMe-LLM-Provider')).toBe('fallback');
    expect(text).toContain('Mode degrade');
    expect(text).toContain('25 ans');
    expect(text).toContain('35');
  });
});
