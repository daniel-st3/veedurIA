-- ============================================================
-- VeedurIA — Supabase Postgres setup
-- Paste this entire script into the Supabase SQL Editor and run it.
-- Only needed once. Re-running is safe (all statements are idempotent).
-- ============================================================

-- 1. Scored contracts (red + yellow risk flags from SECOP II)
create table if not exists contracts (
    id            text primary key,
    entity        text,
    nit_entity    text,
    provider      text,
    department    text,
    modality      text,
    date          date,
    value         bigint,
    risk_score    real    not null,
    risk_bucket   text    not null,   -- 'high' | 'medium'
    secop_url     text,
    sector        text,
    is_direct_award boolean,
    single_bidder   boolean,
    object_desc   text
);

-- RLS: enable security, allow public read-only access.
-- The anon key can SELECT; INSERT/UPDATE/DELETE require the service_role key
-- (which bypasses RLS and is only used by the server-side import script).
alter table contracts enable row level security;

drop policy if exists "public_read_contracts" on contracts;
create policy "public_read_contracts" on contracts
  for select using (true);

-- Query indexes
create index if not exists idx_c_risk    on contracts (risk_bucket);
create index if not exists idx_c_dept    on contracts (department);
create index if not exists idx_c_date    on contracts (date desc);
create index if not exists idx_c_score   on contracts (risk_score desc);
create index if not exists idx_c_entity  on contracts (entity);

-- 2. Pre-computed overview stats (updated by the daily import script)
create table if not exists contracts_stats (
    key        text primary key,   -- 'global'
    data       jsonb not null,
    updated_at timestamptz default now()
);

-- RLS: enable security, allow public read-only access.
alter table contracts_stats enable row level security;

drop policy if exists "public_read_contracts_stats" on contracts_stats;
create policy "public_read_contracts_stats" on contracts_stats
  for select using (true);

-- ============================================================
-- 3. VotóMeter V1 — live congressional coverage
-- ============================================================

