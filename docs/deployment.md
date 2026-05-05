# Deployment — VeedurIA Web

## Production Project

| Key                    | Value                                  |
|------------------------|----------------------------------------|
| **Vercel project**     | `veeduria`                             |
| **Project ID**         | `prj_12PyXHnYOHkgJEJlqlhf9KKOqXEI`     |
| **Production alias**   | `veeduria.vercel.app`                  |
| **Branch**             | `main`                                 |
| **Root directory**     | `web` (configured in the Vercel dashboard, **not** at repo root) |
| **Framework**          | Next.js (auto-detected)                |
| **Build command**      | `next build`                           |
| **Output directory**   | `.next`                                |
| **Node version**       | 22.x                                   |

The local `.vercel/project.json` at the repo root pins this project. It is the
authoritative deployment for `https://veeduria.vercel.app`.

Verified by API: `latestDeployment.target = "production"`, alias list includes
`veeduria.vercel.app`, `veeduria-daniel-st3s-projects.vercel.app`, and the
`-git-main-` mirror. Most recent commit served = `e916488` (post-launch
backlog cleanup).

## Second project (legacy, not in use)

| Key                | Value                                |
|--------------------|--------------------------------------|
| **Vercel project** | `veeduria-web`                       |
| **Project ID**     | `prj_G44QWU6q7VUKwPlS6Un2jnIcltNC`   |
| **Last deployment** | April 2025 (no recent activity)     |
| **Production alias** | none                               |
| **Local pin**      | `web/.vercel/project.json`           |

This project was created early in the migration to the Next.js stack and
never received the production custom domain. Its last deployment is months
old. No active alias depends on it.

> **Recommendation (manual, dashboard only):** keep production on `veeduria`.
> Once you have visually confirmed in the Vercel dashboard that:
>
> 1. `veeduria-web` has no active aliases or custom domains attached, and
> 2. all environment variables present on `veeduria-web` are also present on
>    `veeduria`,
>
> you may safely **archive or delete `veeduria-web`**. Do this through the
> Vercel UI — never via CLI/API automation in this repo. Removing the local
> `web/.vercel/project.json` pin afterwards is also fine, because nothing
> in the repo references it.

## Preview Deployments

Every push to a non-`main` branch creates a Vercel preview deployment on the
`veeduria` project. Preview URLs follow:

```
veeduria-<hash>-daniel-st3s-projects.vercel.app
```

Preview builds inherit production environment variables unless overridden
per-environment in the dashboard.

## Build configuration

The Vercel root directory is `web`, so when Vercel checks out `main` it runs
`next build` from inside `web/` against `web/package.json` and `web/vercel.json`.
The repo root contains a Streamlit/legacy `pages/` and `app.py` that Vercel
ignores because of that root-directory setting.

## Cron Jobs

Defined in `web/vercel.json`:

| Path                           | Schedule       | Purpose                    |
|--------------------------------|----------------|----------------------------|
| `/api/cron/contracts-refresh`  | `0 5 * * *`    | Daily SECOP data refresh   |

## Environment Variables

Required secrets (set in Vercel dashboard → Settings → Environment Variables
on the `veeduria` project):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL` (defaults to `https://veeduria.vercel.app`)

## Server-side rendering and the ContratoLimpio loading shell

`/contrato-limpio` uses `dynamic = "force-dynamic"` and races the upstream
SECOP/Supabase fetches against a 4 s `SERVER_FETCH_TIMEOUT_MS`. If the race
times out, the page server-renders an empty `initialOverview`/`initialTable`
and `<ContractsView>` mounts the loading shell (`isBooting === true`), which
shows the bilingual fallback paragraph and, after 12 s, an escape panel with
links to home, methodology, and legal limits. The client then refetches the
overview/table directly through `/api/contracts/*` and hydrates the dashboard
in place — the route always returns 200 even when Supabase is cold.

This is intentional: a timeout returns a useful page quickly instead of
blocking TTFB on a multi-second cold start. The architectural alternatives
are documented below for when the team decides to invest further.

### Recommended next architecture (when scoped)

Two safe directions, in increasing order of effort:

1. **Streaming SSR with `Suspense`** — wrap the dashboard sections in
   `<Suspense fallback={…}>` boundaries and remove the race timeout, so
   the shell streams immediately and each panel resolves as its data
   lands. No client refetch required; preserves SEO and accessibility.

2. **Incrementally cached overview** — move the overview fetch behind
   `unstable_cache` with a short revalidate window (e.g., 60 s) so cold
   starts don't compound. Combine with (1) for best TTFB.

Both options preserve clean values, normalized entity names, value badges,
filters, and dashboard behavior. Neither is required for ship-readiness.

## Votómetro vote-row pipeline status

Production currently has the public legislator directory and aggregate profile
metrics, but not publishable individual vote rows. The public read-layer audit
on 2026-05-05 found:

| Table/view | Status |
|------------|--------|
| `legislator_votes` | Not exposed / not present in the public PostgREST schema |
| `votes` | Not exposed / not present in the public PostgREST schema |
| `votometro_vote_records_public` | Exists, `0` rows |
| `vote_events` | Exists, `0` rows |
| `vote_records` | Exists, `0` rows |
| `votometro_directory_public` | Exists, 45 active profiles |

Until `vote_events` and `vote_records` are populated and can be joined to
profiles by stable `legislator_id`, profiles must keep the Pipeline activo
card. Do not fabricate vote rows, project names, source URLs, promise matches,
or topic classifications. A normalized-name fallback is only acceptable after a
separate auditable matching pass records the evidence and collision handling.

Expected behavior:

- Real vote rows available → render the recent vote table from source-backed
  rows only.
- No real vote rows → render Pipeline activo with aggregate profile metrics and
  explain that individual vote classification is pending source validation.
- Zero indexed votes → keep the zero-vote copy, without inventing activity.

## SigueElDinero source validation

SigueElDinero remains active, but network relationships are only public when
the API returns source-backed nodes and links. If the network API is unavailable
or returns no verified layer, the UI reports "Red en validación de fuente" and
shows unavailable metrics as `Sin dato` / `No data` instead of publishing
reference relationships as facts.

## Verifying a deployment

```bash
# 1. Confirm the production deployment SHA
curl -sS https://api.vercel.com/v9/projects/prj_12PyXHnYOHkgJEJlqlhf9KKOqXEI \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  | jq -r '.latestDeployment.id, .latestDeployment.target'

# 2. Smoke-test the public alias
for path in "/?lang=es" "/contrato-limpio?lang=es" "/sigue-el-dinero?lang=es" \
            "/votometro?lang=es" "/metodologia?lang=es" "/etica-y-privacidad?lang=es"; do
  printf "%s  %s\n" "$(curl -sS -o /dev/null -w '%{http_code}' "https://veeduria.vercel.app${path}")" "$path"
done
```

All six routes should return `200`.
