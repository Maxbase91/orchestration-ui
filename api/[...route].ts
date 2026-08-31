// Hobby-plan API dispatcher for low-volume domain endpoints.
// Keeping an explicit allowlist here preserves stable URLs while deploying one serverless function.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import commodityMatch from '../src/server/api/commodity-match.js';
import contractMatch from '../src/server/api/contract-match.js';
import contractScope from '../src/server/api/contract-scope.js';
import contractVocabulary from '../src/server/api/contract-vocabulary.js';
import intakeGuidance from '../src/server/api/intake-guidance.js';
import policyConfig from '../src/server/api/policy-config.js';
import intakeSubmit from '../src/server/api/intake-submit.js';
import neonHealth from '../src/server/api/neon-health.js';

type Handler = (req: VercelRequest, res: VercelResponse) => void | Promise<void>;

const HANDLERS: Record<string, Handler> = {
  'commodity-match': commodityMatch,
  'contract-match': contractMatch,
  'contract-scope': contractScope,
  'contract-vocabulary': contractVocabulary,
  'intake-guidance': intakeGuidance,
  'policy-config': policyConfig,
  'intake-submit': intakeSubmit,
  'neon-health': neonHealth,
};

function routeName(req: VercelRequest): string {
  const route = req.query.route;
  const value = Array.isArray(route) ? route.join('/') : route;
  if (value) return value.split('/').filter(Boolean).pop() ?? '';
  const pathname = req.url ? new URL(req.url, 'http://localhost').pathname : '';
  return pathname.split('/').filter(Boolean).pop() ?? '';
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const name = routeName(req);
  // Document parsers are loaded only for uploads so normal domain requests do
  // not inherit the parser's cold-start footprint.
  const delegate = name === 'intake-upload'
    ? (await import('../src/server/api/intake-upload.js')).default
    : HANDLERS[name];
  if (!delegate) {
    res.status(404).json({ error: 'Unknown API route', code: 'not_found' });
    return;
  }
  await delegate(req, res);
}
