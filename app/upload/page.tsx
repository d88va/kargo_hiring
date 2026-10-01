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
    <form onSubmit={submit}>
      <h2>Upload CVs</h2>
      <div className="row">
        <select value={role} onChange={(e) => setRole(e.target.value as 'PM' | 'SPM')} style={{ width: 280 }}>
          <option value="PM">Applied for: Product Manager</option>
          <option value="SPM">Applied for: Senior Product Manager</option>
        </select>
        <input name="cv" type="file" accept=".pdf,.docx,.txt" multiple />
        <button disabled={busy}>{busy ? 'Working…' : 'Upload'}</button>
      </div>
      <p className="muted">All files in one go are tagged with the role above. PDF, DOCX or TXT.</p>
      <table><tbody>{items.map((i) => <tr key={i.name}><td>{i.name}</td><td>{i.status}</td></tr>)}</tbody></table>
    </form>
  );
}