create extension if not exists pgcrypto;

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists legislators (
    id               text primary key,
    slug             text not null unique,
    canonical_name   text not null,
    normalized_name  text not null,
    initials         text not null,
    chamber          text not null check (chamber in ('senado', 'camara')),
    party            text,
    party_key        text,
    image_url        text,
    bio              text,
    source_primary   text not null,
    source_ref       text,
    source_updated_at timestamptz,
    active           boolean not null default true,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create table if not exists legislator_terms (
    id               text primary key,
    legislator_id    text not null references legislators(id) on delete cascade,
    period_key       text not null,
    period_label     text not null,
    role_label       text not null,
    commission       text,
    circunscription  text,
    office           text,
    is_current       boolean not null default false,
    term_start       date,
    term_end         date,
    source_system    text not null,
    source_ref       text,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create table if not exists legislator_aliases (
    id               text primary key,
    legislator_id    text not null references legislators(id) on delete cascade,
    alias            text not null,
    normalized_alias text not null,
    source_system    text not null,
    confidence       real,
    is_canonical     boolean not null default false,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create table if not exists legislator_contacts (
    id               text primary key,
    legislator_id    text not null references legislators(id) on delete cascade,
    email            text,
    phone            text,
    office           text,
    source_system    text not null,
    is_primary       boolean not null default true,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create table if not exists legislator_socials (
    id               text primary key,
    legislator_id    text not null references legislators(id) on delete cascade,
    network          text not null,
    handle           text,
    url              text not null,
    source_system    text not null,
    is_primary       boolean not null default true,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create table if not exists projects (
    id               text primary key,
    external_id      text,
    title            text not null,
    normalized_title text not null,
    description      text,
    chamber          text check (chamber in ('senado', 'camara')),
    topic_key        text,
    topic_label      text,
    status           text,
    filed_at         date,
    source_system    text not null,
    source_url       text,
    metadata         jsonb not null default '{}'::jsonb,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create table if not exists vote_events (
    id               text primary key,
    external_id      text,
    project_id       text references projects(id) on delete set null,
    chamber          text not null check (chamber in ('senado', 'camara')),
    vote_date        date not null,
    session_label    text,
    result_text      text,
    source_system    text not null,
    source_url       text,
    metadata         jsonb not null default '{}'::jsonb,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create table if not exists vote_records (
    id               text primary key,
    vote_event_id    text not null references vote_events(id) on delete cascade,
    legislator_id    text not null references legislators(id) on delete cascade,
    project_id       text references projects(id) on delete set null,
    chamber          text not null check (chamber in ('senado', 'camara')),
    vote_date        date not null,
    vote_value       text not null,
    is_absent        boolean not null default false,
    deviates_from_party boolean not null default false,
    source_system    text not null,
    source_url       text,
    metadata         jsonb not null default '{}'::jsonb,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create table if not exists attendance_records (
    id               text primary key,
    legislator_id    text not null references legislators(id) on delete cascade,
    chamber          text not null check (chamber in ('senado', 'camara')),
    session_external_id text,
    attendance_date  date not null,
    attended         boolean not null,
    source_system    text not null,
    source_url       text,
    metadata         jsonb not null default '{}'::jsonb,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create table if not exists legislator_metrics_current (
    legislator_id         text primary key references legislators(id) on delete cascade,
    chamber               text not null check (chamber in ('senado', 'camara')),
    party                 text,
    party_key             text,
    period_key            text not null,
    votes_indexed         integer not null default 0,
    attendance_sessions   integer not null default 0,
    attended_sessions     integer not null default 0,
    attendance_rate       real,
    approved_promise_matches integer not null default 0,
    coherent_votes        integer not null default 0,
    inconsistent_votes    integer not null default 0,
    absent_votes          integer not null default 0,
    coherence_score       real,
    top_topics            jsonb not null default '[]'::jsonb,
    topic_scores          jsonb not null default '[]'::jsonb,
    updated_at            timestamptz not null default now()
);

create table if not exists party_metrics_current (
    party_key             text primary key,
    party                 text not null,
    chamber               text,
    member_count          integer not null default 0,
    active_members        integer not null default 0,
    indexed_votes         integer not null default 0,
    attendance_rate       real,
    coherence_score       real,
    approved_promise_matches integer not null default 0,
    topic_scores          jsonb not null default '[]'::jsonb,
    updated_at            timestamptz not null default now()
);

create table if not exists promise_claims (
    id                   text primary key,
    legislator_id        text not null references legislators(id) on delete cascade,
    claim_text           text not null,
    source_url           text,
    source_label         text,
    source_date          date,
    topic_key            text,
    topic_label          text,
    stance               text not null default 'indeterminado' check (stance in ('favor', 'contra', 'mixto', 'indeterminado')),
    extraction_confidence real,
    source_system        text not null,
    metadata             jsonb not null default '{}'::jsonb,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now()
);

create table if not exists promise_reviews (
    id                   text primary key,
    promise_claim_id     text not null unique references promise_claims(id) on delete cascade,
    status               text not null check (status in ('pending', 'approved', 'rejected', 'ambiguous')),
    reviewer             text,
    review_note          text,
    reviewed_at          timestamptz,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now()
);

create table if not exists promise_vote_matches (
    id                   text primary key,
    promise_claim_id     text not null references promise_claims(id) on delete cascade,
    vote_event_id        text not null references vote_events(id) on delete cascade,
    legislator_id        text not null references legislators(id) on delete cascade,
    match_score          real,
    coherence_status     text not null check (coherence_status in ('coherent', 'inconsistent', 'absent', 'pending')),
    source_system        text not null,
    metadata             jsonb not null default '{}'::jsonb,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now()
);

create table if not exists identity_conflicts (
    id                   text primary key,
    source_system        text not null,
    chamber              text,
    candidate_name       text not null,
    normalized_name      text not null,
    proposed_legislator_id text references legislators(id) on delete set null,
    confidence           real,
    status               text not null default 'pending' check (status in ('pending', 'resolved', 'discarded')),
    evidence             jsonb not null default '{}'::jsonb,
    resolved_note        text,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now()
);

create table if not exists ingestion_runs (
    id                   text primary key,
    job_name             text not null,
    mode                 text not null,
    source_system        text not null,
    status               text not null check (status in ('success', 'warning', 'failed', 'running')),
    started_at           timestamptz not null default now(),
    finished_at          timestamptz,
    rows_in              integer,
    rows_out             integer,
    replace_public       boolean not null default false,
    snapshot_path        text,
    deltas               jsonb not null default '{}'::jsonb,
    warnings             jsonb not null default '[]'::jsonb,
    metadata             jsonb not null default '{}'::jsonb,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now()
);

create or replace trigger trg_legislators_touch_updated_at
before update on legislators
for each row execute function touch_updated_at();

create or replace trigger trg_legislator_terms_touch_updated_at
before update on legislator_terms
for each row execute function touch_updated_at();

create or replace trigger trg_legislator_aliases_touch_updated_at
before update on legislator_aliases
for each row execute function touch_updated_at();

create or replace trigger trg_legislator_contacts_touch_updated_at
before update on legislator_contacts
for each row execute function touch_updated_at();

create or replace trigger trg_legislator_socials_touch_updated_at
before update on legislator_socials
for each row execute function touch_updated_at();

create or replace trigger trg_projects_touch_updated_at
before update on projects
for each row execute function touch_updated_at();

create or replace trigger trg_vote_events_touch_updated_at
before update on vote_events
for each row execute function touch_updated_at();

create or replace trigger trg_vote_records_touch_updated_at
before update on vote_records
for each row execute function touch_updated_at();

create or replace trigger trg_attendance_records_touch_updated_at
before update on attendance_records
for each row execute function touch_updated_at();

create or replace trigger trg_promise_claims_touch_updated_at
before update on promise_claims
for each row execute function touch_updated_at();

create or replace trigger trg_promise_reviews_touch_updated_at
before update on promise_reviews
for each row execute function touch_updated_at();

create or replace trigger trg_promise_vote_matches_touch_updated_at
before update on promise_vote_matches
for each row execute function touch_updated_at();

create or replace trigger trg_identity_conflicts_touch_updated_at
before update on identity_conflicts
for each row execute function touch_updated_at();

create or replace trigger trg_ingestion_runs_touch_updated_at
before update on ingestion_runs
for each row execute function touch_updated_at();

create index if not exists idx_legislators_chamber on legislators (chamber, active);
create index if not exists idx_legislators_party on legislators (party_key);
create index if not exists idx_legislators_slug on legislators (slug);
create index if not exists idx_terms_legislator_current on legislator_terms (legislator_id, is_current);
create index if not exists idx_aliases_legislator on legislator_aliases (legislator_id);
create index if not exists idx_aliases_normalized on legislator_aliases (normalized_alias);
create index if not exists idx_contacts_legislator on legislator_contacts (legislator_id, is_primary);
create index if not exists idx_socials_legislator on legislator_socials (legislator_id, network);
create index if not exists idx_projects_topic on projects (topic_key, chamber);
create index if not exists idx_vote_events_date on vote_events (vote_date desc, chamber);
create index if not exists idx_vote_records_legislator on vote_records (legislator_id, vote_date desc);
create index if not exists idx_vote_records_event on vote_records (vote_event_id);
create index if not exists idx_attendance_legislator on attendance_records (legislator_id, attendance_date desc);
create index if not exists idx_metrics_party on legislator_metrics_current (party_key, chamber);
create index if not exists idx_promise_claims_legislator on promise_claims (legislator_id, source_date desc);
create index if not exists idx_promise_reviews_status on promise_reviews (status, reviewed_at desc);
create index if not exists idx_promise_matches_legislator on promise_vote_matches (legislator_id, vote_event_id);
create index if not exists idx_identity_conflicts_status on identity_conflicts (status, confidence desc);
create index if not exists idx_ingestion_runs_job on ingestion_runs (job_name, started_at desc);

alter table legislators enable row level security;
alter table legislator_terms enable row level security;
alter table legislator_aliases enable row level security;
alter table legislator_contacts enable row level security;
alter table legislator_socials enable row level security;
alter table projects enable row level security;
alter table vote_events enable row level security;
alter table vote_records enable row level security;
alter table attendance_records enable row level security;
alter table legislator_metrics_current enable row level security;
alter table party_metrics_current enable row level security;
alter table promise_claims enable row level security;
alter table promise_reviews enable row level security;
alter table promise_vote_matches enable row level security;
alter table identity_conflicts enable row level security;
alter table ingestion_runs enable row level security;

drop policy if exists "public_read_legislators" on legislators;
create policy "public_read_legislators" on legislators
  for select using (true);

drop policy if exists "public_read_legislator_terms" on legislator_terms;
create policy "public_read_legislator_terms" on legislator_terms
  for select using (true);

drop policy if exists "public_read_legislator_aliases" on legislator_aliases;
create policy "public_read_legislator_aliases" on legislator_aliases
  for select using (true);

drop policy if exists "public_read_legislator_contacts" on legislator_contacts;
create policy "public_read_legislator_contacts" on legislator_contacts
  for select using (true);

drop policy if exists "public_read_legislator_socials" on legislator_socials;
create policy "public_read_legislator_socials" on legislator_socials
  for select using (true);

drop policy if exists "public_read_projects" on projects;
create policy "public_read_projects" on projects
  for select using (true);

drop policy if exists "public_read_vote_events" on vote_events;
create policy "public_read_vote_events" on vote_events
  for select using (true);

drop policy if exists "public_read_vote_records" on vote_records;
create policy "public_read_vote_records" on vote_records
  for select using (true);

drop policy if exists "public_read_attendance_records" on attendance_records;
create policy "public_read_attendance_records" on attendance_records
  for select using (true);

drop policy if exists "public_read_legislator_metrics_current" on legislator_metrics_current;
create policy "public_read_legislator_metrics_current" on legislator_metrics_current
  for select using (true);

drop policy if exists "public_read_party_metrics_current" on party_metrics_current;
create policy "public_read_party_metrics_current" on party_metrics_current
  for select using (true);

drop policy if exists "public_read_promise_vote_matches" on promise_vote_matches;
create policy "public_read_promise_vote_matches" on promise_vote_matches
  for select using (true);

create or replace view votometro_directory_public as
select
  l.id,
  l.slug,
  l.canonical_name,
  l.normalized_name,
  l.initials,
  l.chamber,
  l.party,
  l.party_key,
  l.image_url,
  l.bio,
  l.source_primary,
  l.source_ref,
  l.source_updated_at,
  lt.period_key,
  lt.period_label,
  lt.role_label,
  lt.commission,
  lt.circunscription,
  coalesce(lc.email, '') as email,
  coalesce(lc.phone, '') as phone,
  coalesce(lt.office, lc.office, '') as office,
  lm.votes_indexed,
  lm.attendance_sessions,
  lm.attended_sessions,
  lm.attendance_rate,
  lm.approved_promise_matches,
  lm.coherent_votes,
  lm.inconsistent_votes,
  lm.absent_votes,
  lm.coherence_score,
  lm.top_topics,
  lm.topic_scores,
  l.active,
  l.updated_at
from legislators l
left join lateral (
  select *
  from legislator_terms lt
  where lt.legislator_id = l.id
  order by lt.is_current desc, lt.updated_at desc
  limit 1
) lt on true
left join lateral (
  select *
  from legislator_contacts lc
  where lc.legislator_id = l.id
  order by lc.is_primary desc, lc.updated_at desc
  limit 1
) lc on true
left join legislator_metrics_current lm on lm.legislator_id = l.id
where l.active = true;

create or replace view votometro_approved_promises_public as
select
  pc.id,
  pc.legislator_id,
  pc.claim_text,
  pc.source_url,
  pc.source_label,
  pc.source_date,
  pc.topic_key,
  pc.topic_label,
  pc.stance,
  pc.extraction_confidence,
  pc.source_system,
  pc.metadata,
  pr.status,
  pr.review_note,
  pr.reviewed_at
from promise_claims pc
join promise_reviews pr on pr.promise_claim_id = pc.id
where pr.status = 'approved';

create or replace view votometro_vote_records_public as
select
  vr.id,
  vr.legislator_id,
  vr.vote_event_id,
  vr.project_id,
  vr.chamber,
  vr.vote_date,
  vr.vote_value,
  vr.is_absent,
  vr.deviates_from_party,
  vr.source_system,
  vr.source_url,
  ve.session_label,
  ve.result_text,
  p.title as project_title,
  p.description as project_description,
  p.topic_key,
  p.topic_label,
  p.status as project_status,
  p.source_url as project_source_url,
  case
    when exists (
      select 1
      from promise_vote_matches pvm
      join promise_reviews pr on pr.promise_claim_id = pvm.promise_claim_id
      where pvm.vote_event_id = vr.vote_event_id
        and pvm.legislator_id = vr.legislator_id
        and pr.status = 'approved'
        and pvm.coherence_status = 'coherent'
    ) then 'coherente'
    when exists (
      select 1
      from promise_vote_matches pvm
      join promise_reviews pr on pr.promise_claim_id = pvm.promise_claim_id
      where pvm.vote_event_id = vr.vote_event_id
        and pvm.legislator_id = vr.legislator_id
        and pr.status = 'approved'
        and pvm.coherence_status = 'inconsistent'
    ) then 'inconsistente'
    when exists (
      select 1
      from promise_vote_matches pvm
      join promise_reviews pr on pr.promise_claim_id = pvm.promise_claim_id
      where pvm.vote_event_id = vr.vote_event_id
        and pvm.legislator_id = vr.legislator_id
        and pr.status = 'approved'
        and pvm.coherence_status = 'absent'
    ) then 'ausente'
    else 'sin-promesa'
  end as promise_alignment
from vote_records vr
join vote_events ve on ve.id = vr.vote_event_id
left join projects p on p.id = coalesce(vr.project_id, ve.project_id);

insert into storage.buckets (id, name, public)
values ('votometro-source-snapshots', 'votometro-source-snapshots', false)
on conflict (id) do nothing;
