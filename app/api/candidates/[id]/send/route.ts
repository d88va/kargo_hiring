import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { db } from '@/lib/db';
import { renderBody } from '@/lib/pipeline';

// The only place an email leaves the system. Triggered only by the founder's button click.
export async function POST(_: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) return NextResponse.json({ error: 'Email sending is not set up yet (add RESEND_API_KEY and RESEND_FROM in Vercel).' }, { status: 503 });
  const [{ data: mail }, { data: pii }] = await Promise.all([
    db.from('emails').select('*').eq('candidate_id', id).single(),
    db.from('candidate_pii').select('name, email').eq('candidate_id', id).single(),
  ]);
  if (!mail || !pii) return NextResponse.json({ error: 'No draft found' }, { status: 404 });
  if (mail.sent_at) return NextResponse.json({ error: 'Already sent' }, { status: 409 });
  if (!pii.email) return NextResponse.json({ error: 'No email address on file. Add one first.' }, { status: 400 });

  // Claim the row first so a double-click cannot send twice.
  const { data: claimed } = await db.from('emails').update({ sent_at: new Date().toISOString() })
    .eq('candidate_id', id).is('sent_at', null).select('candidate_id');
  if (!claimed?.length) return NextResponse.json({ error: 'Already sent' }, { status: 409 });

  const text = mail.body_edited ?? renderBody(mail.body_template, pii.name);
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM!,
    to: pii.email,
    replyTo: process.env.RESEND_REPLY_TO || undefined,
    subject: mail.subject,
    text,
  });
  if (error) {
    await db.from('emails').update({ sent_at: null }).eq('candidate_id', id);
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
  await db.from('emails').update({ resend_id: data?.id }).eq('candidate_id', id);
  return NextResponse.json({ ok: true });
}
