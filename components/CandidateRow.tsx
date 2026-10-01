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

export default function CandidateRow({ r, rank, threshold, defaultOpen = false }: { r: Row; rank: number; threshold: number; defaultOpen?: boolean }) {
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
  const del = async () => {
    if (!confirm('Delete this candidate and all their data?')) return;
    if (await call(`/api/candidates/${r.id}`, 'DELETE')) router.refresh();
  };
  const send = async () => {
    if (!r.mail) return;
    if (!confirm(`Send this ${r.mail.kind} email to ${email}?`)) return;
    // Save current text first so what is on screen is exactly what goes out.
    if (!(await call(`/api/candidates/${r.id}/email`, 'PATCH', { subject, body }))) return;
    if (await call(`/api/candidates/${r.id}/send`, 'POST')) { setMsg('Sent'); router.refresh(); }
  };

  const above = r.appliedScore != null && r.appliedScore >= threshold;
  const chip = r.stage === 'failed' ? { c: 'fail', t: 'Failed' }
    : r.stage !== 'drafted' ? { c: '', t: 'Processing…' }
    : r.mail?.sent ? { c: 'sent', t: 'Sent' }
    : r.mail ? { c: r.mail.kind === 'invite' ? 'invite' : '', t: r.mail.kind === 'invite' ? 'Invite' : 'Rejection' }
    : { c: '', t: '–' };
  return (
    <details open={defaultOpen}>
      <summary>
        <span className="muted">{rank}</span>
        <span className="scorecell"><b>{r.appliedScore ?? '–'}</b><span className="bar"><i style={{ width: `${r.appliedScore ?? 0}%` }} /></span></span>
        <span style={{ fontWeight: 600 }}>{r.name || 'Name not found'}{r.appliedScore != null && <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}> · {above ? 'above line' : 'below line'}</span>}</span>
        <span className="muted">{r.otherScore ?? '–'}</span>
        <span><span className={`chip ${chip.c}`}>{chip.t}</span></span>
        <span className="muted">⌄</span>
      </summary>
      <div className="body">
        <div>
          {r.stage !== 'drafted' && (
            <p className="err">{r.error ?? 'Not finished processing.'} <button className="sec" disabled={busy} onClick={retry}>Retry</button></p>
          )}
          <p className="lbl">Interview brief</p>
          <p style={{ margin: '0 0 24px' }}>{r.brief ?? <span className="muted">No brief (only the top candidates per role get one).</span>}</p>

          <p className="lbl">Scores · {r.appliedRole} rubric</p>
          {r.scores.map((x) => (
            <div className="crit" key={x.name}>
              <div className="h"><span>{x.name} <span className="muted">({x.weight}%)</span></span><b>{x.score}</b></div>
              <div className="bar"><i style={{ width: `${x.score * 10}%` }} /></div>
              <div className="r">{x.reason}</div>
            </div>
          ))}

          <p className="lbl" style={{ marginTop: 24 }}>Contact · private, never sent to AI</p>
          <div className="row">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" autoComplete="off" name="cand-name" />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="off" name="cand-email" type="text" />
            <button className="sec" disabled={busy} onClick={savePii}>Save</button>
          </div>
          <p style={{ marginTop: 16 }}><button className="sec" disabled={busy} onClick={del}>Delete candidate</button></p>
        </div>

        {r.mail && (
          <div className="mail">
            <p className="lbl" style={{ margin: 0 }}>Draft email · {r.mail.kind}</p>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={r.mail.sent} />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} disabled={r.mail.sent} />
            <div className="row">
              <button disabled={busy || r.mail.sent || !email} onClick={send}>{r.mail.sent ? 'Sent' : 'Send via Resend'}</button>
              <span className={msg === 'Sent' || msg === 'Saved' ? 'muted' : 'err'}>{msg || (r.mail.sent ? '' : 'Asks you to confirm first')}</span>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
