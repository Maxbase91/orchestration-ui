import { mockProvider } from './mockProvider';
import { groqProvider } from './groqProvider';
import type { AssistantProvider } from './provider';

export const provider: AssistantProvider =
  import.meta.env.VITE_ASSISTANT_PROVIDER === 'groq' ? groqProvider : mockProvider;
