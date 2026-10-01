import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractText } from '@/lib/parse';
import { splitCv } from '@/lib/pii';

export const maxDuration = 30;

// Step 0: read the CV, split personal details from everything else, store both separately.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get('cv');
  const role = form.get('role');
  if (!(file instanceof File) || (role !== 'PM' && role !== 'SPM')) {
    return NextResponse.json({ error: 'CV file and role (PM or SPM) are required' }, { status: 400 });
  }
  try {
    const raw = await extractText(file);
    if (raw.trim().length < 100) throw new Error('Could not read text from this file (scanned PDF?)');
    const { pii, redacted } = splitCv(raw, file.name);

    const { data: cand, error } = await db.from('candidates')
      .insert({ role_applied: role, cv_text: redacted, cv_filename: null }).select('id').single();
    if (error) throw error;
    const p = await db.from('candidate_pii').insert({ candidate_id: cand.id, ...pii });
    if (p.error) { await db.from('candidates').delete().eq('id', cand.id); throw p.error; }
    return NextResponse.json({ id: cand.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Upload failed' }, { status: 422 });
  }
}
