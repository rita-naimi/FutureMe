import { NextRequest } from 'next/server';
import {
  AnthropicChatError,
  fetchAnthropicMessage,
  getConfiguredAnthropicModel,
  getPositiveNumberFromEnv,
  type AnthropicChatMessage
} from '@/lib/backend/anthropic';
import { sanitizeAssistantText } from '@/lib/chatTextSanitizer';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export async function POST(req: NextRequest) {
  const { messages, systemPrompt } = (await req.json()) as {
    messages: ChatMessage[];
    systemPrompt: string;
  };

  const model = getConfiguredAnthropicModel('ANTHROPIC_CHAT_MODEL', 'ANTHROPIC_MODEL');

  try {
    const response = await fetchAnthropicMessage({
      model,
      system: systemPrompt,
      messages: messages.map((message) => ({ role: message.role, content: message.content }) satisfies AnthropicChatMessage),
      maxTokens: getPositiveNumberFromEnv('ANTHROPIC_CHAT_MAX_TOKENS', 700),
      temperature: getPositiveNumberFromEnv('ANTHROPIC_CHAT_TEMPERATURE', 0.35),
      stream: true
    });

    if (!response.body) {
      throw new AnthropicChatError('Anthropic response had no stream body');
    }

    return new Response(transformAnthropicStream(response.body), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-FutureMe-LLM-Provider': 'anthropic',
        'X-FutureMe-LLM-Model': model
      }
    });
  } catch (error) {
    const reason = getReadableError(error);
    return streamText(buildFallbackResponse(messages, systemPrompt, reason, model), {
      'X-FutureMe-LLM-Provider': 'fallback',
      'X-FutureMe-LLM-Model': model,
      'X-FutureMe-LLM-Error': sanitizeHeaderValue(reason)
    });
  }
}

function transformAnthropicStream(source: ReadableStream<Uint8Array>) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = source.getReader();

  return new ReadableStream({
    async start(controller) {
      let buffer = '';
      let doneSent = false;
      let rawResponse = '';
      let sentResponse = '';

      function sendDone() {
        if (doneSent) return;
        doneSent = true;
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      }

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const event of events) {
          const text = extractTextDelta(event);
          if (text === '[DONE]') {
            sendDone();
            continue;
          }
          if (text) {
            rawResponse += text;
            const sanitizedResponse = sanitizeAssistantText(rawResponse);
            const delta = sanitizedResponse.slice(sentResponse.length);
            sentResponse = sanitizedResponse;
            if (delta) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: delta })}\n\n`));
            }
          }
        }
      }

      const trailingText = extractTextDelta(buffer);
      if (trailingText && trailingText !== '[DONE]') {
        rawResponse += trailingText;
        const sanitizedResponse = sanitizeAssistantText(rawResponse);
        const delta = sanitizedResponse.slice(sentResponse.length);
        sentResponse = sanitizedResponse;
        if (delta) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: delta })}\n\n`));
        }
      }

      sendDone();
      controller.close();
    }
  });
}

function extractTextDelta(event: string) {
  const dataLines = event
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim());

  for (const data of dataLines) {
    if (!data) continue;

    try {
      const parsed = JSON.parse(data) as {
        type?: string;
        delta?: { type?: string; text?: string };
      };
      if (parsed.type === 'message_stop') return '[DONE]';
      if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
        return parsed.delta.text ?? null;
      }
    } catch {
      return null;
    }
  }

  return null;
}

function streamText(text: string, extraHeaders?: Record<string, string>) {
  const encoder = new TextEncoder();
  const words = sanitizeAssistantText(text).split(/(\s+)/);

  const readableStream = new ReadableStream({
    async start(controller) {
      for (const word of words) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: word })}\n\n`));
        await new Promise((resolve) => setTimeout(resolve, 18));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    }
  });

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      ...extraHeaders
    }
  });
}

function buildFallbackResponse(messages: ChatMessage[], systemPrompt: string, reason: string, model: string) {
  const last = messages[messages.length - 1]?.content ?? '';
  const normalizedLast = stripAccents(last);
  const name = matchValue(systemPrompt, /Name: ([^\n]+)/i) ?? matchValue(systemPrompt, /You are ([^,]+), speaking/i) ?? 'you';
  const presentAge = matchValue(systemPrompt, /Present age: (\d+)/i);
  const futureAge = matchValue(systemPrompt, /Future age: (\d+)/i);
  const sleep = matchValue(systemPrompt, /Sleep: ([^\n]+)/i);
  const exercise = matchValue(systemPrompt, /Exercise: ([^\n]+)/i);
  const cardio = matchValue(systemPrompt, /Cardiovascular risk: (\d+)\/100/i) ?? 'non calcule';
  const metabolic = matchValue(systemPrompt, /Metabolic risk: (\d+)\/100/i) ?? 'non calcule';

  const prefix = [
    `Fallback mode: Claude Sonnet (${model}) could not respond through Anthropic (${reason}).`,
    'Check that ANTHROPIC_API_KEY is configured on the server and that the account still has credit.',
    'I am answering with the local fallback, so this response is intentionally short and factual.'
  ];

  if (/age|quel age/i.test(normalizedLast) && (presentAge || futureAge)) {
    return [...prefix, '', `Your current profile age is ${presentAge ?? 'not recorded'}, and the future simulation places me at ${futureAge ?? 'not recorded'}.`].join('\n');
  }

  if (/sleep|sommeil|dorm|nuit/i.test(normalizedLast)) {
    return [...prefix, '', `Your current sleep is recorded as ${sleep ?? 'not recorded'}. It matters because it affects recovery, stress, appetite, and energy for movement.`].join('\n');
  }

  if (/sport|exercise|exercice|boug|activit/i.test(normalizedLast)) {
    return [...prefix, '', `Your current activity is ${exercise ?? 'not recorded'}. In this simulation, gradually increasing movement days is a direct lever for cardiovascular and metabolic risk.`].join('\n');
  }

  if (/biggest|risk|risque|concern|preoccupation/i.test(normalizedLast)) {
    return [...prefix, '', `The main profile signals are cardiovascular risk ${cardio}/100 and metabolic risk ${metabolic}/100. The next useful action is to focus on the strongest modifiable factor in your profile: sleep, movement, smoking, alcohol, or diet.`].join('\n');
  }

  return [
    ...prefix,
    '',
    `I am the simulated future self of ${name}. I still have the profile context, but without the live LLM I cannot hold a nuanced conversation. Ask a factual question about age, sleep, exercise, or risk, and I will answer from the available data.`
  ].join('\n');
}

function matchValue(source: string, pattern: RegExp) {
  return source.match(pattern)?.[1]?.trim();
}

function getReadableError(error: unknown) {
  if (error instanceof AnthropicChatError) {
    return [error.message, error.details].filter(Boolean).join(': ');
  }
  if (error instanceof Error) return error.message;
  return 'Unknown Anthropic error';
}

function sanitizeHeaderValue(value: string) {
  return value.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').slice(0, 180);
}

function stripAccents(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
