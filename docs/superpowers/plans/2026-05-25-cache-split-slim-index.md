# Cache Split — Slim Index Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the ~41s cold start structurally by building a lightweight catalog index (METADATA+CATEGORIES+ASSETS, no attribute enrichment, no presigned URL fetching) that serves in 5-15s, while the full catalog continues building in the background.

**Architecture:** Two Supabase tables: `catalog_cache` (existing, full data, ~41s build) and `catalog_index` (new, slim data, ~5-15s build). `getCatalogIndex` checks full cache → slim cache → builds slim → triggers full build in background. Product cards use `previewImageAssetId` via the existing `/api/asset` endpoint for lazy thumbnail loading. The `slim: true` flag in `CatalogPageMeta` lets the frontend show a "loading full data" banner and auto-refresh after 60 seconds.

**Tech Stack:** TypeScript, Vercel Node.js serverless, Supabase JS client, React 18

**Worktree:** `C:\Users\novic\OneDrive\Escritorio\conector\ContentStore\BTV-CS-main\BTV-CS-main`

---

## File Map

| File | Change |
|------|--------|
| `supabase/migrations/007_catalog_index.sql` | CREATE — new slim table |
| `src/features/catalog/model/catalogTypes.ts` | MODIFY — add `slim?: boolean` to `CatalogPageMeta` |
| `api/catalog.ts` | MODIFY — add slim constants, functions, modify `getCatalogIndex` |
| `src/features/catalog/state/useCatalog.ts` | MODIFY — expose `cacheIsSlim` |
| `src/app/App.tsx` | MODIFY — slim banner + auto-refresh |

---

## Task 1: SQL migration — `catalog_index` table

**Files:**
- Create: `supabase/migrations/007_catalog_index.sql`

- [ ] **Step 1.1: Create migration file**

```sql
create table if not exists public.catalog_index (
  tenant_key text primary key,
  products   jsonb not null,
  fetched_at timestamptz not null default now()
);
-- Service role bypasses RLS automatically.
```

Save at `supabase/migrations/007_catalog_index.sql`.

- [ ] **Step 1.2: Run migration in Supabase Dashboard**

Open Supabase Dashboard → SQL Editor and paste:

```sql
create table if not exists public.catalog_index (
  tenant_key text primary key,
  products   jsonb not null,
  fetched_at timestamptz not null default now()
);
```

Click Run. Verify the table appears in Table Editor.

- [ ] **Step 1.3: Commit**

```bash
cd "C:\Users\novic\OneDrive\Escritorio\conector\ContentStore\BTV-CS-main\BTV-CS-main"
git add supabase/migrations/007_catalog_index.sql
git commit -m "feat: add catalog_index table for slim cold-start index"
```

---

## Task 2: Add `slim` flag to `CatalogPageMeta`

**Files:**
- Modify: `src/features/catalog/model/catalogTypes.ts` (around line 144)

- [ ] **Step 2.1: Add `slim` to `CatalogPageMeta`**

Find this block in `catalogTypes.ts`:

```typescript
  cacheAgeMs?: number;
  stale?: boolean;
};
```

Replace with:

```typescript
  cacheAgeMs?: number;
  stale?: boolean;
  slim?: boolean;
};
```

- [ ] **Step 2.2: Verify TypeScript**

```bash
npx tsc --noEmit -p tsconfig.app.json 2>&1 | head -20
```

Expected: same pre-existing errors, no new errors.

- [ ] **Step 2.3: Commit**

```bash
git add src/features/catalog/model/catalogTypes.ts
git commit -m "feat: add slim flag to CatalogPageMeta"
```

---

## Task 3: Add slim cache infrastructure to `api/catalog.ts`

**Files:**
- Modify: `api/catalog.ts`

### Step 3.1: Add `SLIM_CACHE_TTL_MS` constant

Find the block of constants (around line 127):

```typescript
const MEMORY_CACHE_TTL_MS = 5 * 60 * 1000;
const SUPABASE_CACHE_TTL_MS = 30 * 60 * 1000;
```

