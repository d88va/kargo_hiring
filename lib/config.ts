export const SCORE_THRESHOLD = Number(process.env.SCORE_THRESHOLD ?? 65); // "the line"
export const TOP_N_BRIEFS = Number(process.env.TOP_N_BRIEFS ?? 3);
export const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
export const FOUNDER_SIGNOFF = 'Arjun Mehta\nFounder, Kargo';
