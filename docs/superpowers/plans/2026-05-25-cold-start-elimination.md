# Cold Start Elimination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the ~41s cold start so any user sees the catalog in under 3 seconds, even on first visit of the day.

**Architecture:** The in-memory and Supabase stale-while-revalidate logic already exists in `getCatalogIndex` — when Supabase has an entry (even stale) it returns immediately and refreshes in background. The only cold start is when Supabase has NO entry at all. We fix this with (1) an external cron that keeps Supabase warm every 25 min, and (2) a superadmin warm-up button for new tenants.

**Tech Stack:** TypeScript, Vercel Node.js serverless, Supabase JS client, React 18

---

## Pre-flight check

Before starting, verify the current baseline:

```bash
curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" \
  "https://content-store-omega.vercel.app/api/catalog?tenant=tres-griferia"
```

Expected: `200` in under 1 second (Supabase cache should be warm from earlier today).

---

## Task 1: Add `checkSuperadminRole` to `api/catalog.ts`

**Files:**
- Modify: `api/catalog.ts` (near `hasRefreshAccess`, around line 205)

This helper lets the handler check if the authenticated user is a superadmin, so the warm-up button can trigger a refresh without needing `CRON_SECRET`.

- [ ] **Step 1.1: Add `checkSuperadminRole` after `hasRefreshAccess` (line ~217)**

Open `api/catalog.ts` and add this function immediately after the closing `};` of `hasRefreshAccess`:

```typescript
const checkSuperadminRole = async (userId: string): Promise<boolean> => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  return data?.role === 'superadmin';
};
```

- [ ] **Step 1.2: Restructure the auth gate in `handler` to allow superadmin refresh**

Find this block in `handler` (around line 1261):

```typescript
  const refreshRequested = String(req.query.refresh || '').trim() === '1';
  const refreshAuthorized = refreshRequested && hasRefreshAccess(req);

  if (!refreshAuthorized) {
    const auth = await requireAuth(req, res);
    if (!auth) return;
  }
```

Replace it with:

```typescript
  const refreshRequested = String(req.query.refresh || '').trim() === '1';
  let refreshAuthorized = refreshRequested && hasRefreshAccess(req);

  if (!refreshAuthorized) {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    if (refreshRequested) {
      refreshAuthorized = await checkSuperadminRole(auth.userId);
    }
  }
```

- [ ] **Step 1.3: Verify TypeScript compiles**

```bash
cd "C:\Users\novic\OneDrive\Escritorio\conector\ContentStore\BTV-CS-main\BTV-CS-main"
npx tsc --noEmit -p tsconfig.app.json 2>&1 | head -20
```

Expected: same errors as before (existing TS issues unrelated to this change), no new errors.

- [ ] **Step 1.4: Commit**

```bash
git add api/catalog.ts
git commit -m "feat: allow superadmin to trigger catalog cache refresh via JWT"
```

---

## Task 2: Add warm-up button to SuperadminPage

**Files:**
- Modify: `src/pages/SuperadminPage.tsx`

- [ ] **Step 2.1: Add `warmingUp` state**

Find the existing state declarations near the top of `SuperadminPage` (around line 62):

```typescript
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
```

Add after them:

```typescript
  const [warmingUp, setWarmingUp] = useState<Set<string>>(new Set());
```

- [ ] **Step 2.2: Add `handleWarmUp` function**

Find `handleDeleteTenant` (around line 144) and add this function after it:

```typescript
  const handleWarmUp = async (tenantSlug: string) => {
    setWarmingUp(prev => new Set(prev).add(tenantSlug));
    setError(null);
    setSuccess(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setError('No active session');
        return;
      }

      const res = await fetch(
        `/api/catalog?tenant=${encodeURIComponent(tenantSlug)}&refresh=1`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(`Warm-up failed: ${(body as { error?: string }).error ?? res.status}`);
      } else {
        setSuccess(`Caché calentada para ${tenantSlug}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Warm-up failed');
    } finally {
      setWarmingUp(prev => {
        const next = new Set(prev);
        next.delete(tenantSlug);
        return next;
      });
    }
  };
