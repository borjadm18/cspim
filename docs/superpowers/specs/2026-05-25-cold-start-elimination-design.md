# Cold Start Elimination — Design Spec

**Date:** 2026-05-25
**Project:** Content Store (BTV-CS-main)
**Status:** Approved

---

## Problem

When the Supabase `catalog_cache` table has no entry for a tenant, the `/api/catalog` serverless function must fetch all products directly from Bluestone PIM. This takes ~41 seconds, making the product unusable for demos and first-time users.

The CDN cache (`s-maxage=1800, stale-while-revalidate=86400`) already eliminates this for repeat visitors within a 30-minute window. The problem is the true cold start: Supabase cache miss after the 30-minute window or on first ever request.

---

## Goal

Guarantee that any user landing on the Content Store sees the first catalog page in **under 3 seconds**, including the first visit of the day.

---

## Non-Goals

- Reducing product detail modal load time (separate initiative)
- Paginating the Bluestone fetch (Fase 2 — cache split architecture)
- Self-service tenant onboarding
- Billing or marketplace listing

---

## Architecture

Two mechanisms work in parallel to keep the Supabase cache perpetually warm:

### Mechanism 1 — External Cron (cron-job.org)

An external cron service calls the refresh endpoint every 25 minutes per active tenant. This bypasses Vercel Hobby's daily cron limitation.

- **Service:** cron-job.org (free tier, no credit card)
- **Endpoint:** `GET /api/catalog?tenant={tenantId}&refresh=1`
- **Auth header:** `Authorization: Bearer {CRON_SECRET}`
- **Interval:** every 25 minutes
- **One cron job per active tenant**

The 25-minute interval is intentional: it runs before the Supabase cache TTL (30 min) expires, ensuring there is always a warm entry when the CDN needs to revalidate.

### Mechanism 2 — Stale-While-Revalidate at Function Level

When the Supabase cache entry exists but its age exceeds the stale threshold, the function:

1. Sends the stale data immediately as the HTTP response (`res.json(staleData)`)
2. Continues executing in the background to refresh Supabase
3. Logs any refresh error without affecting the already-delivered response

This is the fallback if the external cron misses a run. In Vercel's Node.js runtime, calling `res.json()` does not terminate function execution — the function continues until it returns or hits `maxDuration`.

```
Incoming request
  └─ Supabase hit, age < STALE_THRESHOLD  →  return immediately (~300ms)
  └─ Supabase hit, age >= STALE_THRESHOLD →  res.json(staleData) + background refresh
  └─ Supabase miss                         →  fetch Bluestone (~41s) + store + return
```

**`STALE_THRESHOLD_MS`:** `25 * 60 * 1000` (25 minutes)

### Mechanism 3 — Manual Warm-Up Button (Superadmin)

When a new tenant is added in SuperadminPage, an admin can trigger an immediate cache warm-up via a "Calentar caché" button. This fires `GET /api/catalog?tenant={id}&refresh=1` from the browser and shows a loading state while it completes.

This eliminates the cold start on first demo or first real use of a new tenant.

---

## Changes Required

### `api/catalog.ts`

- Add `STALE_THRESHOLD_MS = 25 * 60 * 1000` constant
- In `readSupabaseCache`: return both `products` and `fetched_at`
- In the main handler: after reading cache, compute `cacheAgeMs = Date.now() - fetchedAt.getTime()`
- If `cacheAgeMs >= STALE_THRESHOLD_MS`: call `res.json(cachedResult)` then trigger `refreshCatalogIndex()` without awaiting it, then `return`
- Ensure `hasRefreshAccess()` correctly validates the `Authorization: Bearer {CRON_SECRET}` header for the cron path

### `src/pages/SuperadminPage.tsx`

- Add "Calentar caché" button next to each tenant row
- Button calls `GET /api/catalog?tenant={tenantId}&refresh=1` with the user's auth token
- Shows loading spinner while in progress; shows success/error toast on completion
- Only visible to `superadmin` role

### `SETUP.md` (new file, project root)

Documents the cron-job.org setup process for new deployments:
- How to create a cron job per tenant
- Which URL and headers to use
- How to generate and set `CRON_SECRET` in Vercel

---

## Error Handling

| Scenario | Behavior |
|---|---|
| cron-job.org fails / misses a run | Stale-while-revalidate serves cached data; background refresh on next user request |
| Background refresh fails (Bluestone down) | Stale data already delivered; error logged; next request retries |
| Supabase completely down | Fallback to direct Bluestone fetch (~41s); existing logic preserved |
| New tenant, no cache entry | Manual warm-up button in Superadmin; cold start accepted on first request only |

---

## Testing Plan

1. **Stale cache test:** Insert a `catalog_cache` row with `fetched_at = NOW() - INTERVAL '30 minutes'`. Call the endpoint. Verify response arrives in <500ms. Verify `fetched_at` updates in Supabase within ~45s.

2. **Cache miss test:** Delete the `catalog_cache` row for a tenant. Call the endpoint. Verify it eventually returns 200 and the row is repopulated.

3. **Cron auth test:** Call `/api/catalog?tenant={id}&refresh=1` with `Authorization: Bearer {CRON_SECRET}`. Verify 200 and updated `fetched_at`.

4. **Cron auth rejection test:** Call the same endpoint with a wrong secret. Verify 401 or that the refresh is rejected without side effects.

5. **Warm-up button test:** In SuperadminPage, click "Calentar caché" for a tenant with no cache entry. Verify loading state, eventual success toast, and cache row in Supabase.

---

## Out of Scope (Fase 2)

The next phase will split the catalog cache into:
- A **lightweight index** (id, name, sku, filters, thumbnail) returned in <3s even on a true cold start
- **Full product detail** loaded on demand when the user opens a product

This eliminates the 41s cold start structurally, without relying on external cron services.
