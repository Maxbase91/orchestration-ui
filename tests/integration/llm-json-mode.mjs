#!/usr/bin/env node
// The prose fallback must actually return prose.
//
// callLLM accepts jsonMode and threaded it into the Groq path only; callGemini
// hardcoded responseMimeType: 'application/json' and was never passed the flag.
// api/chat.ts's fallback — the one that runs when Groq's tool-calling fails —
// asks for plain language with jsonMode: false. On the Gemini leg the user was
// therefore shown a raw JSON blob as their chat answer, which is both wrong and
// the kind of thing that reads as the assistant breaking.
//
// No network: this asserts the config object and the call graph, not a live
// completion.
import { readFileSync } from 'node:fs';
import { geminiGenerationConfig } from '../../api/_llm.ts';

let failures = 0;
const check = (label, fn) => {
  try { fn(); console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (error) { failures++; console.error(`  \x1b[31m✗\x1b[0m ${label} — ${error.message.split('\n')[0]}`); }
};
const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');
const read = (path) => stripComments(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));

console.log('\nGemini is told which kind of answer was asked for');

check('jsonMode true asks for JSON', () => {
  const config = geminiGenerationConfig(0.3, 1024, true);
  if (config.responseMimeType !== 'application/json') throw new Error(String(config.responseMimeType));
});
check('jsonMode false asks for text', () => {
  const config = geminiGenerationConfig(0.3, 1024, false);
  if (config.responseMimeType !== 'text/plain') throw new Error(String(config.responseMimeType));
});
check('temperature and token budget are carried through', () => {
  const config = geminiGenerationConfig(0.7, 512, true);
  if (config.temperature !== 0.7) throw new Error(`temperature ${config.temperature}`);
  if (config.maxOutputTokens !== 512) throw new Error(`maxOutputTokens ${config.maxOutputTokens}`);
});

console.log('\nBoth providers receive the flag');

const llm = read('api/_llm.ts');
check('callGemini takes jsonMode', () => {
  if (!/async function callGemini\([^)]*jsonMode: boolean/s.test(llm)) throw new Error('not in the signature');
});
check('callLLM passes jsonMode to callGemini', () => {
  if (!/callGemini\(geminiKey, messages, temperature, maxTokens, jsonMode\)/.test(llm)) {
    throw new Error('the fallback call still drops it');
  }
});
check('callLLM passes jsonMode to callGroq', () => {
  if (!/callGroq\(groqKey, messages, temperature, maxTokens, jsonMode\)/.test(llm)) {
    throw new Error('the primary call drops it');
  }
});
check('responseMimeType is no longer hardcoded', () => {
  if (/responseMimeType: 'application\/json'/.test(llm.replace(/jsonMode \? 'application\/json' : 'text\/plain'/, ''))) {
    throw new Error('a hardcoded JSON mime type remains');
  }
});

console.log('\nThe caller that needs prose still asks for it');

const chat = read('api/chat.ts');
check('the chat fallback asks for prose', () => {
  if (!/callLLM\(\{ messages: llmMessages, jsonMode: false \}\)/.test(chat)) {
    throw new Error('the prose fallback no longer sets jsonMode: false');
  }
});
check('the JSON callers still default to JSON', () => {
  for (const path of ['api/ai.ts', 'api/chat-intake.ts', 'api/generate-sow.ts']) {
    if (/jsonMode: false/.test(read(path))) throw new Error(`${path} asks for prose but parses JSON`);
  }
});

if (failures > 0) {
  console.error(`\nllm-json-mode: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nLLM json-mode checks passed.');
