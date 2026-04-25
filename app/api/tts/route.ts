import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

const OPENAI_SPEECH_URL = 'https://api.openai.com/v1/audio/speech';
const DEFAULT_TTS_MODEL = 'gpt-4o-mini-tts';
const DEFAULT_TTS_VOICE = 'marin';
const DEFAULT_TTS_INSTRUCTIONS =
  'Speak in warm, soft, natural American English. Sound like a calm human future-self in a private conversation. Use gentle pacing, subtle emotion, and natural intonation. Do not sound robotic, theatrical, or announcer-like.';
const KOKORO_SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'tts', 'kokoro_tts.py');
const LOCAL_KOKORO_PYTHON_PATH = path.join(process.cwd(), '.venv-kokoro', 'bin', 'python');
const DEFAULT_KOKORO_VOICE = 'af_heart';
const DEFAULT_KOKORO_LANG_CODE = 'a';
const DEFAULT_KOKORO_SPEED = 0.94;
const DEFAULT_KOKORO_TIMEOUT_MS = 180000;

type TtsResult = { ok: true; response: Response } | { ok: false; reason: string };

export async function POST(req: NextRequest) {
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  const input = cleanTtsInput(text ?? '');

  if (!input) {
    return Response.json({ error: 'Missing text' }, { status: 400 });
  }

  const kokoroResponse = await generateKokoroSpeech(input);
  if (kokoroResponse.ok) return kokoroResponse.response;

  const openAiResponse = await generateOpenAiSpeech(input);
  if (openAiResponse.ok) return openAiResponse.response;

  return Response.json(
    {
      error: 'TTS unavailable',
      kokoro: kokoroResponse.reason,
      openai: openAiResponse.reason
    },
    {
      status: 503,
      headers: {
        'X-FutureMe-TTS-Provider': 'kokoro-openai',
        'X-FutureMe-TTS-Error': sanitizeHeaderValue(kokoroResponse.reason || openAiResponse.reason || 'TTS unavailable')
      }
    }
  );
}

async function generateKokoroSpeech(input: string): Promise<TtsResult> {
  if (process.env.KOKORO_TTS_ENABLED?.trim() === '0') {
    return { ok: false, reason: 'Kokoro disabled with KOKORO_TTS_ENABLED=0' };
  }

  const pythonBin = process.env.KOKORO_PYTHON_BIN?.trim() || process.env.PYTHON_BIN?.trim() || (existsSync(LOCAL_KOKORO_PYTHON_PATH) ? LOCAL_KOKORO_PYTHON_PATH : 'python3');
  const voice = process.env.KOKORO_VOICE?.trim() || DEFAULT_KOKORO_VOICE;
  const langCode = process.env.KOKORO_LANG_CODE?.trim() || DEFAULT_KOKORO_LANG_CODE;
  const speed = readNumberEnv('KOKORO_SPEED', DEFAULT_KOKORO_SPEED);
  const timeoutMs = readNumberEnv('KOKORO_TTS_TIMEOUT_MS', DEFAULT_KOKORO_TIMEOUT_MS);
  const outputPath = path.join(tmpdir(), `futureme-kokoro-${randomUUID()}.wav`);

  try {
    const result = await runKokoroProcess({
      pythonBin,
      input,
      outputPath,
      voice,
      langCode,
      speed,
      timeoutMs
    });

    if (!result.ok) return result;

    const audio = await readFile(outputPath);
    if (audio.byteLength === 0) {
      return { ok: false, reason: 'Kokoro generated an empty audio file' };
    }

    return {
      ok: true,
      response: new Response(audio, {
        headers: {
          'Content-Type': 'audio/wav',
          'Cache-Control': 'no-store',
          'X-FutureMe-TTS-Provider': 'kokoro',
          'X-FutureMe-TTS-Model': 'Kokoro-82M',
          'X-FutureMe-TTS-Voice': voice
        }
      })
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown Kokoro TTS failure';
    return { ok: false, reason };
  } finally {
    await rm(outputPath, { force: true }).catch(() => undefined);
  }
}

async function runKokoroProcess(params: {
  pythonBin: string;
  input: string;
  outputPath: string;
  voice: string;
  langCode: string;
  speed: number;
  timeoutMs: number;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  return new Promise((resolve) => {
    const child = spawn(params.pythonBin, [KOKORO_SCRIPT_PATH], {
      env: {
        ...process.env,
        PYTORCH_ENABLE_MPS_FALLBACK: process.env.PYTORCH_ENABLE_MPS_FALLBACK ?? '1'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    const timeout = setTimeout(() => {
      settled = true;
      child.kill('SIGKILL');
      resolve({ ok: false, reason: `Kokoro TTS timed out after ${params.timeoutMs}ms` });
    }, params.timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({ ok: false, reason: `Could not start Kokoro Python process: ${error.message}` });
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code === 0) {
        resolve({ ok: true });
        return;
      }

      const details = (stderr || stdout || `Kokoro exited with code ${code}`).replace(/\s+/g, ' ').trim();
      resolve({ ok: false, reason: details.slice(0, 500) });
    });

    child.stdin.end(
      JSON.stringify({
        text: params.input,
        outputPath: params.outputPath,
        voice: params.voice,
        langCode: params.langCode,
        speed: params.speed
      })
    );
  });
}

async function generateOpenAiSpeech(input: string): Promise<TtsResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false as const, reason: 'Missing OPENAI_API_KEY' };
  }

  const model = process.env.OPENAI_TTS_MODEL?.trim() || DEFAULT_TTS_MODEL;
  const voice = process.env.OPENAI_TTS_VOICE?.trim() || DEFAULT_TTS_VOICE;
  const instructions = process.env.OPENAI_TTS_INSTRUCTIONS?.trim() || DEFAULT_TTS_INSTRUCTIONS;

  const response = await fetch(OPENAI_SPEECH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      voice,
      input,
      instructions,
      response_format: 'mp3'
    })
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    return {
      ok: false as const,
      reason: `OpenAI TTS failed (${response.status}): ${details.slice(0, 220)}`
    };
  }

  const audio = await response.arrayBuffer();
  return {
    ok: true as const,
    response: new Response(audio, {
      headers: {
        'Content-Type': response.headers.get('content-type') ?? 'audio/mpeg',
        'Cache-Control': 'no-store',
        'X-FutureMe-TTS-Provider': 'openai',
        'X-FutureMe-TTS-Model': model,
        'X-FutureMe-TTS-Voice': typeof voice === 'string' ? voice : DEFAULT_TTS_VOICE
      }
    })
  };
}

function readNumberEnv(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanTtsInput(text: string) {
  return text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_`>#~[\](){}]/g, ' ')
    .replace(/(?:\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDEFF]|\uD83E[\uDD00-\uDDFF])/g, '')
    .replace(/[\u2600-\u27BF]/g, '')
    .replace(/[⚠⚡∞•→←↑↓—–]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1400);
}

function sanitizeHeaderValue(value: string) {
  return value.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').slice(0, 180);
}
