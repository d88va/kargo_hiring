-- Kargo hiring dashboard schema. Run once in the Supabase SQL editor.
-- All access is server-side via the service role key. RLS is enabled on every
-- table with NO policies, so the anon key can read nothing.

create extension if not exists pgcrypto;

-- ---------- Rubric ----------
create table if not exists rubric_criteria (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('PM','SPM')),
  position int not null,
  name text not null,
  description text not null,
  weight int not null check (weight > 0 and weight <= 100),
  unique (role, position)
);

-- ---------- Candidates (NO personal details here; this is what AI sees) ----------
create table if not exists candidates (
  id uuid primary key default gen_random_uuid(),
  role_applied text not null check (role_applied in ('PM','SPM')),
  cv_text text not null,                 -- redacted CV text only
  cv_filename text,
  stage text not null default 'uploaded' check (stage in ('uploaded','scored','briefed','drafted','failed')),
  error text,
  pm_score numeric,                      -- weighted 0-100
  spm_score numeric,
  created_at timestamptz not null default now()
);

-- ---------- Personal details (private; never sent to any AI step) ----------
create table if not exists candidate_pii (
  candidate_id uuid primary key references candidates(id) on delete cascade,
  name text,
  email text,
  phone text
);

-- ---------- Scores: one row per candidate x role x criterion ----------
create table if not exists scores (
  candidate_id uuid not null references candidates(id) on delete cascade,
  criterion_id uuid not null references rubric_criteria(id),
  score int not null check (score between 0 and 10),
  reason text not null,
  primary key (candidate_id, criterion_id)
);

create table if not exists briefs (
  candidate_id uuid primary key references candidates(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists emails (
  candidate_id uuid primary key references candidates(id) on delete cascade,
  kind text not null check (kind in ('invite','rejection')),
  subject text not null,
  body_template text not null,           -- contains {{first_name}} placeholder
  body_edited text,                      -- founder's edited version (real name already in)
  sent_at timestamptz,
  resend_id text,
  created_at timestamptz not null default now()
);

alter table rubric_criteria enable row level security;
alter table candidates enable row level security;
alter table candidate_pii enable row level security;
alter table scores enable row level security;
alter table briefs enable row level security;
alter table emails enable row level security;

-- ---------- Seed rubric (from rubric.txt) ----------
insert into rubric_criteria (role, position, name, description, weight) values
('PM',1,'Shipping velocity & bias to action','Ships in short cycles, kills things that don''t work, doesn''t wait for permission structures that don''t exist yet.',25),
('PM',2,'Ground-level customer discovery','Time spent inside actual freight-forwarder ops (not just calls) — depth of understanding of what breaks and slows customers down.',20),
('PM',3,'Prioritization clarity','Can state the top 3 things to build next and defend the "why" without hedging.',20),
('PM',4,'Engineering partnership','Quality of day-to-day collaboration — eng knows what''s coming 3 sprints out.',15),
('PM',5,'Builds PM infrastructure from scratch','Creates the rhythms (prioritization method, tracking, comms) rather than importing a playbook that doesn''t fit.',20),
('SPM',1,'Ambiguous decision ownership','Makes build/configure/avoid calls alone, lives with the consequences, roadmap holds without whiplash.',25),
('SPM',2,'Integration/architecture judgment','Technical fluency inside complex, pre-existing customer systems (ERPs, carrier portals).',20),
('SPM',3,'Cross-functional trust-building','Gets sales, eng, and Arjun aligned on a roadmap they all actually believe.',20),
('SPM',4,'Reliability & data-quality bar','Sets standards ops-heavy customers can stake their business on.',15),
('SPM',5,'Raises the function''s standard','Sets an example other PMs will be measured against as Kargo scales.',20)
on conflict (role, position) do update
  set name = excluded.name, description = excluded.description, weight = excluded.weight;

-- Guard: each role's weights must total exactly 100
do $$
declare r record;
begin
  for r in select role, sum(weight) as total from rubric_criteria group by role loop
    if r.total <> 100 then
      raise exception 'Rubric weights for % total %, expected 100', r.role, r.total;
    end if;
  end loop;
end $$;
