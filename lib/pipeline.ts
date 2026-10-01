import { db, Role } from './db';
import { scoreCandidate, weighted, writeBrief, draftEmail, Criterion, ScoreRow } from './ai';
import { SCORE_THRESHOLD, TOP_N_BRIEFS } from './config';

// Runs the automatic steps for one candidate, resuming from wherever it stopped.
// Only candidates.cv_text (redacted) is read here; candidate_pii is never touched.
export async function processCandidate(id: string) {
  try {
    const { data: cand, error } = await db.from('candidates').select('*').eq('id', id).single();
    if (error || !cand) throw new Error('Candidate not found');
    const role = cand.role_applied as Role;

    const { data: criteria } = await db.from('rubric_criteria').select('*');
    const crit = (criteria ?? []) as Criterion[];
    if (crit.length === 0) throw new Error('Rubric table is empty. Run supabase/schema.sql.');

    // 1. Score against both rubrics
    let { data: existing } = await db.from('scores').select('criterion_id, score, reason').eq('candidate_id', id);
    if (!existing || existing.length !== crit.length) {
      const rows = await scoreCandidate(cand.cv_text, crit);
      await db.from('scores').delete().eq('candidate_id', id);
      const ins = await db.from('scores').insert(rows.map((r) => ({ ...r, candidate_id: id })));
      if (ins.error) throw ins.error;
      await db.from('candidates').update({ pm_score: weighted(rows, crit, 'PM'), spm_score: weighted(rows, crit, 'SPM'), stage: 'scored', error: null }).eq('id', id);
      existing = rows;
    }
    const rows = existing as ScoreRow[];
    const appliedScore = weighted(rows, crit, role);

    // 2. Brief if in the top N for the applied role
    const key = role === 'PM' ? 'pm_score' : 'spm_score';
    const { data: peers } = await db.from('candidates').select(`id, ${key}`).eq('role_applied', role).not(key, 'is', null);
    const better = (peers ?? []).filter((p: any) => p.id !== id && Number(p[key]) > appliedScore).length;
    if (better < TOP_N_BRIEFS) {
      const { data: haveBrief } = await db.from('briefs').select('candidate_id').eq('candidate_id', id).maybeSingle();
      if (!haveBrief) {
        const body = await writeBrief(cand.cv_text, role, rows, crit);
        await db.from('briefs').insert({ candidate_id: id, body });
      }
    }
    await db.from('candidates').update({ stage: 'briefed' }).eq('id', id);

    // 3. Draft email: invite above the line, rejection below
    const { data: haveEmail } = await db.from('emails').select('candidate_id').eq('candidate_id', id).maybeSingle();
    if (!haveEmail) {
      const kind = appliedScore >= SCORE_THRESHOLD ? 'invite' : 'rejection';
      const mail = await draftEmail(cand.cv_text, role, kind, rows, crit);
      await db.from('emails').insert({ candidate_id: id, kind, subject: mail.subject, body_template: mail.body });
    }
    await db.from('candidates').update({ stage: 'drafted', error: null }).eq('id', id);
  } catch (e: any) {
    await db.from('candidates').update({ stage: 'failed', error: String(e?.message ?? e).slice(0, 500) }).eq('id', id);
    throw e;
  }
}

export const renderBody = (template: string, name: string | null) =>
  template.replaceAll('{{first_name}}', (name ?? '').split(/\s+/)[0] || 'there');
