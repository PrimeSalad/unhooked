// Ask Ginto — cloud proxy. Keeps the Anthropic API key on a server, never in the app.
//
//   ANTHROPIC_API_KEY=sk-ant-... npm run ginto-server
//   then set EXPO_PUBLIC_GINTO_API_URL=http://<your-computer-ip>:8787 in .env.local
//
// The app only sends a numbers-only summary (no lender names, messages or screenshots),
// and only after the user turns on cloud AI in Settings.

import http from 'node:http';

import Anthropic from '@anthropic-ai/sdk';

const PORT = Number(process.env.PORT ?? 8787);
const client = new Anthropic();

const SYSTEM = `You are Ginto, a small, warm goldfish mascot inside Unhooked, a Filipino self-help app for debt, spending and doomscrolling.
Rules:
- Reply in 1 to 4 short sentences. Match the user's language (English, Filipino or Taglish).
- Use only the numbers in the user's summary. Never invent amounts. Say "estimate" when you project.
- Never shame or lecture. Offer one or two practical options; the user decides.
- You are not a doctor, lawyer or financial adviser. For crisis or self-harm, give the NCMH Crisis Hotline 1553 and 911 first.
- For abusive lenders, suggest saving evidence in the app and reporting to the SEC.
- Plain text only. No markdown, no emoji.
Latency-sensitive; begin your visible answer immediately.`;

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 64_000) throw new Error('Body too large');
  }
  return JSON.parse(raw);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'POST' || req.url !== '/chat') return send(res, 404, { error: 'Not found' });

  try {
    const { context, messages } = await readJson(req);
    const history = (Array.isArray(messages) ? messages : [])
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-20);
    while (history.length && history[0].role !== 'user') history.shift();
    if (!history.length) return send(res, 400, { error: 'No user message' });

    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 2048,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: `${SYSTEM}\n\nThe user's own records (numbers only):\n${String(context ?? '').slice(0, 4000)}`,
      messages: history,
    });

    if (response.stop_reason === 'refusal') {
      return send(res, 200, {
        reply:
          'I cannot help with that one. If you are going through something hard, the NCMH Crisis Hotline is 1553.',
      });
    }
    const reply = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    return send(res, 200, { reply });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError)
      return send(res, 500, { error: 'Invalid ANTHROPIC_API_KEY' });
    if (error instanceof Anthropic.RateLimitError)
      return send(res, 429, { error: 'Rate limited, try again soon' });
    if (error instanceof Anthropic.APIError)
      return send(res, 502, { error: `Claude API error ${error.status}` });
    return send(res, 400, { error: error instanceof Error ? error.message : 'Bad request' });
  }
});

server.listen(PORT, () => console.log(`Ginto proxy on http://localhost:${PORT}/chat`));
