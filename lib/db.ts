import { createClient } from '@supabase/supabase-js';

// Server-only. Uses the service role key; never import from a client component.
export const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
  // Next.js caches fetch() by default, which made the dashboard show stale rows. Never cache DB reads.
  global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
});

export type Role = 'PM' | 'SPM';
export const ROLES: Role[] = ['PM', 'SPM'];
