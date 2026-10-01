import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Delete a candidate and everything attached (pii, scores, brief, email cascade).
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const { error } = await db.from('candidates').delete().eq('id', params.id);
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
}