Add after `SUPABASE_CACHE_TTL_MS`:

```typescript
const SLIM_CACHE_TTL_MS = 25 * 60 * 1000;
```

- [ ] **Step 3.2: Add `slimBuildInFlight` map**

Find:

```typescript
const refreshInFlight = new Map<string, Promise<CatalogCacheEntry>>();
```

Add after it:

```typescript
const slimBuildInFlight = new Map<string, Promise<CatalogCacheEntry>>();
```

- [ ] **Step 3.3: Add `readSlimSupabaseCache` function**

Find the `readSupabaseCache` function (around line 1020). Add this function immediately AFTER the closing `};` of `readSupabaseCache`:

```typescript
const readSlimSupabaseCache = async (cacheKey: string): Promise<CatalogCacheEntry | null> => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  try {
    const { data } = await (supabase as ReturnType<typeof createClient>)
      .from('catalog_index')
      .select('products, fetched_at')
      .eq('tenant_key', cacheKey)
      .maybeSingle();

    const row = data as { products?: unknown; fetched_at?: string } | null;
    if (!row?.products || !row.fetched_at) return null;

    const products = Array.isArray(row.products) ? (row.products as Product[]) : [];
    return {
      data: products,
      meta: { ...buildCatalogBaseMeta(products), slim: true },
      fetchedAt: new Date(String(row.fetched_at)).getTime(),
    };
  } catch {
    return null;
  }
};
```

- [ ] **Step 3.4: Add `persistSlimSupabaseCache` function**

Find `persistSupabaseCache` (around line 1062). Add this function immediately AFTER it:

```typescript
const persistSlimSupabaseCache = async (cacheKey: string, entry: CatalogCacheEntry) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  try {
    await ((supabase as ReturnType<typeof createClient>).from('catalog_index') as any).upsert({
      tenant_key: cacheKey,
      products: entry.data,
      fetched_at: new Date(entry.fetchedAt).toISOString(),
    });
  } catch {
    // Keep runtime resilient until every environment has the latest migration.
  }
};
```

- [ ] **Step 3.5: Add `buildSlimCatalogIndex` function**

Add this function immediately BEFORE `refreshCatalogIndex` (around line 1077):

```typescript
const buildSlimCatalogIndex = (tenant: TenantConfig, cacheKey: string): Promise<CatalogCacheEntry> => {
  const existing = slimBuildInFlight.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    const token = await getAccessToken(tenant);
    const baseUrl = getBaseUrl(tenant.env);
    const allProducts: Record<string, unknown>[] = [];
    let cursor: string | null = null;

    do {
      const body = cursor
        ? { cursor, count: 100, views: [{ type: 'METADATA' }, { type: 'CATEGORIES' }, { type: 'ASSETS' }] }
        : { count: 100, views: [{ type: 'METADATA' }, { type: 'CATEGORIES' }, { type: 'ASSETS' }] };

      const response = await fetchWithRetry(`${baseUrl}/pim/products/cursor/views/all`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
          'x-organization-id': tenant.orgId,
          context: tenant.context || 'en',
          'context-fallback': 'true',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Bluestone slim products request failed (${response.status}): ${await response.text()}`);
      }

      const payload = (await response.json()) as {
        nextCursor?: string | null;
        cursor?: string | null;
        data?: unknown[];
        results?: unknown[];
        items?: unknown[];
      };
      const batch = normalizeProductBatch(payload) as Record<string, unknown>[];
      allProducts.push(...batch);
      cursor = payload?.nextCursor || payload?.cursor || null;
    } while (cursor);

    const normalizedProducts = allProducts
      .map(product => {
        const assetIds = extractPreviewAssetIds(product);
        const embeddedMedia = extractEmbeddedMedia(product);
        const media =
          embeddedMedia.images.length > 0 || embeddedMedia.attachments.length > 0
            ? embeddedMedia
            : { images: [], attachments: [], hasImage: false, hasDocument: false };

        return normalizeCatalogProduct(product, media, [], {
          assetIds,
          includeAttributes: false,
          includeMediaUrls: false,
        });
      })
      .filter(product => !isTestProduct(product));

    const entry: CatalogCacheEntry = {
      data: normalizedProducts,
      meta: { ...buildCatalogBaseMeta(normalizedProducts), slim: true },
      fetchedAt: Date.now(),
    };

    await persistSlimSupabaseCache(cacheKey, entry);
    return entry;
  })();

  slimBuildInFlight.set(cacheKey, promise);
  return promise.finally(() => slimBuildInFlight.delete(cacheKey));
};
```

- [ ] **Step 3.6: Verify TypeScript**

```bash
npx tsc --noEmit -p tsconfig.app.json 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 3.7: Commit**

