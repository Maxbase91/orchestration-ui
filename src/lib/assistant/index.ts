import { mockProvider } from './mock-provider';
import { groqProvider } from './groq-provider';
import type { AssistantProvider } from './provider';

export const provider: AssistantProvider =
  import.meta.env.VITE_ASSISTANT_PROVIDER === 'groq' ? groqProvider : mockProvider;
