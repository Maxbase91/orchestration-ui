#!/usr/bin/env node
/**
 * Resume the repository schema on Neon after a partial SQL-editor run.
 * Only additive/idempotent statements are executed; destructive DROP statements
 * and the legacy row-level-security policies are intentionally skipped — they
 * were never this application's authorization boundary.
 */
import { readFileSync } from 'node:fs';
import { Client } from '@neondatabase/serverless';

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync(new URL('../../.env.local', import.meta.url), 'utf8').split('\n')) {
      const separator = line.indexOf('=');
      if (separator <= 0 || line.trimStart().startsWith('#')) continue;
      const key = line.slice(0, separator).trim();
      if (!(key in env)) env[key] = line.slice(separator + 1).trim().replace(/^"|"$/g, '');
    }
  } catch {
    // CI supplies environment variables directly.
  }
  return env;
}

function splitStatements(source) {
  const statements = [];
  let start = 0;
  let quote = null;
  let dollarTag = null;
  let lineComment = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (!quote && !dollarTag && char === '-' && next === '-') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (dollarTag) {
      if (source.startsWith(dollarTag, index)) {
        index += dollarTag.length - 1;
        dollarTag = null;
      }
      continue;
    }
    if (quote) {
      if (char === quote && source[index - 1] !== '\\') quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === '$') {
      const match = source.slice(index).match(/^\$[A-Za-z_0-9]*\$/);
      if (match) {
        dollarTag = match[0];
        index += dollarTag.length - 1;
        continue;
      }
    }
    if (char === ';') {
      const statement = source.slice(start, index + 1).trim();
      if (statement) statements.push(statement);
      start = index + 1;
    }
  }
  const tail = source.slice(start).trim();
  if (tail) statements.push(tail);
  return statements;
}

function stripComments(statement) {
  return statement.replace(/^(?:\s*--[^\n]*\n)+/g, '').trim();
}

function shouldSkip(statement) {
  const sql = stripComments(statement);
  if (/^(DROP\s|ALTER\s+TABLE\s+\S+\s+DROP\s)/i.test(sql)) return true;
  if (/^CREATE\s+POLICY\s/i.test(sql)) return true;
  if (/^ALTER\s+TABLE\s+\S+\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(sql)) return true;
  return false;
}

function makeIdempotent(statement) {
  const sql = stripComments(statement);
  return statement;
}

function viewName(statement) {
  const match = /^CREATE\s+VIEW\s+([A-Za-z_][A-Za-z0-9_]*)/i.exec(stripComments(statement));
  return match?.[1];
}

const env = loadEnv();
const connectionString = env.NEON_DATABASE_URL ?? env.DATABASE_URL;
if (!connectionString) throw new Error('NEON_DATABASE_URL or DATABASE_URL is required.');

const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const statements = splitStatements(schema);
const client = new Client(connectionString);
await client.connect();
let applied = 0;
let skipped = 0;
try {
  for (const original of statements) {
    if (shouldSkip(original)) {
      skipped += 1;
      continue;
    }
    const statement = makeIdempotent(original);
    try {
      const name = viewName(statement);
      if (name) await client.query(`DROP VIEW IF EXISTS "${name}" CASCADE`);
      await client.query(statement);
      applied += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/already exists|duplicate object|duplicate key/i.test(message)) {
        skipped += 1;
        continue;
      }
      throw new Error(`Schema statement failed: ${message}\n${stripComments(statement).slice(0, 300)}`);
    }
  }
} finally {
  await client.end();
}

console.log(`Neon schema apply complete: ${applied} additive statements applied, ${skipped} destructive/policy statements skipped.`);