```bash
git add api/catalog.ts
git commit -m "feat: add slim catalog index build — METADATA+CATEGORIES+ASSETS, no attribute enrichment"
```

---

## Task 4: Modify `getCatalogIndex` to use slim as cold-start fallback

**Files:**
- Modify: `api/catalog.ts` — `getCatalogIndex` function (around line 1179)

- [ ] **Step 4.1: Replace the last line of `getCatalogIndex`**

Find this exact block at the end of `getCatalogIndex`:

```typescript
  return refreshCatalogIndex(tenant, cacheKey);
};
```

Replace with:

```typescript
  // Cold start: try slim index for a fast response while full index builds
  const slimEntry = await readSlimSupabaseCache(cacheKey);
  if (slimEntry && Date.now() - slimEntry.fetchedAt < SLIM_CACHE_TTL_MS) {
    void refreshCatalogIndex(tenant, cacheKey).catch(() => {});
    return slimEntry;
  }

  // True cold start: build slim (~5-15s), return it, trigger full build in background
  const slim = await buildSlimCatalogIndex(tenant, cacheKey);
  void refreshCatalogIndex(tenant, cacheKey).catch(() => {});
  return slim;
};
```

- [ ] **Step 4.2: Verify TypeScript**

```bash
npx tsc --noEmit -p tsconfig.app.json 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 4.3: Commit**

```bash
git add api/catalog.ts
git commit -m "feat: getCatalogIndex falls back to slim index on cold start"
```

---

## Task 5: Expose `cacheIsSlim` from `useCatalog`

**Files:**
- Modify: `src/features/catalog/state/useCatalog.ts`

- [ ] **Step 5.1: Add `cacheIsSlim` to the return object**

In `useCatalog.ts`, find the return statement. Locate where `cacheIsStale` is returned:

```typescript
    cacheAgeMs: meta.cacheAgeMs,
    cacheIsStale: meta.stale,
```

Add `cacheIsSlim` immediately after:

```typescript
    cacheAgeMs: meta.cacheAgeMs,
    cacheIsStale: meta.stale,
    cacheIsSlim: meta.slim,
```

- [ ] **Step 5.2: Verify TypeScript**

```bash
npx tsc --noEmit -p tsconfig.app.json 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 5.3: Commit**

```bash
git add src/features/catalog/state/useCatalog.ts
git commit -m "feat: expose cacheIsSlim from useCatalog hook"
```

---

## Task 6: Slim banner + auto-refresh in `App.tsx`

**Files:**
- Modify: `src/app/App.tsx`

- [ ] **Step 6.1: Destructure `cacheIsSlim` from `useCatalog()`**

In `App.tsx`, find where `useCatalog()` is destructured (around line 51). Locate the line:

```typescript
    cacheIsStale,
```

Add `cacheIsSlim` after it:

```typescript
    cacheIsStale,
    cacheIsSlim,
```

- [ ] **Step 6.2: Add auto-refresh effect when slim**

Find the `useEffect` blocks in `CatalogPage`. Add this new effect after the existing `useEffect` for detail loading (around line 300):

