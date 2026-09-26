#!/usr/bin/env node
// The browser suites' dev servers: every suite starts one through
// tests/ui/dev-server.mjs on a port of its own, and the helper hands a suite no
// server but the one it started, serving this app.
//
// Why: the suites shared Vite's default 5173 and probed it, so another
// project's dev server there was tested in place of this app (2026-09-26). The
// browser suites only ever take the helper's happy path — nothing holds their
// ports in CI — so its refusals are driven here, with no browser.

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createServer as createTcpServer } from 'node:net';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { devServer } from '../ui/dev-server.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const UI_DIR = path.join(ROOT, 'tests', 'ui');
const HELPER = 'dev-server.mjs';

// The port assertions below set their own; one left in the shell must not
// redirect every server this suite starts.
delete process.env.UI_PORT;

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  else { failures++; console.error(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
}

// ── Every suite claims a port of its own ─────────────────────────────────────
console.log('\nEvery browser suite starts its dev server through the helper, on its own port');
// Vite's default and the ports it moves on to when that is taken, which is
// where other projects' dev servers land.
const VITE_DEFAULT = 5173;
const nearViteDefault = (port) => port >= VITE_DEFAULT && port < VITE_DEFAULT + 5;
// The preview server is this app too, so a suite on its port would be refused
// whenever the preview is open.
const previewPorts = (() => {
  try {
    const launch = JSON.parse(readFileSync(path.join(ROOT, '.claude', 'launch.json'), 'utf8'));
    return new Set(launch.configurations.map((entry) => Number(entry.port)));
  } catch {
    return new Set();
  }
})();

const problems = [];
const owners = new Map();
for (const file of readdirSync(UI_DIR).filter((name) => name.endsWith('.mjs') && name !== HELPER).sort()) {
  const source = readFileSync(path.join(UI_DIR, file), 'utf8');
  // Starting Vite any other way skips every check the helper makes.
  if (/['"]run['"]\s*,\s*['"]dev['"]/.test(source)) problems.push(`${file} starts \`npm run dev\` itself — use devServer() from ${HELPER}`);
  // A base written out by hand ignores UI_PORT, and was 5173 in every suite that did it.
  if (/localhost:\d/.test(source)) problems.push(`${file} writes out a localhost port — take the base from devServer()`);
  for (const [, argument] of source.matchAll(/devServer\(([^)]*)\)/g)) {
    // A literal, so this check can see it.
    const port = Number(/^\s*(['"])(\d+)\1\s*$/.exec(argument)?.[2]);
    if (!port) { problems.push(`${file} calls devServer(${argument}) — name the port as a string literal`); continue; }
    if (nearViteDefault(port)) problems.push(`${file} uses port ${port}, Vite's default or next to it, where other projects' dev servers land`);
    if (previewPorts.has(port)) problems.push(`${file} uses port ${port}, the preview server's (.claude/launch.json)`);
    if (owners.has(port)) problems.push(`${file} and ${owners.get(port)} both use port ${port}`);
    else owners.set(port, file);
  }
}
const ports = [...owners.keys()].sort((a, b) => a - b);
check(`${owners.size} suites start a dev server, each on a port no other uses (${ports.join(', ')})`,
  problems.length === 0 && owners.size > 0, problems.join('\n      '));

const defaults = devServer('5999');
process.env.UI_PORT = '5998';
const overridden = devServer('5999');
delete process.env.UI_PORT;
check('a suite runs on its own default port', defaults.port === '5999' && defaults.base === 'http://localhost:5999', defaults.base);
check('UI_PORT overrides it for a run', overridden.port === '5998' && overridden.base === 'http://localhost:5998', overridden.base);

// ── The helper takes only its own server ─────────────────────────────────────
/** A port nothing listens on, from the OS. */
async function freePort() {
  const probe = createTcpServer();
  await new Promise((resolve) => probe.listen(0, 'localhost', resolve));
  const { port } = probe.address();
  await new Promise((resolve) => probe.close(resolve));
  return String(port);
}

/** Something else serving `page` on `port`, bound the way Vite binds. */
async function occupy(port, page, onConnection) {
  const server = createServer((_request, response) => response.end(page));
  if (onConnection) server.on('connection', onConnection);
  await new Promise((resolve) => server.listen(Number(port), 'localhost', resolve));
  return server;
}

/** Take it down, kept-alive connections included, so nothing holds the run open. */
function release(server) {
  server.closeAllConnections();
  server.close();
}

/** The start's rejection message, or null when it started. */
async function refusal(server) {
  try {
    await server.start({ timeoutMs: 30_000 });
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  } finally {
    server.stop();
  }
}

const THIS_APP = readFileSync(path.join(ROOT, 'index.html'), 'utf8');

console.log('\nA port that already answers is refused');
{
  const port = await freePort();
  const other = await occupy(port, '<!doctype html><title>Tor to the World</title>');
  const message = await refusal(devServer(port));
  release(other);
  check('another project\'s app on the port is refused before anything starts', /already in use/.test(message ?? ''), message ?? 'it started');
}
{
  // Another checkout's dev server, or one a killed run left behind: the right
  // title, other code. The title check alone accepted exactly this.
  const port = await freePort();
  const other = await occupy(port, THIS_APP);
  const message = await refusal(devServer(port));
  release(other);
  check('this app served by a server the run did not start is refused too', /already in use/.test(message ?? ''), message ?? 'it started');
}

console.log('\nA server that appears after that first look is refused as well');
{
  // It drops the first connection, so the up-front look finds nothing, then
  // answers every later one — what a server that starts a moment after the
  // look would do. Vite cannot take the port (--strictPort), and what answers
  // there instead must not be tested.
  const port = await freePort();
  let connections = 0;
  const other = await occupy(port, '<!doctype html><title>Tor to the World</title>', (socket) => {
    if (connections++ === 0) socket.destroy();
  });
  const message = await refusal(devServer(port));
  release(other);
  check('it is refused', message !== null, 'it started');
  check('…by what the helper checks after starting, not the first look', message !== null && !/already in use/.test(message), message ?? '');
}

console.log('\nA free port gets this app, and gives the port back');
{
  const port = await freePort();
  const server = devServer(port);
  let started = false;
  try {
    await server.start({ timeoutMs: 60_000 });
    started = true;
  } catch (error) {
    check('the dev server starts', false, error instanceof Error ? error.message : String(error));
  }
  if (started) {
    const page = await fetch(server.base).then((response) => response.text()).catch(() => '');
    check('the dev server starts, and answers as this app', page.includes('<div id="root">'), page.slice(0, 120));
    server.stop();
    // Stopping must not leave Vite behind on the port for the next run to be refused on.
    let released = false;
    for (let i = 0; i < 20 && !released; i++) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      released = await fetch(server.base, { signal: AbortSignal.timeout(1_000) }).then(() => false, () => true);
    }
    check('stop() frees the port', released);
  }
}

console.log('\nA run stopped from outside takes its dev server down with it');
{
  // The aggregate runner's timeout sends SIGTERM, which skips every `finally`;
  // before the helper handled it, the run's Vite stayed on the port.
  const port = await freePort();
  const helper = new URL('../ui/dev-server.mjs', import.meta.url).href;
  const run = spawn(process.execPath, ['--input-type=module', '-e', `
    const { devServer } = await import(${JSON.stringify(helper)});
    await devServer(${JSON.stringify(port)}).start({ timeoutMs: 60000 });
    console.log('ready');
    setInterval(() => {}, 1000);
  `], { stdio: ['ignore', 'pipe', 'inherit'] });
  const ended = new Promise((resolve) => run.on('exit', (code, signal) => resolve(signal ?? code)));
  const ready = await Promise.race([
    new Promise((resolve) => run.stdout.on('data', (chunk) => { if (String(chunk).includes('ready')) resolve(true); })),
    ended.then(() => false),
  ]);
  check('a run starts its dev server', ready);
  if (ready) {
    run.kill('SIGTERM');
    const outcome = await ended;
    check('…and, sent SIGTERM, still ends as killed by it', outcome === 'SIGTERM', `ended with ${outcome}`);
    let released = false;
    for (let i = 0; i < 20 && !released; i++) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      released = await fetch(`http://localhost:${port}`, { signal: AbortSignal.timeout(1_000) }).then(() => false, () => true);
    }
    check('its dev server went with it', released, `Vite is still on port ${port}`);
  }
}

console.log('');
if (failures) {
  console.error(`FAILED: ${failures} check(s)`);
  process.exit(1);
}
console.log('All dev-server checks passed.');
