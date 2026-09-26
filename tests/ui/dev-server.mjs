// The one way a browser suite starts this app's dev server: on a port of its
// own, and tested only once what answers there is the server this run started,
// serving this app.
//
// The suites used to share Vite's default 5173 and probe it. With another
// project's dev server already there, Vite moved ours to the next free port and
// the probe found the other project: a suite failed against a page titled
// "Tor to the World" (2026-09-26), and a sweep that only looks for crashes could
// have passed against it.
//
// Each suite names its default port — `npm run test:ui-ports` keeps them
// distinct and away from 5173 — and UI_PORT overrides it for a run.

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Read from index.html rather than restated: renaming the product must not
// turn every suite into a report that its own port serves "another app".
const TITLE = readFileSync(new URL('../../index.html', import.meta.url), 'utf8').match(/<title>[^<]*<\/title>/)?.[0];
if (!TITLE) throw new Error('index.html has no <title>, so a dev server cannot be recognised as this app');

/**
 * The dev server for one suite: `base` is known at once for building URLs;
 * nothing listens until `start()`.
 */
export function devServer(defaultPort) {
  const port = process.env.UI_PORT || defaultPort;
  const base = `http://localhost:${port}`;
  let child = null;
  let exited = false;

  return {
    port,
    base,
    /** Resolves once this app answers on the port; rejects with the reason otherwise. */
    async start({ timeoutMs = 40_000 } = {}) {
      // Refused even when it answers as this app. A server this run did not
      // start may be another checkout's, or one a killed run left behind, and
      // it serves that code rather than the code under test. The title check
      // alone took exactly that: an orphaned dev server from another checkout
      // held 5188 for three weeks, and the probe accepted it on its first try,
      // before our Vite had even failed to start. Two runs starting on one port
      // within a second of each other can still race past this; it is aimed at
      // servers that were already there.
      if (await answer(base)) {
        throw new Error(`Port ${port} is already in use (lsof -iTCP:${port} -sTCP:LISTEN names it). Stop it, or set UI_PORT to a free port.`);
      }
      // --strictPort: a taken port fails this start instead of quietly moving it.
      child = spawn('npm', ['run', 'dev', '--', '--port', port, '--strictPort'], { stdio: 'ignore' });
      child.on('exit', () => { exited = true; });
      // A run stopped from outside skips every `finally` — the aggregate
      // runner's timeout sends SIGTERM — and its `npm run dev` outlived it,
      // holding the port for the next run to be refused on. That is how 5188
      // was held. Take the server down, then die of the signal as before.
      for (const signal of ['SIGINT', 'SIGTERM']) {
        process.once(signal, () => {
          child.kill('SIGTERM');
          process.kill(process.pid, signal);
        });
      }

      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (exited) throw new Error(`The dev server did not start — is port ${port} in use? Set UI_PORT to a free port.`);
        const response = await answer(base);
        if (response?.ok) {
          // Something answering is not enough: it has to be this app.
          if (!response.page.includes(TITLE)) throw new Error(`Port ${port} is serving another app. Set UI_PORT to a free port.`);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      throw new Error(`The dev server did not become ready at ${base} within ${timeoutMs}ms`);
    },
    stop() {
      child?.kill('SIGTERM');
    },
  };
}

/** What answers at `url`, or null when nothing does (yet). */
async function answer(url) {
  try {
    // Bounded, so a listener that accepts and never replies cannot hang the wait.
    const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    return { ok: response.ok, page: await response.text() };
  } catch {
    return null;
  }
}
