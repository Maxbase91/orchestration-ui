// Shared LLM helper — tries Groq first, falls back to Gemini

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
}

export interface GroqTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string; enum?: string[] }>;
      required?: string[];
    };
  };
}

export interface GroqToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ToolCallResult {
  content: string | null;
  toolCalls: GroqToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
  assistantMessage: {
    role: 'assistant';
    content: string | null;
    tool_calls?: GroqToolCall[];
  };
}

export async function callLLMWithTools(
  messages: LLMMessage[],
  tools: GroqTool[],
  temperature = 0.2,
): Promise<ToolCallResult> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) throw new Error('GROQ_API_KEY not set');

  const body = {
    model: 'llama-3.3-70b-versatile',
    messages,
    tools,
    tool_choice: 'auto',
    temperature,
    max_tokens: 1024,
  };

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${groqKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`Groq tool-calling failed [${response.status}]:`, err);
    throw new Error(`Groq tool-calling failed: ${response.status} ${err}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  const msg = choice?.message;

  return {
    content: msg?.content ?? null,
    toolCalls: msg?.tool_calls ?? [],
    finishReason: choice?.finish_reason ?? 'error',
    assistantMessage: {
      role: 'assistant',
      content: msg?.content ?? null,
      ...(msg?.tool_calls ? { tool_calls: msg.tool_calls } : {}),
    },
  };
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

// Streaming Groq call — calls onToken for each content chunk
export async function callLLMStreaming(
  messages: LLMMessage[],
  onToken: (token: string) => void,
): Promise<void> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) throw new Error('GROQ_API_KEY not set');

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      stream: true,
      max_tokens: 1024,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq streaming failed: ${response.status}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const payload = trimmed.slice(6);
      if (payload === '[DONE]') return;
      try {
        const parsed = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onToken(content);
      } catch { /* ignore malformed chunks */ }
    }
  }
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
