// Shared LLM helper — tries Groq first, falls back to Gemini

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMOptions {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export async function callLLM(options: LLMOptions): Promise<string> {
  const { messages, temperature = 0.3, maxTokens = 1024, jsonMode = true } = options;

  // Try Groq first
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const result = await callGroq(groqKey, messages, temperature, maxTokens, jsonMode);
      if (result) return result;
    } catch (e) {
      console.warn('Groq failed, trying Gemini fallback:', e);
    }
  }

  // Fallback to Gemini
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const result = await callGemini(geminiKey, messages, temperature, maxTokens);
      if (result) return result;
    } catch (e) {
      console.warn('Gemini also failed:', e);
    }
  }

  throw new Error('All LLM providers failed');
}

async function callGroq(
  apiKey: string,
  messages: LLMMessage[],
  temperature: number,
  maxTokens: number,
  jsonMode: boolean,
): Promise<string | null> {
  const body: Record<string, unknown> = {
    model: 'llama-3.3-70b-versatile',
    messages,
    temperature,
    max_tokens: maxTokens,
  };
  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (response.status === 429) {
    console.warn('Groq rate limited (429)');
    return null; // trigger fallback
  }

  if (!response.ok) {
    const err = await response.text();
    console.error('Groq error:', response.status, err);
    return null;
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? null;
}

async function callGemini(
  apiKey: string,
  messages: LLMMessage[],
  temperature: number,
  maxTokens: number,
): Promise<string | null> {
  // Convert OpenAI-style messages to Gemini format
  const systemInstruction = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');

  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      responseMimeType: 'application/json',
    },
  };

  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (response.status === 429) {
    console.warn('Gemini rate limited (429)');
    return null;
  }

  if (!response.ok) {
    const err = await response.text();
    console.error('Gemini error:', response.status, err);
    return null;
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}
