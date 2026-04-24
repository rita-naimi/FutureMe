import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export async function POST(req: NextRequest) {
  const { messages, systemPrompt } = (await req.json()) as {
    messages: ChatMessage[];
    systemPrompt: string;
  };

  if (!process.env.ANTHROPIC_API_KEY) {
    return streamText(buildFallbackResponse(messages, systemPrompt));
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: systemPrompt,
      messages
    });

    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`));
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Claude API error';
    return streamText(
      `I can feel the connection flicker, but the signal is still useful. The live Claude endpoint returned: ${message}. For the demo, ask me about smoking, sleep, movement, or the timeline and I will keep the simulation moving.`
    );
  }
}

function streamText(text: string) {
  const encoder = new TextEncoder();
  const words = text.split(/(\s+)/);

  const readableStream = new ReadableStream({
    async start(controller) {
      for (const word of words) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: word })}\n\n`));
        await new Promise((resolve) => setTimeout(resolve, 22));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    }
  });

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    }
  });
}

function buildFallbackResponse(messages: ChatMessage[], systemPrompt: string) {
  const last = messages[messages.length - 1]?.content ?? '';
  const name = systemPrompt.match(/You are ([^,]+), speaking/)?.[1] ?? 'you';
  const cardio = systemPrompt.match(/Cardiovascular risk: (\d+)\/100/)?.[1] ?? 'high';
  const metabolic = systemPrompt.match(/Metabolic risk: (\d+)\/100/)?.[1] ?? 'elevated';

  if (/quit.*smok|stop.*smok|smoking/i.test(last)) {
    return `I still remember the week I stopped smoking. My cardiovascular risk did not vanish, but the path bent quickly: breathing improved first, then blood pressure, then the fear I had been carrying. Expect the biggest gain in heart risk over the next 12 months.`;
  }
  if (/sleep/i.test(last)) {
    return `When I moved from short sleep to eight hours, the first change was not dramatic. I was less reactive, I ate better, and exercise stopped feeling impossible. In this simulation, sleep is one of the fastest ways to lower stress-linked risk.`;
  }
  if (/biggest|risk|concern/i.test(last)) {
    return `My biggest warning from here is cardiovascular risk at ${cardio}/100. If I could send one instruction back, it would be this: remove the highest-risk habit first and add four movement days a week. That single combination changes the next decade.`;
  }
  if (/live past 80|80/i.test(last)) {
    return `I cannot promise an age, and this is not a diagnosis. But I can tell you the trajectory matters: with metabolic risk at ${metabolic}/100, the habits you change now decide how much capacity I still have later.`;
  }
  return `I am ${name}, ten years older, and I remember this moment more clearly than you think. The data is not destiny. Pick one habit this week, make it visible, and the future starts responding.`;
}
