// Split a .sql file into the statements the Neon HTTP driver can send.
//
// The driver has no multi-statement mode, so a backfill has to be sent one
// statement at a time — which means something has to decide where a statement
// ends. A bare `.split(';')` cannot: it treats a semicolon inside a quoted
// string as a boundary and cuts the row in half. That is not hypothetical, it
// is what happened here — three JSON payloads in the intake-compliance backfill
// contain phrases like "exceeds standard threshold; VP approval required", and
// PostgreSQL rejected the fragments with `42601 unterminated quoted string`.
//
// Stripping comments has the same requirement in reverse: a line filter that
// drops anything starting with `--` will happily delete a line out of the
// middle of a multi-line string literal. That failure is worse, because it
// writes wrong data rather than raising.
//
// So both decisions are made in one left-to-right pass that tracks what it is
// inside. This module is pure and has no connection of its own, so
// tests/integration/sql-splitter.mjs can import it without a database.

/** Statements PostgreSQL rejects over the HTTP driver: it manages the transaction. */
const TRANSACTION_CONTROL = /^(BEGIN|COMMIT|END|START\s+TRANSACTION)$/i;

/**
 * Statements from a SQL script: comments removed, transaction control dropped,
 * and semicolons honoured only where one actually ends a statement.
 *
 * @param {string} source
 * @returns {string[]}
 */
export function splitStatements(source) {
  const statements = [];
  let current = '';
  let index = 0;

  const push = () => {
    const statement = current.trim();
    // A file ending in `;` leaves an empty tail, and the BEGIN/COMMIT wrapper
    // is the driver's job — neither is a statement to send.
    if (statement && !TRANSACTION_CONTROL.test(statement)) statements.push(statement);
    current = '';
  };

  while (index < source.length) {
    const character = source[index];

    // A single-quoted literal. Everything inside is data, including `;` and
    // `--`; `''` is an escaped quote and does not end it.
    if (character === "'") {
      const start = index;
      index += 1;
      while (index < source.length) {
        if (source[index] === "'") {
          if (source[index + 1] === "'") { index += 2; continue; }
          index += 1;
          break;
        }
        index += 1;
      }
      current += source.slice(start, index);
      continue;
    }

    // A double-quoted identifier. Rare in a backfill, but `"odd;name"` is a
    // legal column and must not split either.
    if (character === '"') {
      const close = source.indexOf('"', index + 1);
      const end = close === -1 ? source.length : close + 1;
      current += source.slice(index, end);
      index = end;
      continue;
    }

    // Dollar quoting ($$…$$ or $tag$…$tag$). Nothing in this repo uses it yet;
    // a function body would, and it must not be scanned for quotes or comments.
    const dollarTag = character === '$' ? /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(source.slice(index)) : null;
    if (dollarTag) {
      const tag = dollarTag[0];
      const close = source.indexOf(tag, index + tag.length);
      const end = close === -1 ? source.length : close + tag.length;
      current += source.slice(index, end);
      index = end;
      continue;
    }

    // Comments, recognised only out here — inside a literal they are text.
    if (source.startsWith('--', index)) {
      const newline = source.indexOf('\n', index);
      index = newline === -1 ? source.length : newline;
      continue;
    }
    if (source.startsWith('/*', index)) {
      const close = source.indexOf('*/', index + 2);
      index = close === -1 ? source.length : close + 2;
      continue;
    }

    if (character === ';') {
      push();
      index += 1;
      continue;
    }

    current += character;
    index += 1;
  }

  // A final statement with no trailing semicolon is still a statement.
  push();
  return statements;
}
