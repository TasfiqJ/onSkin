/**
 * Supabase `Database` type.
 *
 * BLOCKED: B-SUPABASE — regenerate from the live project with:
 *   supabase gen types typescript --project-id <ref> > packages/types/src/database.types.ts
 *
 * Until the project exists this is hand-authored to match the migrations in
 * `supabase/migrations/` so the client is fully typed during development.
 * Populated in the data-model slice.
 */

// Placeholder until the data-model migrations land (next slice).
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = Record<string, never>;
