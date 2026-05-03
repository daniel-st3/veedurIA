# Deployment — VeedurIA Web

## Production Project

| Key                | Value                                 |
|--------------------|---------------------------------------|
| **Vercel project** | `veeduria-web`                        |
| **Project ID**     | `prj_G44QWU6q7VUKwPlS6Un2jnIcltNC`   |
| **Production alias** | `veeduria.vercel.app`               |
| **Branch**         | `main`                                |
| **Root directory** | `veeduria/web`                        |
| **Framework**      | Next.js (auto-detected)               |
| **Build command**  | `next build`                          |
| **Output directory** | `.next`                             |

## Second project (legacy)

| Key                | Value                                 |
|--------------------|---------------------------------------|
| **Vercel project** | `veeduria`                            |
| **Project ID**     | `prj_12PyXHnYOHkgJEJlqlhf9KKOqXEI`   |
| **Root directory** | `veeduria` (repo root)                |

> **Recommendation:** Only `veeduria-web` owns the production alias
> (`veeduria.vercel.app`). The `veeduria` project was likely created
> during early setup and may generate stale preview deployments.
> Consider archiving or deleting it once you confirm it does not own
> any active custom domain. Do **not** delete without explicit
> confirmation.

## Preview Deployments

Every push to a non-`main` branch creates a Vercel preview deployment
on the `veeduria-web` project. The preview URL follows the pattern:

```
veeduria-web-<hash>-<team>.vercel.app
```

Preview builds use the same environment variables as production
(set in the Vercel dashboard), unless overridden per-environment.

## Cron Jobs

Defined in `veeduria/web/vercel.json`:

| Path                           | Schedule       | Purpose                    |
|--------------------------------|----------------|----------------------------|
| `/api/cron/contracts-refresh`  | `0 5 * * *`    | Daily SECOP data refresh   |

## Environment Variables

Required secrets (set in Vercel dashboard → Settings → Environment Variables):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL` (defaults to `https://veeduria.vercel.app`)
