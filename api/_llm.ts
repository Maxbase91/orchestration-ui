// Shared LLM helper — tries Groq first, falls back to Gemini

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Single source of truth for the Groq model — it was previously repeated at all
// three call sites, so a decommissioned ID had to be fixed in three places.
//
// Groq retires hosted models on a rolling schedule and the retired ID then
// returns **404** (not 401) from the chat-completions endpoint, which reads like
// an outage rather than a config problem. The predecessor here,
// `llama-3.3-70b-versatile`, was deprecated on 2026-08-16; this replaces it with
// Groq's own recommended successor. Still the governed Groq provider (CLS-G0) —
// the `openai/` segment is just the open-weight model's name, the request goes
// to api.groq.com with GROQ_API_KEY exactly as before. Chosen over
// `qwen/qwen3.6-27b` because the assistant depends on tool-calling.
const GROQ_MODEL = 'openai/gpt-oss-120b';

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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  const body = {
    model: GROQ_MODEL,
    messages,
    tools,
    tool_choice: 'auto',
    temperature,
    max_tokens: 1024,
  };

  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`Groq tool-calling failed [${response.status}]:`, err);
      throw new Error(`Groq tool-calling failed: ${response.status} ${err}`);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string | null; tool_calls?: GroqToolCall[] }; finish_reason?: string }> };
    const choice = data.choices?.[0];
    const msg = choice?.message;

    return {
      content: msg?.content ?? null,
      toolCalls: msg?.tool_calls ?? [],
      finishReason: (choice?.finish_reason as ToolCallResult['finishReason']) ?? 'error',
      assistantMessage: {
        role: 'assistant',
        content: msg?.content ?? null,
        ...(msg?.tool_calls ? { tool_calls: msg.tool_calls } : {}),
      },
    };
  } finally {
    clearTimeout(timer);
  }
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
    model: GROQ_MODEL,
    messages,
    temperature,
    max_tokens: maxTokens,
  };
  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
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

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? null;
  } finally {
    clearTimeout(timer);
  }
}

// Streaming Groq call — calls onToken for each content chunk
export async function callLLMStreaming(
  messages: LLMMessage[],
  onToken: (token: string) => void,
  tools?: GroqTool[],
): Promise<void> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) throw new Error('GROQ_API_KEY not set');

  const body: Record<string, unknown> = {
    model: GROQ_MODEL,
    messages,
    stream: true,
    max_tokens: 1024,
    temperature: 0.2,
  };
  // When tools are provided, set tool_choice: 'none' so the model produces
  // a plain text response rather than outputting tool-call JSON as raw text.
  if (tools?.length) {
    body.tools = tools;
    body.tool_choice = 'none';
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });

  if (!response.ok) {
    clearTimeout(timer);
    throw new Error(`Groq streaming failed: ${response.status}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  try {
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
          const parsed = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string }; finish_reason?: string }> };
          const choice = parsed.choices?.[0];
          if (choice?.finish_reason) return;
          const content = choice?.delta?.content;
          if (content) onToken(content);
        } catch { /* ignore malformed chunks */ }
      }
    }
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
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
