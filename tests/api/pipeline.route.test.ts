import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/pipeline/route';
import { JAMES_PERSONA } from '@/data/synthea/james';
import { resetPubMedCacheForTests } from '@/lib/backend/pubmed';

function buildRequest(body: unknown) {
  return new NextRequest('http://localhost/api/pipeline', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

function mockPubMedAndHf() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes('esearch.fcgi')) {
      return new Response(
        JSON.stringify({
          esearchresult: { idlist: ['12345'] }
        }),
        { status: 200 }
      );
    }

    if (url.includes('esummary.fcgi')) {
      return new Response(
        JSON.stringify({
          result: {
            uids: ['12345'],
            '12345': {
              uid: '12345',
              title: 'Primary prevention in cardiometabolic risk',
              fulljournalname: 'Journal of Preventive Medicine',
              pubdate: '2024 Jan'
            }
          }
        }),
        { status: 200 }
      );
    }

    if (url.includes('efetch.fcgi')) {
      return new Response(
        '<Abstract><AbstractText>Structured prevention and smoking cessation reduce major adverse events.</AbstractText></Abstract>',
        { status: 200 }
      );
    }

    if (url.includes('router.huggingface.co/v1/chat/completions')) {
      return new Response(
        JSON.stringify({
          choices: [{ message: { role: 'assistant', content: 'Synthese clinique testee.' } }]
        }),
        { status: 200 }
      );
    }

    return new Response('{}', { status: 404 });
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('POST /api/pipeline', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetPubMedCacheForTests();
    process.env.HUGGINGFACE_API_KEY = 'test-token';
    process.env.PUBMED_CACHE_TTL_HOURS = '24';
  });

  it('returns 400 on invalid payload', async () => {
    const response = await POST(buildRequest({ wrong: true }));
    expect(response.status).toBe(400);
  });

  it('returns pipeline data with mocked PubMed and HuggingFace', async () => {
    const fetchMock = mockPubMedAndHf();

    const response = await POST(
      buildRequest({
        inputs: JAMES_PERSONA,
        includePubMed: true,
        pubMedMaxArticles: 1,
        enableLlmSummary: true,
        enableLocalRagCache: true
      })
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      pubmed: { articles: Array<{ pmid: string }> };
      llm?: { provider: string; summary: string };
    };

    expect(payload.pubmed.articles).toHaveLength(1);
    expect(payload.pubmed.articles[0].pmid).toBe('12345');
    expect(payload.llm?.provider).toBe('huggingface');
    expect(payload.llm?.summary).toContain('Synthese clinique');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('uses local RAG cache to avoid repeated PubMed calls', async () => {
    const fetchMock = mockPubMedAndHf();

    const requestBody = {
      inputs: JAMES_PERSONA,
      includePubMed: true,
      pubMedMaxArticles: 1,
      enableLlmSummary: false,
      enableLocalRagCache: true
    };

    const first = await POST(buildRequest(requestBody));
    expect(first.status).toBe(200);

    const second = await POST(buildRequest(requestBody));
    expect(second.status).toBe(200);

    // Without cache: 6 PubMed calls for 2 requests. With cache, second request should reuse cached articles.
    expect(fetchMock.mock.calls.length).toBe(3);
  });
});
