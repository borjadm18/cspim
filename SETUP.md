# Content Store — Setup Guide

## Environment Variables

### Required (Vercel Dashboard → Settings → Environment Variables)

| Variable | Description |
|---|---|
| `BLUESTONE_TENANTS_JSON` | JSON map of tenant IDs to Bluestone credentials (see format below) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key (public, used by frontend) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only, enables L2 cache) |
| `CRON_SECRET` | Random secret for authorizing cron refresh requests |
| `CATALOG_ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins |

Generate `CRON_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### BLUESTONE_TENANTS_JSON format

```json
{
  "tenant-slug": {
    "clientId": "...",
    "clientSecret": "...",
    "orgId": "...",
    "env": "prod",
    "context": "en"
  }
}
```

---

## Supabase Migrations

Run once in Supabase Dashboard → SQL Editor:

```sql
-- 004_catalog_cache.sql
create table if not exists public.catalog_cache (
  tenant_key text primary key,
  products jsonb not null,
  fetched_at timestamptz not null default now()
);
```

---

## Cache Warm-Up Cron (cron-job.org)

Vercel Hobby plan only allows 1 cron/day. Use [cron-job.org](https://cron-job.org) (free) to keep the catalog cache warm.

**Create one cron job per active tenant:**

1. Sign up at https://cron-job.org (free)
2. Create a new cron job with these settings:

| Setting | Value |
|---|---|
| URL | `https://<your-vercel-domain>/api/catalog?tenant=<tenant-slug>&refresh=1` |
| Method | GET |
| Interval | Every 25 minutes |
| Header name | `Authorization` |
| Header value | `Bearer <CRON_SECRET>` |

3. Enable the cron job and verify the first execution succeeds (check the cron-job.org execution log for HTTP 200).

**Why 25 minutes?** The Supabase cache TTL is 30 minutes. Running at 25 minutes ensures the cache is always refreshed before it expires.

---

## First-Time Tenant Setup

When adding a new tenant:

1. Add its credentials to `BLUESTONE_TENANTS_JSON` in Vercel → redeploy
2. Add a cron job on cron-job.org for the new tenant slug
3. In the app Superadmin page, click **"Calentar caché"** next to the tenant to immediately populate the cache (avoids cold start on first demo)
