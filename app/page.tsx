import Link from 'next/link';
import { db, ROLES, Role } from '@/lib/db';
import { renderBody } from '@/lib/pipeline';
import { SCORE_THRESHOLD } from '@/lib/config';
import CandidateRow, { Row } from '@/components/CandidateRow';

export const dynamic = 'force-dynamic';

export default async function Dashboard({ searchParams }: { searchParams: { role?: string } }) {
  const filter = searchParams.role === 'PM' || searchParams.role === 'SPM' ? searchParams.role : 'ALL';
  const results = await Promise.all([
    db.from('candidates').select('id, role_applied, stage, error, pm_score, spm_score'),
    db.from('candidate_pii').select('candidate_id, name, email'),
    db.from('rubric_criteria').select('id, role, position, name, weight'),
    db.from('scores').select('candidate_id, criterion_id, score, reason'),
    db.from('briefs').select('candidate_id, body'),
    db.from('emails').select('candidate_id, kind, subject, body_template, body_edited, sent_at'),
  ]);
  const errors = results.map((r) => r.error?.message).filter(Boolean);
  const [{ data: cands }, { data: pii }, { data: crit }, { data: scores }, { data: briefs }, { data: emails }] = results;

  const byId = <T extends Record<string, any>>(rows: T[] | null, key = 'candidate_id') => new Map((rows ?? []).map((r) => [r[key], r]));
  const piiMap = byId(pii), briefMap = byId(briefs), mailMap = byId(emails);

  const build = (c: any): Row => {
    const role = c.role_applied as Role;
    const other: Role = role === 'PM' ? 'SPM' : 'PM';
    const p: any = piiMap.get(c.id), m: any = mailMap.get(c.id);
    const mine = (crit ?? []).filter((x: any) => x.role === role).sort((a: any, b: any) => a.position - b.position);
    return {
      id: c.id, name: p?.name ?? null, email: p?.email ?? null, stage: c.stage, error: c.error,
      appliedScore: c[role === 'PM' ? 'pm_score' : 'spm_score'] != null ? Number(c[role === 'PM' ? 'pm_score' : 'spm_score']) : null,
      otherScore: c[other === 'PM' ? 'pm_score' : 'spm_score'] != null ? Number(c[other === 'PM' ? 'pm_score' : 'spm_score']) : null,
      otherRole: other, appliedRole: role,
      scores: mine.map((k: any) => {
        const s: any = (scores ?? []).find((x: any) => x.candidate_id === c.id && x.criterion_id === k.id);
        return { name: k.name, weight: k.weight, score: s?.score ?? 0, reason: s?.reason ?? '' };
      }).filter((s: any) => s.reason),
      brief: (briefMap.get(c.id) as any)?.body ?? null,
      mail: m ? { kind: m.kind, subject: m.subject, body: m.body_edited ?? renderBody(m.body_template, p?.name ?? null), sent: !!m.sent_at } : null,
    };
  };

  const all = (cands ?? []) as any[];
  const score = (c: any) => Number(c[c.role_applied === 'PM' ? 'pm_score' : 'spm_score']);
  const above = all.filter((c) => c.stage !== 'failed' && (c.pm_score != null || c.spm_score != null) && score(c) >= SCORE_THRESHOLD).length;
  const waiting = all.filter((c) => { const m: any = mailMap.get(c.id); return m && !m.sent_at; }).length;
  const tab = (value: string, label: string) => (
    <Link href={value === 'ALL' ? '/' : `/?role=${value}`} className={filter === value ? 'on' : ''}>{label}</Link>
  );

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Candidates</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>Ranked by score for the role they applied to. Nothing is sent until you click Send.</p>
        </div>
        <div className="seg">{tab('ALL', 'All')}{tab('PM', 'Product Manager')}{tab('SPM', 'Senior PM')}</div>
      </div>
      {errors.length > 0 && <p className="err">Database error: {errors.join(' | ')}</p>}
      <div className="stats">
        <div className="stat"><small>Candidates</small><b>{all.length}</b></div>
        <div className="stat"><small>Above the line ({SCORE_THRESHOLD})</small><b style={{ color: '#14573C' }}>{above}</b></div>
        <div className="stat"><small>Emails waiting to send</small><b>{waiting}</b></div>
      </div>
      {all.length === 0 && <p>No candidates yet. <Link href="/upload">Upload CVs</Link>.</p>}
      {ROLES.filter((r) => filter === 'ALL' || filter === r).map((role) => {
        const rows = all.filter((c) => c.role_applied === role).map(build)
          .sort((a, b) => (b.appliedScore ?? -1) - (a.appliedScore ?? -1));
        if (!rows.length) return null;
        return (
          <section key={role}>
            <h2>{role === 'PM' ? 'Product Manager' : 'Senior Product Manager'} <span className="muted" style={{ fontWeight: 400, fontSize: 14 }}>· {rows.length}</span></h2>
            <div className="cols"><span>#</span><span>Score</span><span>Candidate</span><span>{role === 'PM' ? 'SPM' : 'PM'} fit</span><span>Email</span><span></span></div>
            {rows.map((r, i) => <CandidateRow key={r.id} r={r} rank={i + 1} threshold={SCORE_THRESHOLD} />)}
          </section>
        );
      })}
    </>
  );
}
