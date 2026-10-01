import { createClient } from '@supabase/supabase-js';

// Server-only. Uses the service role key; never import from a client component.
export const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

export type Role = 'PM' | 'SPM';
export const ROLES: Role[] = ['PM', 'SPM'];
