// Imperative controls for the assistant overlay.
//
// The overlay listens for these window events, so any screen can open it
// without holding a reference to it. They lived in `ai-chat-overlay.tsx`, which
// made that module export both a component and plain functions — Fast Refresh
// cannot hot-update a module that mixes the two, so editing the overlay forced
// a full reload.
//
// The event names are the contract between this file and the overlay's
// listeners; change them in both places or not at all.

export function openAIChat() {
  window.dispatchEvent(new CustomEvent('open-ai-chat'));
}

export function openAIChatWithPrompt(prompt: string) {
  window.dispatchEvent(new CustomEvent('open-ai-chat-with-prompt', { detail: prompt }));
}
