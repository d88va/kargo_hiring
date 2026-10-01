# Kargo hiring dashboard

Next.js 14 + Supabase + Gemini + Resend. Single user, password-gated.

## Setup
1. Install Node 20 (https://nodejs.org), then `npm install`.
2. Create a Supabase project, run `supabase/schema.sql` in the SQL editor. This creates the tables and seeds the PM and SPM rubrics (weights are verified to total 100 per role).
3. `cp .env.local.example .env.local` and fill it in.
4. `npm run dev`, open http://localhost:3000.
5. Deploy: `npx vercel`, set the same env vars in the project settings.

## Flow
Upload CV + role -> `lib/pii.ts` splits name/email/phone (stored in `candidate_pii`) from the redacted text (`candidates.cv_text`) -> `lib/pipeline.ts`: score vs both rubrics, brief for top 3 per role, email draft (invite >= 65 on applied-role score, else rejection) -> dashboard -> founder clicks Send (Resend).

## Privacy
- AI modules only receive `cv_text`. `candidate_pii` is read only by the dashboard page and the send route.
- Emails are drafted with a `{{first_name}}` placeholder; the real name is substituted at display/send time.
- RLS is on for all tables with no policies; only the server's service role key can read.

## Notes
- Resend: until you verify a sending domain, Resend only delivers to your own account email.
- Name extraction is heuristic. Check the name/email in the Contact box on each candidate (editable).
- Tunables: SCORE_THRESHOLD, TOP_N_BRIEFS, GEMINI_MODEL.
- Upload processes one CV at a time (about 30s each) to stay inside Vercel's 60s function limit.
