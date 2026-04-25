import { NextRequest } from 'next/server';
import {
  HuggingFaceChatError,
  fetchHuggingFaceChatCompletion,
  getConfiguredHuggingFaceModel,
  getPositiveNumberFromEnv,
  type HuggingFaceChatMessage
} from '@/lib/backend/huggingface';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export async function POST(req: NextRequest) {
  const { messages, systemPrompt } = (await req.json()) as {
    messages: ChatMessage[];
    systemPrompt: string;
  };

  const model = getConfiguredHuggingFaceModel('HF_CHAT_MODEL', 'HF_MODEL');

  try {
    const response = await fetchHuggingFaceChatCompletion({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((message) => ({ role: message.role, content: message.content }) satisfies HuggingFaceChatMessage)
      ],
      maxTokens: getPositiveNumberFromEnv('HF_CHAT_MAX_TOKENS', 900),
      temperature: getPositiveNumberFromEnv('HF_CHAT_TEMPERATURE', 0.35),
      stream: true
    });

    if (!response.body) {
      throw new HuggingFaceChatError('Hugging Face response had no stream body');
    }

    return new Response(transformHuggingFaceStream(response.body), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-FutureMe-LLM-Provider': 'huggingface',
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

function transformHuggingFaceStream(source: ReadableStream<Uint8Array>) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = source.getReader();

  return new ReadableStream({
    async start(controller) {
      let buffer = '';
      let doneSent = false;

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
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
        }
      }

      const trailingText = extractTextDelta(buffer);
      if (trailingText && trailingText !== '[DONE]') {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: trailingText })}\n\n`));
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
    if (data === '[DONE]') return '[DONE]';

    try {
      const parsed = JSON.parse(data) as {
        choices?: Array<{
          delta?: { content?: string };
          message?: { content?: string };
        }>;
      };
      const text = parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.message?.content;
      if (text) return text;
    } catch {
      return null;
    }
  }

  return null;
}

function streamText(text: string, extraHeaders?: Record<string, string>) {
  const encoder = new TextEncoder();
  const words = text.split(/(\s+)/);

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
  const name = matchValue(systemPrompt, /Name: ([^\n]+)/i) ?? matchValue(systemPrompt, /You are ([^,]+), speaking/i) ?? 'toi';
  const presentAge = matchValue(systemPrompt, /Present age: (\d+)/i);
  const futureAge = matchValue(systemPrompt, /Future age: (\d+)/i);
  const sleep = matchValue(systemPrompt, /Sleep: ([^\n]+)/i);
  const exercise = matchValue(systemPrompt, /Exercise: ([^\n]+)/i);
  const cardio = matchValue(systemPrompt, /Cardiovascular risk: (\d+)\/100/i) ?? 'non calcule';
  const metabolic = matchValue(systemPrompt, /Metabolic risk: (\d+)\/100/i) ?? 'non calcule';

  const prefix = [
    `Mode degrade: le modele open source ${model} n'a pas pu repondre en direct (${reason}).`,
    'Je reponds avec le fallback local, donc la reponse est volontairement courte et factuelle.'
  ];

  if (/age|quel age/i.test(normalizedLast) && (presentAge || futureAge)) {
    return [...prefix, '', `Tu as ${presentAge ?? 'un age non renseigne'} ans dans le profil actuel, et la simulation me place a ${futureAge ?? 'un age futur non renseigne'} ans.`].join('\n');
  }

  if (/sleep|sommeil|dorm|nuit/i.test(normalizedLast)) {
    return [...prefix, '', `Ton sommeil actuel est note a ${sleep ?? 'une valeur non renseignee'}. C'est un levier important parce qu'il influence la recuperation, le stress, l'alimentation et l'energie pour bouger.`].join('\n');
  }

  if (/sport|exercise|exercice|boug|activit/i.test(normalizedLast)) {
    return [...prefix, '', `Ton activite actuelle est ${exercise ?? 'non renseignee'}. Dans cette simulation, augmenter progressivement les jours de mouvement est un levier direct sur le risque cardiovasculaire et metabolique.`].join('\n');
  }

  if (/biggest|risk|risque|concern|preoccupation/i.test(normalizedLast)) {
    return [...prefix, '', `Les signaux principaux du profil sont: risque cardiovasculaire ${cardio}/100 et risque metabolique ${metabolic}/100. La prochaine bonne action est d'agir sur le facteur modifiable le plus fort: sommeil, mouvement, tabac, alcool ou alimentation selon ton profil.`].join('\n');
  }

  return [
    ...prefix,
    '',
    `Je suis le futur simule de ${name}. Je garde le contexte du profil, mais sans LLM live je ne peux pas faire une vraie conversation nuancee. Pose une question factuelle sur l'age, le sommeil, l'exercice ou les risques, et je repondrai avec les donnees disponibles.`
  ].join('\n');
}

function matchValue(source: string, pattern: RegExp) {
  return source.match(pattern)?.[1]?.trim();
}

function getReadableError(error: unknown) {
  if (error instanceof HuggingFaceChatError) {
    return [error.message, error.details].filter(Boolean).join(': ');
  }
  if (error instanceof Error) return error.message;
  return 'Unknown Hugging Face error';
}

function sanitizeHeaderValue(value: string) {
  return value.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').slice(0, 180);
}

function stripAccents(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