```typescript
  useEffect(() => {
    if (!cacheIsSlim) return;
    const timer = setTimeout(() => {
      void reloadProducts();
    }, 60_000);
    return () => clearTimeout(timer);
  }, [cacheIsSlim, reloadProducts]);
```

- [ ] **Step 6.3: Add slim banner above product grid**

Find where the product grid is rendered in `CatalogPage`. Look for the main content area that renders `ProductCard` items. Add the slim banner immediately above the grid:

```tsx
{cacheIsSlim && (
  <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
    <svg className="h-4 w-4 shrink-0 animate-spin text-amber-500" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
    <span>
      <strong>Índice básico cargado.</strong> Los datos completos (imágenes, filtros de atributos) se están cargando en segundo plano y aparecerán automáticamente.
    </span>
  </div>
)}
```

- [ ] **Step 6.4: Verify TypeScript**

```bash
npx tsc --noEmit -p tsconfig.app.json 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 6.5: Test manually**

Start the app:

```bash
npm run dev:remote
```

To simulate a slim response, you can temporarily delete the `catalog_cache` row and the `catalog_index` row in Supabase SQL Editor:

```sql
delete from public.catalog_cache where tenant_key = 'prod:8f2f3e2f-8b16-4195-b1ae-e8b2bcc91f57:en';
delete from public.catalog_index where tenant_key = 'prod:8f2f3e2f-8b16-4195-b1ae-e8b2bcc91f57:en';
```

Then open http://127.0.0.1:4173/login, log in, and observe:
- First load completes in < 20s (slim index built) instead of 41s
- Amber banner "Índice básico cargado" appears
- Products show without attribute filters (collection/range/finish empty)
- ProductCard thumbnails load lazily via `/api/asset`
- After 60s, page auto-reloads with full data (no banner)

- [ ] **Step 6.6: Commit**

```bash
git add src/app/App.tsx
git commit -m "feat: show slim-mode banner and auto-refresh when catalog index is slim"
```

---

## Task 7: Deploy and verify

- [ ] **Step 7.1: Push and deploy**

```bash
git push
```

Wait for Vercel to deploy automatically, or run:

```bash
npx vercel --prod 2>&1 | tail -5
```

- [ ] **Step 7.2: Verify slim cold-start path**

In Supabase SQL Editor, delete both cache entries:

```sql
delete from public.catalog_cache where tenant_key = 'prod:8f2f3e2f-8b16-4195-b1ae-e8b2bcc91f57:en';
delete from public.catalog_index where tenant_key = 'prod:8f2f3e2f-8b16-4195-b1ae-e8b2bcc91f57:en';
```

Then time the first request:

```bash
curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" \
  "https://content-store-omega.vercel.app/api/catalog?tenant=tres-griferia" \
  -H "Authorization: Bearer <your-supabase-jwt>"
```

Expected: `200` in under 20 seconds (slim build). The `meta.slim` field in the response should be `true`.

- [ ] **Step 7.3: Verify full cache auto-built**

Wait 45 seconds after the slim build, then request again:

```bash
curl -s "https://content-store-omega.vercel.app/api/catalog?tenant=tres-griferia" \
  -H "Authorization: Bearer <your-supabase-jwt>" | python -m json.tool | grep slim
```

Expected: `"slim": null` or key absent → full cache is now serving.

- [ ] **Step 7.4: Verify CDN cache header**

```bash
curl -s -I "https://content-store-omega.vercel.app/api/catalog?tenant=tres-griferia" | grep -i "x-vercel-cache\|cache-control"
```

Expected:
```
cache-control: s-maxage=1800, stale-while-revalidate=86400
x-vercel-cache: HIT
```

---

## Done

After completing all tasks:
- Cold start serves in < 20s (slim index) instead of 41s
- Slim mode auto-escalates to full data in background
- Frontend shows amber banner during slim mode and auto-refreshes
- Full cache (with attribute filters + presigned thumbnails) continues to be built and cached as before
- Cron + Supabase warm-up are unchanged; slim index is an additional safety net
