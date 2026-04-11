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

-- Public civic data — no RLS needed
alter table contracts disable row level security;

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

alter table contracts_stats disable row level security;
