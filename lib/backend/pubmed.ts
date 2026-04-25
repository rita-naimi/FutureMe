import type { HealthInputs } from '@/lib/fhir';
import type { PubMedArticle, RiskEvidence } from './types';
import fs from 'node:fs';
import path from 'node:path';

interface ESearchResponse {
  esearchresult?: {
    idlist?: string[];
  };
}

interface ESummaryItem {
  uid?: string;
  title?: string;
  fulljournalname?: string;
  pubdate?: string;
}

interface ESummaryResponse {
  result?: {
    [pmid: string]: ESummaryItem | string[] | undefined;
    uids?: string[];
  };
}

interface PubMedContext {
  query: string;
  articles: PubMedArticle[];
}

interface CacheRecord {
  storedAt: number;
  payload: PubMedContext;
}

const CACHE_DIR = path.join(process.cwd(), 'data', 'pubmed');
function getCacheFile() {
  return process.env.PUBMED_CACHE_FILE ?? path.join(CACHE_DIR, 'cache.json');
}
let memoryCache: Record<string, CacheRecord> | null = null;

function cacheTtlMs() {
  const hours = Number(process.env.PUBMED_CACHE_TTL_HOURS ?? '24');
  return Math.max(1, hours) * 60 * 60 * 1000;
}

function ensureCacheLoaded() {
  if (memoryCache) return;
  const cacheFile = getCacheFile();
  if (!fs.existsSync(cacheFile)) {
    memoryCache = {};
    return;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as Record<string, CacheRecord>;
    memoryCache = parsed;
  } catch {
    memoryCache = {};
  }
}

function saveCache() {
  if (!memoryCache) return;
  const cacheFile = getCacheFile();
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(memoryCache), 'utf8');
}

function cacheKey(query: string, maxArticles: number) {
  return `${query}::${maxArticles}`;
}

function getCached(query: string, maxArticles: number): PubMedContext | null {
  ensureCacheLoaded();
  const key = cacheKey(query, maxArticles);
  const hit = memoryCache?.[key];
  if (!hit) return null;
  if (Date.now() - hit.storedAt > cacheTtlMs()) {
    if (memoryCache) {
      delete memoryCache[key];
      saveCache();
    }
    return null;
  }
  return hit.payload;
}

function setCached(query: string, maxArticles: number, payload: PubMedContext) {
  ensureCacheLoaded();
  const key = cacheKey(query, maxArticles);
  if (!memoryCache) memoryCache = {};
  memoryCache[key] = { storedAt: Date.now(), payload };
  saveCache();
}

export function resetPubMedCacheForTests() {
  memoryCache = {};
  const cacheFile = getCacheFile();
  if (fs.existsSync(cacheFile)) {
    fs.unlinkSync(cacheFile);
  }
}

function compact(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function buildQuery(inputs: HealthInputs, risk: RiskEvidence) {
  const terms = [
    'cardiovascular risk prediction',
    `adult ${inputs.sex}`,
    inputs.smokingStatus === 'current' ? 'smoking cessation outcomes' : 'preventive lifestyle intervention',
    risk.metabolicSyndromeProxyRiskPercent >= 40 ? 'metabolic syndrome cohort' : 'primary prevention cohort'
  ];

  return terms.join(' AND ');
}

function parseAbstracts(xml: string): string[] {
  const abstracts: string[] = [];
  const pattern = /<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g;
  let match = pattern.exec(xml);

  while (match) {
    abstracts.push(compact(match[1].replace(/<[^>]+>/g, '')));
    match = pattern.exec(xml);
  }

  return abstracts;
}

function isSummaryItem(item: ESummaryItem | string[] | undefined): item is ESummaryItem {
  return item !== undefined && !Array.isArray(item);
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'FutureMe/0.1'
    }
  });

  if (!response.ok) {
    throw new Error(`PubMed request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'FutureMe/0.1'
    }
  });

  if (!response.ok) {
    throw new Error(`PubMed abstract request failed: ${response.status}`);
  }

  return response.text();
}

export async function fetchPubMedContext(
  inputs: HealthInputs,
  risk: RiskEvidence,
  maxArticles = 3,
  useLocalRagCache = true
): Promise<{ query: string; articles: PubMedArticle[] }> {
  const query = buildQuery(inputs, risk);
  const boundedMax = Math.max(1, Math.min(5, maxArticles));

  if (useLocalRagCache) {
    const cached = getCached(query, boundedMax);
    if (cached) return cached;
  }

  try {
    const esearchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=${boundedMax}&term=${encodeURIComponent(query)}`;
    const search = await fetchJson<ESearchResponse>(esearchUrl);
    const ids = search.esearchresult?.idlist ?? [];

    if (ids.length === 0) {
      return { query, articles: [] };
    }

    const esummaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(',')}`;
    const summary = await fetchJson<ESummaryResponse>(esummaryUrl);

    const efetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&retmode=xml&id=${ids.join(',')}`;
    const xml = await fetchText(efetchUrl);
    const abstracts = parseAbstracts(xml);

    const articles: PubMedArticle[] = ids.map((pmid, index) => {
      const item = summary.result?.[pmid];
      return {
        pmid,
        title: isSummaryItem(item) ? item.title ?? 'Untitled article' : 'Untitled article',
        journal: isSummaryItem(item) ? item.fulljournalname : undefined,
        year: isSummaryItem(item) ? item.pubdate?.slice(0, 4) : undefined,
        abstractSnippet: abstracts[index]?.slice(0, 700)
      };
    });

    const payload = { query, articles };
    if (useLocalRagCache) {
      setCached(query, boundedMax, payload);
    }
    return payload;
  } catch {
    return { query, articles: [] };
  }
}
