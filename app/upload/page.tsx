'use client';
import { useState } from 'react';

type Item = { name: string; status: string };

export default function Upload() {
  const [role, setRole] = useState<'PM' | 'SPM'>('PM');
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const files = Array.from((e.currentTarget.elements.namedItem('cv') as HTMLInputElement).files ?? []);
    if (!files.length) return;
    setBusy(true);
    setItems(files.map((f) => ({ name: f.name, status: 'queued' })));
    const set = (i: number, status: string) => setItems((p) => p.map((x, j) => (j === i ? { ...x, status } : x)));
    for (let i = 0; i < files.length; i++) {
      set(i, 'reading CV…');
      const fd = new FormData(); fd.set('cv', files[i]); fd.set('role', role);
      const up = await fetch('/api/upload', { method: 'POST', body: fd });
      const j = await up.json();
      if (!up.ok) { set(i, 'failed: ' + j.error); continue; }
      set(i, 'scoring, briefing, drafting… (about 30s)');
      const pr = await fetch(`/api/candidates/${j.id}/process`, { method: 'POST' });
      set(i, pr.ok ? 'done' : 'failed: ' + (await pr.json()).error + ' (retry from dashboard)');
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="upl">
      <h1>Upload CVs</h1>
      <p className="muted" style={{ margin: '4px 0 24px' }}>Personal details are split off and stored privately. Only the rest of the CV is scored.</p>
      <p className="lbl">Applied for</p>
      <div className="seg" style={{ marginBottom: 20 }}>
        {(['PM', 'SPM'] as const).map((r) => (
          <a key={r} className={role === r ? 'on' : ''} onClick={() => setRole(r)} style={{ flex: 1, textAlign: 'center', cursor: 'pointer', padding: '8px 14px' }}>
            {r === 'PM' ? 'Product Manager' : 'Senior Product Manager'}
          </a>
        ))}
      </div>
      <div className="drop">
        <input name="cv" type="file" accept=".pdf,.docx,.txt" multiple style={{ border: 0, background: 'transparent' }} />
        <div className="muted" style={{ fontSize: 14, marginTop: 6 }}>PDF, DOCX or TXT. Several at once are fine and all get the role above.</div>
      </div>
      <div className="files">{items.map((i) => <div key={i.name}><span>{i.name}</span><span className="muted">{i.status}</span></div>)}</div>
      <div style={{ marginTop: 20 }}><button disabled={busy}>{busy ? 'Working…' : 'Upload'}</button></div>
    </form>
  );
}
