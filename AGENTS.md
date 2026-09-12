# Agent instructions

The project's ground rules live in **[CLAUDE.md](CLAUDE.md)**. Read that file; it
is the single source of truth for how to work in this repo.

This file used to be a copy of it, and the copy went stale: it still described a
Supabase backend (the store has been private Neon since 2026-09-02, ADR-0003),
listed React Hook Form and Zod as dependencies (never imported, removed), and
said the determination screen was the endpoint (governed checkout creates the
internal request → requisition → purchase-order chain, ADR-0002). Two files
stating different rules is worse than one, so this is a pointer now.
