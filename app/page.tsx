import Link from 'next/link';
import { db, ROLES, Role } from '@/lib/db';
import { renderBody } from '@/lib/pipeline';
import { SCORE_THRESHOLD } from '@/lib/config';
import CandidateRow, { Row } from '@/components/CandidateRow';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const [{ data: cands }, { data: pii }, { data: crit }, { data: scores }, { data: briefs }, { data: emails }] = await Promise.all([
    db.from('candidates').select('id, role_applied, stage, error, pm_score, spm_score'),
    db.from('candidate_pii').select('candidate_id, name, email'),
    db.from('rubric_criteria').select('id, role, position, name, weight'),
    db.from('scores').select('candidate_id, criterion_id, score, reason'),
    db.from('briefs').select('candidate_id, body'),
    db.from('emails').select('candidate_id, kind, subject, body_template, body_edited, sent_at'),
  ]);

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

  return (
    <>
      {(cands ?? []).length === 0 && <p>No candidates yet. <Link href="/upload">Upload CVs</Link>.</p>}
      {ROLES.map((role) => {
        const rows = (cands ?? []).filter((c: any) => c.role_applied === role).map(build)
          .sort((a, b) => (b.appliedScore ?? -1) - (a.appliedScore ?? -1));
        if (!rows.length) return null;
        return (
          <section key={role}>
            <h2>{role === 'PM' ? 'Product Manager' : 'Senior Product Manager'} <span className="muted">({rows.length}, line at {SCORE_THRESHOLD})</span></h2>
            {rows.map((r, i) => <CandidateRow key={r.id} r={r} rank={i + 1} threshold={SCORE_THRESHOLD} />)}
          </section>
        );
      })}
    </>
  );
}
