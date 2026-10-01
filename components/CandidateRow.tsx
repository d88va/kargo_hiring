'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type Row = {
  id: string; name: string | null; email: string | null; stage: string; error: string | null;
  appliedScore: number | null; otherScore: number | null; otherRole: string; appliedRole: string;
  scores: { name: string; weight: number; score: number; reason: string }[];
  brief: string | null;
  mail: { kind: string; subject: string; body: string; sent: boolean } | null;
};

export default function CandidateRow({ r, rank, threshold }: { r: Row; rank: number; threshold: number }) {
  const router = useRouter();
  const [subject, setSubject] = useState(r.mail?.subject ?? '');
  const [body, setBody] = useState(r.mail?.body ?? '');
  const [name, setName] = useState(r.name ?? '');
  const [email, setEmail] = useState(r.email ?? '');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function call(url: string, method: string, payload?: unknown) {
    setBusy(true); setMsg('');
    const res = await fetch(url, { method, body: payload ? JSON.stringify(payload) : undefined });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(j.error ?? 'Failed'); return false; }
    return true;
  }
  const savePii = async () => { if (await call(`/api/candidates/${r.id}/pii`, 'PATCH', { name, email })) { setMsg('Saved'); router.refresh(); } };
  const retry = async () => { setMsg('Processing…'); if (await call(`/api/candidates/${r.id}/process`, 'POST')) router.refresh(); };
  const send = async () => {
    if (!r.mail) return;
    if (!confirm(`Send this ${r.mail.kind} email to ${email}?`)) return;
    // Save current text first so what is on screen is exactly what goes out.
    if (!(await call(`/api/candidates/${r.id}/email`, 'PATCH', { subject, body }))) return;
    if (await call(`/api/candidates/${r.id}/send`, 'POST')) { setMsg('Sent'); router.refresh(); }
  };

  const above = r.appliedScore != null && r.appliedScore >= threshold;
  return (
    <details>
      <summary>
        <span className="muted">#{rank}</span>
        <span className="score">{r.appliedScore ?? '–'}</span>
        <span className="name">{r.name || 'Name not found'} <span className="muted">· {r.otherRole} fit {r.otherScore ?? '–'}</span></span>
        {r.stage === 'failed' && <span className="tag fail">failed</span>}
        {r.stage !== 'failed' && r.stage !== 'drafted' && <span className="tag">{r.stage}…</span>}
        {r.mail && <span className={`tag ${r.mail.kind}`}>{r.mail.sent ? 'sent' : r.mail.kind}</span>}
        {r.appliedScore != null && <span className="tag">{above ? 'above line' : 'below line'}</span>}
      </summary>
      <div className="body">
        {r.stage !== 'drafted' ? (
          <p className="err">{r.error ?? 'Not finished processing.'} <button className="sec" disabled={busy} onClick={retry}>Retry</button></p>
        ) : null}

        <h4>Interview brief</h4>
        <p>{r.brief ?? <span className="muted">No brief (only top candidates per role get one).</span>}</p>

        <h4>Scores ({r.appliedRole} rubric)</h4>
        <table><tbody>
          {r.scores.map((s) => <tr key={s.name}><td>{s.name} <span className="muted">({s.weight}%)</span></td><td>{s.score}/10</td><td>{s.reason}</td></tr>)}
        </tbody></table>

        <h4>Contact (private, never sent to AI)</h4>
        <div className="row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <button className="sec" disabled={busy} onClick={savePii}>Save</button>
        </div>

        {r.mail && (
          <>
            <h4>Draft email ({r.mail.kind})</h4>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={r.mail.sent} />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} disabled={r.mail.sent} style={{ marginTop: 8 }} />
            <div className="row">
              <button disabled={busy || r.mail.sent || !email} onClick={send}>{r.mail.sent ? 'Sent' : 'Send via Resend'}</button>
              <span className={msg === 'Sent' || msg === 'Saved' ? 'muted' : 'err'}>{msg}</span>
            </div>
          </>
        )}
      </div>
    </details>
  );
}
