import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Fix a mis-read name or missing email. Personal details stay in candidate_pii.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { name, email } = await req.json();
  const patch: Record<string, string> = {};
  if (typeof name === 'string') patch.name = name.trim();
  if (typeof email === 'string') {
    if (email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    patch.email = email.trim();
  }
  const { error } = await db.from('candidate_pii').update(patch).eq('candidate_id', params.id);
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
}