```

- [ ] **Step 2.3: Add button to tenant list**

In `src/pages/SuperadminPage.tsx` around line 272, find this exact block:

```tsx
                          <button
                            type="button"
                            onClick={() => void handleDeleteTenant(tenant.id)}
                            className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-red-600 transition hover:bg-red-50"
                          >
                            Eliminar
                          </button>
                        </div>
```

Replace with (adds warm-up button after Eliminar):

```tsx
                          <button
                            type="button"
                            onClick={() => void handleDeleteTenant(tenant.id)}
                            className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-red-600 transition hover:bg-red-50"
                          >
                            Eliminar
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleWarmUp(tenant.slug)}
                            disabled={warmingUp.has(tenant.slug)}
                            className="rounded-full border border-blue-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-blue-600 transition hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {warmingUp.has(tenant.slug) ? 'Calentando…' : 'Calentar caché'}
                          </button>
                        </div>
```

- [ ] **Step 2.4: Verify TypeScript compiles**

```bash
npx tsc --noEmit -p tsconfig.app.json 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 2.5: Test the button manually**

Start the app:
```bash
npm run dev:remote
```

Navigate to `http://127.0.0.1:4173/login`, log in as superadmin, go to the Superadmin page. Click "Calentar caché" next to a tenant. Verify:
- Button shows "Calentando…" while in progress
- Success message appears after completion
- No console errors

- [ ] **Step 2.6: Commit**

```bash
git add src/pages/SuperadminPage.tsx
git commit -m "feat: add cache warm-up button to SuperadminPage for superadmin role"
```

---

## Task 3: Create SETUP.md

**Files:**
- Create: `SETUP.md` (project root)

- [ ] **Step 3.1: Create SETUP.md**

Create the file at the project root with:

```markdown
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
```

- [ ] **Step 3.2: Commit**

```bash
git add SETUP.md
git commit -m "docs: add SETUP.md with env vars, migrations, and cron warmup guide"
```

---

## Task 4: Deploy and verify end-to-end

- [ ] **Step 4.1: Push and deploy**

```bash
git push
vercel --prod 2>&1
```

Expected: deployment reaches `READY` state.

- [ ] **Step 4.2: Verify warm Supabase cache response time**

```bash
curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" \
  "https://content-store-omega.vercel.app/api/catalog?tenant=tres-griferia"
```

Expected: `200` in under 1 second.

- [ ] **Step 4.3: Verify CDN cache is working**

Run the same curl twice. Check the second response includes `x-vercel-cache: HIT`:

```bash
curl -s -I "https://content-store-omega.vercel.app/api/catalog?tenant=tres-griferia" | grep -i "x-vercel-cache\|cache-control"
```

Expected:
```
cache-control: s-maxage=1800, stale-while-revalidate=86400
x-vercel-cache: HIT
```

- [ ] **Step 4.4: Set up cron-job.org**

Go to https://cron-job.org, create cron jobs for each active tenant as described in `SETUP.md`. Verify first execution returns HTTP 200.

- [ ] **Step 4.5: Simulate stale cache and verify background refresh**

Delete the Supabase cache entry, wait for the function to re-populate it, then verify subsequent requests are fast:

Run in Supabase Dashboard → SQL Editor:
```sql
delete from public.catalog_cache where tenant_key = 'prod:8f2f3e2f-8b16-4195-b1ae-e8b2bcc91f57:en';
```

Then make a request (this will be slow — ~41s — as it fetches from Bluestone):
```bash
curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" \
  "https://content-store-omega.vercel.app/api/catalog?tenant=tres-griferia&nocache=$(date +%s)"
```

Then immediately make another request:
```bash
curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" \
  "https://content-store-omega.vercel.app/api/catalog?tenant=tres-griferia&nocache2=$(date +%s)"
```

Expected: second request is under 1 second (Supabase re-populated by first request).

---

## Done

After completing all tasks:
- External cron keeps Supabase cache warm every 25 min → no cold starts in normal use
- Superadmin can warm new tenants immediately from the UI
- `SETUP.md` documents everything a new deployer needs
