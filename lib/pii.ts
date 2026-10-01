// Splits a CV into (a) personal details and (b) redacted text. Pure code, no AI.
// Only the redacted text may ever be passed to an AI step.

export type Pii = { name: string | null; email: string | null; phone: string | null };

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,5}\)?[\s.-]?)?\d{3,5}[\s.-]?\d{3,5}/g;
const URL_RE = /(?:https?:\/\/|www\.)\S+|(?:linkedin|github|twitter|x|medium|behance)\.com\/\S+/gi;
const STOP = /resume|curriculum|vitae|\bcv\b|profile|summary|experience|education|contact|email|phone|address|objective|skills/i;

function phoneCandidates(text: string): string[] {
  return (text.match(PHONE_RE) ?? []).filter((m) => m.replace(/\D/g, '').length >= 10 && m.replace(/\D/g, '').length <= 15);
}

function guessName(lines: string[], email: string | null): string | null {
  for (const line of lines.slice(0, 8)) {
    const l = line.trim();
    if (!l || l.length > 50 || STOP.test(l) || /[\d@:/|·•—]/.test(l)) continue;
    const words = l.split(/\s+/);
    if (words.length < 1 || words.length > 4) continue;
    if (!words.every((w) => /^[A-Za-z.'’-]+$/.test(w))) continue;
    return words.map((w) => (w === w.toUpperCase() ? w[0] + w.slice(1).toLowerCase() : w)).join(' ');
  }
  if (email) {
    const local = email.split('@')[0];
    const parts = local.split(/[._-]/).filter((p) => /^[a-z]{2,}$/i.test(p));
    if (parts.length >= 2) return parts.slice(0, 2).map((p) => p[0].toUpperCase() + p.slice(1).toLowerCase()).join(' ');
  }
  return null;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function splitCv(raw: string): { pii: Pii; redacted: string } {
  const text = raw.replace(/\r/g, '');
  const email = text.match(EMAIL_RE)?.[0] ?? null;
  const phone = phoneCandidates(text)[0]?.trim() ?? null;
  const name = guessName(text.split('\n'), email);

  let out = text.replace(EMAIL_RE, '[email removed]').replace(URL_RE, '[link removed]');
  for (const p of phoneCandidates(text)) out = out.split(p).join('[phone removed]');
  if (name) {
    out = out.replace(new RegExp(`\\b${escapeRe(name).replace(/\s+/g, '\\s+')}\\b`, 'gi'), '[CANDIDATE]');
    for (const part of name.split(/\s+/).filter((p) => p.length >= 3)) {
      out = out.replace(new RegExp(`\\b${escapeRe(part)}\\b`, 'gi'), '[CANDIDATE]');
    }
  }
  return { pii: { name, email, phone }, redacted: out.replace(/\n{3,}/g, '\n\n').trim() };
}
