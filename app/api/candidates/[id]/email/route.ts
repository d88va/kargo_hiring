import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Founder edits the draft before sending.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { subject, body } = await req.json();
  const { data: row } = await db.from('emails').select('sent_at').eq('candidate_id', params.id).single();
  if (row?.sent_at) return NextResponse.json({ error: 'Already sent' }, { status: 409 });
  const { error } = await db.from('emails').update({ subject, body_edited: body }).eq('candidate_id', params.id);
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
}
