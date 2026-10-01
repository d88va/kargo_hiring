import { MODEL, FOUNDER_SIGNOFF } from './config';
import type { Role } from './db';

// Calls Gemini over REST. Returns the raw text of the first candidate.
async function gemini(prompt: string, schema?: object, maxOutputTokens = 4000): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY! },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens, temperature: 0.3, ...(/flash/.test(MODEL) ? { thinkingConfig: { thinkingBudget: 0 } } : {}), ...(schema ? { responseMimeType: 'application/json', responseSchema: schema } : {}) },
    }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`Gemini error: ${j?.error?.message ?? res.status}`);
  const text = j?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  if (!text) throw new Error('Gemini returned no text: ' + (j?.promptFeedback?.blockReason ?? j?.candidates?.[0]?.finishReason ?? 'unknown'));
  return text.trim();
}

export type Criterion = { id: string; role: Role; position: number; name: string; description: string; weight: number };
export type ScoreRow = { criterion_id: string; score: number; reason: string };

const ROLE_LABEL: Record<Role, string> = { PM: 'Product Manager (2-4 yrs, first PM, zero scaffolding)', SPM: 'Senior Product Manager (5-8 yrs, sole owner, no committee)' };

function rubricText(criteria: Criterion[]) {
  return (['PM', 'SPM'] as Role[])
    .map((r) => `## ${ROLE_LABEL[r]}\n` + criteria.filter((c) => c.role === r).sort((a, b) => a.position - b.position)
      .map((c) => `${c.position}. ${c.name} (${c.weight}%): ${c.description}`).join('\n'))
    .join('\n\n');
}

const CONTEXT = `Kargo builds software for mid-sized freight forwarders and 3PLs (shipment tracking, documentation, carrier coordination). Series A, 40 people. Hiring for the first PM and a Senior PM, both reporting to the founder.`;

// The CV text passed in is always the REDACTED text. Personal details never reach this module.
export async function scoreCandidate(cv: string, criteria: Criterion[]): Promise<ScoreRow[]> {
  const schema = {
    type: 'OBJECT',
    properties: {
      scores: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            role: { type: 'STRING', enum: ['PM', 'SPM'] },
            position: { type: 'INTEGER' },
            score: { type: 'INTEGER' },
            reason: { type: 'STRING', description: 'One line, cites specific evidence from the CV, or states that evidence is absent.' },
          },
          required: ['role', 'position', 'score', 'reason'],
        },
      },
    },
    required: ['scores'],
  };

  const prompt = `${CONTEXT}

Score the candidate's CV against BOTH rubrics below, every criterion, regardless of which role they applied for.
Scale per criterion: 0-10. 0 = no evidence or contrary evidence; 3 = adjacent/weak evidence; 5 = some relevant evidence; 7 = clear, specific evidence; 9-10 = exceptional, quantified, directly on point.
Rules:
- Score only what the CV evidences. Absence of evidence scores low. Do not reward buzzwords, titles, or company prestige on their own.
- Do not consider name, gender, age, nationality, school prestige, or location.
- Experience in non-PM functions can earn partial credit only where it shows the actual behaviour the criterion describes.
- Each reason is ONE line and cites concrete evidence (or says what is missing).

RUBRICS
${rubricText(criteria)}

CV (personal details removed)
"""
${cv}
"""`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await gemini(prompt, schema, 8000); // real API errors propagate with their message
    let raw: { role: Role; position: number; score: number; reason: string }[] | undefined;
    try { raw = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')).scores; } catch { throw new Error('Gemini returned unparseable output: ' + text.slice(0, 200)); }
    if (!raw) continue;
    const rows: ScoreRow[] = [];
    for (const c of criteria) {
      const hit = raw.find((s) => s.role === c.role && s.position === c.position);
      if (hit) rows.push({ criterion_id: c.id, score: Math.max(0, Math.min(10, Math.round(hit.score))), reason: String(hit.reason).replace(/\s+/g, ' ').trim() });
    }
    if (rows.length === criteria.length) return rows;
  }
  throw new Error('Scoring failed: model did not return a score for every criterion');
}

export function weighted(rows: ScoreRow[], criteria: Criterion[], role: Role): number {
  let total = 0;
  for (const c of criteria.filter((c) => c.role === role)) {
    const s = rows.find((r) => r.criterion_id === c.id)?.score ?? 0;
    total += (s / 10) * c.weight;
  }
  return Math.round(total * 10) / 10;
}

function scoreSummary(rows: ScoreRow[], criteria: Criterion[], role: Role) {
  return criteria.filter((c) => c.role === role).sort((a, b) => a.position - b.position)
    .map((c) => { const r = rows.find((x) => x.criterion_id === c.id)!; return `- ${c.name}: ${r.score}/10 — ${r.reason}`; }).join('\n');
}

export async function writeBrief(cv: string, role: Role, rows: ScoreRow[], criteria: Criterion[]): Promise<string> {
  return gemini(`${CONTEXT}

Write a three-sentence interview brief for the founder about this candidate, who applied for ${ROLE_LABEL[role]}.
Sentence 1: the strongest evidence in their favour. Sentence 2: the biggest gap or risk. Sentence 3: the one thing to probe in the interview, phrased as a question to ask.
Exactly three sentences, plain text, no headings, no bullets. Refer to them as "the candidate" or "they". Do not invent facts.

Scores
${scoreSummary(rows, criteria, role)}

CV (personal details removed)
"""
${cv}
"""`, undefined, 1500);
}

export type EmailKind = 'invite' | 'rejection';

// Returns a template containing the literal {{first_name}} placeholder.
// The real name is substituted from stored personal details outside this module.
export async function draftEmail(cv: string, role: Role, kind: EmailKind, rows: ScoreRow[], criteria: Criterion[]): Promise<{ subject: string; body: string }> {
  const schema = { type: 'OBJECT', properties: { subject: { type: 'STRING' }, body: { type: 'STRING' } }, required: ['subject', 'body'] };
  const roleName = role === 'PM' ? 'Product Manager' : 'Senior Product Manager';
  const guide = kind === 'invite'
    ? `An interview invitation. Mention one or two specific things from their CV that stood out. Say we'd like to speak, ask them to reply with a few time slots in the coming week (the role is in-office in Mumbai; first conversation can be on a call). Do not promise an offer.`
    : `A warm, honest rejection. Thank them, mention one specific genuine strength from their CV, and say plainly that we are going ahead with candidates whose experience is a closer match right now. Do not share scores, rubric details, or false promises to keep in touch. No clichés like "unfortunately we regret".`;

  const out = JSON.parse(await gemini(`${CONTEXT}

Draft an email from the founder, Arjun, to a candidate who applied for the ${roleName} role at Kargo.
Type: ${guide}
Requirements:
- Address them with the exact literal text {{first_name}} (e.g. "Hi {{first_name}},"). Never write a real name; the system fills it in. The CV below has had the name removed.
- 90-150 words, plain text, personal and specific to this CV, no bullet lists, no markdown.
- Sign off exactly as:
${FOUNDER_SIGNOFF}

What we learned from scoring (for your context; do not quote numbers)
${scoreSummary(rows, criteria, role)}

CV (personal details removed)
"""
${cv}
"""`, schema, 3000)) as { subject: string; body: string };
  let body = out.body.trim();
  if (!body.includes('{{first_name}}')) body = `Hi {{first_name}},\n\n${body}`;
  return { subject: out.subject.trim(), body };
}
