import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/pipeline/route';
import { resetPubMedCacheForTests } from '@/lib/backend/pubmed';
import { HIGH_RISK_PROFILE } from '../fixtures/health-inputs';

function buildRequest(body: unknown) {
  return new NextRequest('http://localhost/api/pipeline', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

function mockPubMedAndAnthropic() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
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

    if (url.includes('api.anthropic.com/v1/messages')) {
      const body = JSON.parse(String(init?.body)) as { model: string; max_tokens: number; stream: boolean };
      expect(body.model).toBe('claude-sonnet-4-6');
      expect(body.max_tokens).toBe(900);
      expect(body.stream).toBe(false);

      return new Response(
        JSON.stringify({
          content: [{ type: 'text', text: 'Synthese clinique testee.' }]
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
    process.env.PUBMED_CACHE_FILE = '/tmp/futureme-pubmed-test-cache.json';
    resetPubMedCacheForTests();
    process.env.ANTHROPIC_API_KEY = 'test-key';
    delete process.env.ANTHROPIC_MODEL;
    delete process.env.ANTHROPIC_CLINICAL_MODEL;
    delete process.env.ANTHROPIC_CLINICAL_MAX_TOKENS;
    process.env.PUBMED_CACHE_TTL_HOURS = '24';
  });

  it('returns 400 on invalid payload', async () => {
    const response = await POST(buildRequest({ wrong: true }));
    expect(response.status).toBe(400);
  });

  it('returns pipeline data with mocked PubMed and Anthropic', async () => {
    const fetchMock = mockPubMedAndAnthropic();

    const response = await POST(
      buildRequest({
        inputs: HIGH_RISK_PROFILE,
        clinicalMarkers: {
          onBloodPressureTreatment: true
        },
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
    expect(payload.llm?.provider).toBe('anthropic');
    expect(payload.llm?.summary).toContain('Synthese clinique');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('uses local RAG cache to avoid repeated PubMed calls', async () => {
    const fetchMock = mockPubMedAndAnthropic();

    const requestBody = {
      inputs: HIGH_RISK_PROFILE,
      clinicalMarkers: {
        onBloodPressureTreatment: true
      },
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

  it('accepts apple health payloads without questionnaire inputs', async () => {
    const response = await POST(
      buildRequest({
        appleHealth: {
          inputs: {
            name: 'Apple User',
            age: 40,
            sex: 'female',
            heightCm: 170,
            weightKg: 70,
            sleepHours: 7,
            exerciseDaysPerWeek: 3,
            dietQuality: null,
            stressLevel: null,
            smokingStatus: null,
            alcoholDrinksPerWeek: 2,
            familyHistoryHeart: null,
            familyHistoryDiabetes: null,
            familyHistoryCancer: null,
            existingConditions: []
          },
          clinicalMarkers: {
            totalCholesterolMgDl: null,
            hdlMgDl: null,
            systolicBloodPressureMmHg: null,
            onBloodPressureTreatment: null,
            hasDiabetes: null
          }
        },
        includePubMed: false,
        enableLlmSummary: false
      })
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { profile: { inputs: { name: string; dietQuality: number } } };
    expect(payload.profile.inputs.name).toBe('Apple User');
    expect(payload.profile.inputs.dietQuality).toBe(3);
  });
});
