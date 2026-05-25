/// <reference types="node" />
import { createClient } from '@supabase/supabase-js';
import type { CatalogPageMeta, CatalogQueryParams, CatalogSortKey } from '../src/features/catalog/model/catalogTypes.js';
import {
  buildBrandOptions,
  buildCategoryLabelMap,
  buildCategoryOptions,
  buildCategoryTree,
  buildFacetOptions,
  buildPriceRange,
  buildStatusOptions,
  buildTypeOptions,
  cleanText,
  filterProducts,
  groupProductsForDisplay,
  hasAssets,
  hasDocuments,
  hasImages,
  hasMixedMedia,
  isTestProduct,
  normalizeKey,
  resolveCategorySelectionIds,
} from './_lib/catalogUtils.js';
import type { Product } from '../src/features/catalog/api/productService.js';
import { requireAuth } from './_lib/auth.js';
import { checkRateLimit, getClientIp } from './_lib/rateLimit.js';

type TenantConfig = {
  clientId: string;
  clientSecret: string;
  orgId: string;
  env: 'test' | 'prod';
  context?: string;
};

type TenantConfigMap = Record<string, TenantConfig>;

type BluestoneTokenResponse = {
  access_token: string;
};

type AssetDownloadResponse = {
  assets?: Array<{
    assetId?: string;
    presignedUrl?: string;
    fileName?: string;
  }>;
};

type DefinitionRecord = {
  id?: string;
  number?: string;
  name?: string;
  group?: string | null;
  dataType?: string;
};

type CatalogBaseMeta = Omit<
  CatalogPageMeta,
  'currentPage' | 'pageSize' | 'totalPages' | 'filteredGroupCount' | 'cacheAgeMs' | 'stale'
>;

type CatalogCacheEntry = {
  data: Product[];
  meta: CatalogBaseMeta;
  fetchedAt: number;
};

type IndexedAttributeRecord = {
  definitionId: string;
  definitionName: string;
  name: string;
  group: string;
  dataType: string;
  value: string;
  displayValue: string;
  rawValue: unknown;
};

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

type HeaderRecord = Record<string, string | string[] | undefined>;
type HeaderGetter = { get: (name: string) => string | null };

const isHeaderGetter = (value: unknown): value is HeaderGetter =>
  typeof value === 'object' && value !== null && typeof (value as HeaderGetter).get === 'function';

const getCorsHeaders = (request: Request | { headers?: HeaderRecord; url?: string }) => {
  const headerSource =
    request && typeof request === 'object' && 'headers' in request ? (request as { headers?: HeaderRecord }).headers : undefined;
  const origin =
    isHeaderGetter(headerSource)
      ? headerSource.get('origin')
      : Array.isArray(headerSource?.origin)
        ? headerSource.origin[0]
        : headerSource?.origin;

  if (!origin) return corsHeaders;

  const requestUrl =
    typeof request?.url === 'string'
      ? request.url
      : `https://${Array.isArray(headerSource?.host) ? headerSource.host[0] : headerSource?.host || 'content-store-omega.vercel.app'}`;
  const requestOrigin = new URL(requestUrl).origin;
  const allowList = (process.env.CATALOG_ALLOWED_ORIGINS || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

  if (origin === requestOrigin || allowList.includes('*') || allowList.includes(origin)) {
    return {
      ...corsHeaders,
      'Access-Control-Allow-Origin': origin,
      Vary: 'Origin',
    };
  }

  return corsHeaders;
};

const DEFAULT_TENANT = 'default';
const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 120;
const MEMORY_CACHE_TTL_MS = 5 * 60 * 1000;
const SUPABASE_CACHE_TTL_MS = 30 * 60 * 1000;
const REFRESH_GRACE_MS = 2 * 60 * 60 * 1000;
const BLUESTONE_TIMEOUT_MS = 20_000;
const BLUESTONE_ATTEMPTS = 4;
const CATALOG_PREVIEW_ASSETS_PER_PRODUCT = 1;

const definitionCache = new Map<string, Promise<Map<string, DefinitionRecord>>>();
const catalogCache = new Map<string, CatalogCacheEntry>();
const refreshInFlight = new Map<string, Promise<CatalogCacheEntry>>();
const accessTokenCache = new Map<string, { token: string; expiresAt: number }>();

let supabaseAdminClient: ReturnType<typeof createClient> | null | undefined;

const getSupabaseAdmin = () => {
  if (supabaseAdminClient !== undefined) return supabaseAdminClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    supabaseAdminClient = null;
    return null;
  }
  supabaseAdminClient = createClient(url, key, { auth: { persistSession: false } });
  return supabaseAdminClient;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const compareStrings = (a: unknown, b: unknown) =>
  String(a || '').localeCompare(String(b || ''), 'es', { sensitivity: 'base', numeric: true });

const getProductUpdatedAt = (product: Product) => {
  const raw = product.updatedAt || product.lastUpdate || product.createDate || '';
  const time = Date.parse(String(raw));
  return Number.isNaN(time) ? 0 : time;
};

const getProductVariantCount = (product: Product) =>
  Array.isArray(product.variants) ? product.variants.length : 0;

const getRelevanceScore = (product: Product) => {
  let score = 0;
  if ((product.images?.length || 0) > 0 || product.previewImageAssetId) score += 1000;
  if (hasDocuments(product)) score += 120;
  if (hasAssets(product)) score += 40;
  if (getProductVariantCount(product) > 0) score += 20;
  score += Math.min((product.images?.length || 0) * 10, 90);
  score += getProductUpdatedAt(product) > 0 ? 5 : 0;
  return score;
};

const sortCatalogProducts = (products: Product[], sortBy: CatalogSortKey) => {
  const next = [...products];
  switch (sortBy) {
    case 'name_asc':
      return next.sort((a, b) => compareStrings(a.name, b.name));
    case 'name_desc':
      return next.sort((a, b) => compareStrings(b.name, a.name));
    case 'sku_asc':
      return next.sort((a, b) => compareStrings(a.sku || a.number, b.sku || b.number));
    case 'updated_desc':
      return next.sort((a, b) => getProductUpdatedAt(b) - getProductUpdatedAt(a) || compareStrings(a.name, b.name));
    case 'variants_desc':
      return next.sort((a, b) => getProductVariantCount(b) - getProductVariantCount(a) || compareStrings(a.name, b.name));
    case 'relevance':
    default:
      return next.sort((a, b) => getRelevanceScore(b) - getRelevanceScore(a) || compareStrings(a.name, b.name));
  }
};

const getAuthHeaderValue = (request: { headers?: Record<string, string | string[] | undefined> }) => {
  const authorization = request.headers?.authorization;
  return Array.isArray(authorization) ? authorization[0] : authorization;
};

const hasRefreshAccess = (request: { headers?: Record<string, string | string[] | undefined> }) => {
  const secret = process.env.CRON_SECRET || process.env.CATALOG_REFRESH_SECRET;
  if (!secret) return false;

  const authHeader = getAuthHeaderValue(request);
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7) === secret;
  }

  const explicitHeader = request.headers?.['x-catalog-refresh-secret'];
  const provided = Array.isArray(explicitHeader) ? explicitHeader[0] : explicitHeader;
  return provided === secret;
};

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

const fetchWithRetry = async (input: string | URL, init: RequestInit, attempts = BLUESTONE_ATTEMPTS, timeoutMs = BLUESTONE_TIMEOUT_MS) => {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const controller = new AbortController();
      timeout = setTimeout(
        () => controller.abort(new Error(`Bluestone request timeout after ${timeoutMs}ms`)),
        timeoutMs
      );
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      if (response.ok || (response.status !== 429 && response.status < 500)) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    } finally {
      if (timeout) clearTimeout(timeout);
    }

    if (attempt < attempts) {
      await sleep(500 * attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Request failed after retries');
};

const normalizeDefinition = (definition: unknown): DefinitionRecord | null => {
  if (!definition || typeof definition !== 'object') return null;
  const record = definition as Record<string, unknown>;
  if (!record.id) return null;

  return {
    id: String(record.id),
    number: record.number ? String(record.number) : undefined,
    name: cleanText(record.name || record.label || record.id),
    group: record.group ? cleanText(record.group) : null,
    dataType: record.dataType ? cleanText(record.dataType) : undefined,
  };
};

const TENANT_MAP: TenantConfigMap = (() => {
  const raw = process.env.BLUESTONE_TENANTS_JSON;
  if (!raw) {
    const clientId = process.env.BLUESTONE_CLIENT_ID;
    const clientSecret = process.env.BLUESTONE_CLIENT_SECRET;
    const orgId = process.env.BLUESTONE_ORG_ID;
    const env = (process.env.BLUESTONE_ENV || 'test') as TenantConfig['env'];

    if (!clientId || !clientSecret || !orgId) return {};

    return {
      [DEFAULT_TENANT]: {
        clientId,
        clientSecret,
        orgId,
        env,
        context: process.env.BLUESTONE_CONTEXT || 'en',
      },
    };
  }

  try {
    const parsed = JSON.parse(raw) as TenantConfigMap;
    return Object.fromEntries(
      Object.entries(parsed).filter(([, config]) => Boolean(config?.clientId && config?.clientSecret && config?.orgId && config?.env))
    );
  } catch {
    return {};
  }
})();

const getTenantConfig = (tenantId: string): TenantConfig | null =>
  TENANT_MAP[tenantId] || TENANT_MAP[DEFAULT_TENANT] || null;

const getConfiguredTenantIds = () => {
  const ids = Object.keys(TENANT_MAP);
  return ids.length ? ids : [DEFAULT_TENANT];
};

const buildTenantCacheKey = (tenant: TenantConfig) => `${tenant.env}:${tenant.orgId}:${tenant.context || 'en'}`;

const getBaseUrl = (env: TenantConfig['env']) =>
  env === 'test' ? 'https://api.test.bluestonepim.com' : 'https://api.bluestonepim.com';

const getTokenUrl = (env: TenantConfig['env']) =>
  env === 'test' ? 'https://idp.test.bluestonepim.com/op/token' : 'https://idp.bluestonepim.com/op/token';

const extractTextCandidates = (value: unknown, preferredLocales: string[] = ['es', 'en']): string => {
  if (value === null || value === undefined) return '';

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return cleanText(value);
  }

  if (Array.isArray(value)) {
    return value.map(item => extractTextCandidates(item, preferredLocales)).filter(Boolean).join(', ');
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const candidateKeys = ['displayValue', 'value', 'values', 'text', 'label', 'name', 'description'];

    for (const key of candidateKeys) {
      if (record[key] !== undefined && record[key] !== null) {
        const resolved = extractTextCandidates(record[key], preferredLocales);
        if (resolved) return resolved;
      }
    }

    for (const locale of preferredLocales) {
      if (record[locale] !== undefined && record[locale] !== null) {
        const resolved = extractTextCandidates(record[locale], preferredLocales);
        if (resolved) return resolved;
      }
    }

    const flattened = Object.values(record)
      .map(item => extractTextCandidates(item, preferredLocales))
      .filter(text => text && text !== '[object Object]');

    if (flattened.length) return flattened.join(', ');
  }

  return '';
};

const extractLocalizedValue = (value: unknown, preferredLocales: string[] = ['es', 'en']) =>
  extractTextCandidates(value, preferredLocales);

const formatAttributeValue = (value: unknown): string => {
  const resolved = extractTextCandidates(value);
  if (resolved) return resolved;
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'number') return String(value);
  return '';
};

const isOpaqueIdentifier = (value: string) => /^[a-f0-9]{20,}$/i.test(value) || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value);

const isSearchNoise = (value: string) => {
  const normalized = cleanText(value).trim();
  if (!normalized) return true;
  if (/^https?:\/\//i.test(normalized)) return true;
  if (isOpaqueIdentifier(normalized)) return true;
  if (/^(true|false|sí|si|no)$/i.test(normalized)) return true;
  return false;
};

const normalizeCatalogState = (value: unknown) => {
  const normalized = normalizeKey(value);
  if (!normalized) return '';
  if (normalized.includes('playground') || normalized.includes('sandbox') || normalized.includes('test')) return 'draft';
  if (normalized.includes('draft') || normalized.includes('borrador')) return 'draft';
  if (normalized.includes('publish') || normalized.includes('published') || normalized.includes('public')) return 'published';
  if (normalized.includes('review') || normalized.includes('pending') || normalized.includes('to be published')) return 'to-be-published';
  if (normalized.includes('archive') || normalized.includes('archiv')) return 'archived';
  return normalized;
};

const normalizeProductBatch = (data: unknown) => {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    if (Array.isArray(record.data)) return record.data;
    if (Array.isArray(record.results)) return record.results;
    if (Array.isArray(record.items)) return record.items;
  }
  return [];
};

const chunk = <T,>(items: T[], size: number) => {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
};

const mapWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
) => {
  const results: R[] = [];
  const queue = [...items].map((item, index) => ({ item, index }));
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (queue.length) {
      const next = queue.shift();
      if (!next) break;
      results[next.index] = await mapper(next.item, next.index);
    }
  });

  await Promise.all(workers);
  return results;
};

const extractPreviewAssetIds = (product: unknown, maxAssets = CATALOG_PREVIEW_ASSETS_PER_PRODUCT) => {
  if (!product || typeof product !== 'object') return [];
  const assets = (product as { assets?: unknown[] }).assets;
  if (!Array.isArray(assets)) return [];
  return assets
    .map(asset => String(asset).trim())
    .filter(Boolean)
    .slice(0, maxAssets);
};

const isImageFileName = (fileName: string) => /\.(png|jpe?g|gif|webp|bmp|svg|avif|tiff?)$/i.test(fileName);

const scoreImageByFileName = (image: { alt?: string; url?: string; isPrimary?: boolean }) => {
  const descriptor = (image.alt || image.url || '').toLowerCase();
  let score = 0;
  const positive = ['foto', 'photo', 'principal', 'main', 'hero', 'producto', 'product', 'real', 'realista', 'lifestyle', 'render'];
  const negative = ['dibujo', 'drawing', 'sketch', 'esquema', 'diagram', 'diagrama', 'technical', 'tecnica', 'plano', 'blueprint', 'lineart', 'dwg', 'cad', 'section', 'vista', 'alzado', 'perfil', 'medida', 'medidas', 'dimension'];
  for (const keyword of positive) if (descriptor.includes(keyword)) score += 80;
  for (const keyword of negative) if (descriptor.includes(keyword)) score -= 260;
  return score;
};

const fetchDefinitions = async (tenant: TenantConfig, token: string) => {
  const cacheKey = `${tenant.env}:${tenant.orgId}:${tenant.context || 'en'}`;
  const cached = definitionCache.get(cacheKey);
  if (cached) return cached;

  const promise = (async () => {
    const baseUrl = getBaseUrl(tenant.env);
    const definitions = new Map<string, DefinitionRecord>();
    let page = 0;
    const pageSize = 1000;

    while (true) {
      const response = await fetchWithRetry(`${baseUrl}/pim/definitions?page=${page}&pageSize=${pageSize}`, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${token}`,
          'x-organization-id': tenant.orgId,
          context: tenant.context || 'en',
          'context-fallback': 'true',
        },
      });

      if (!response.ok) {
        throw new Error(`Bluestone definitions request failed (${response.status}): ${await response.text()}`);
      }

      const payload = (await response.json()) as { data?: unknown[] };
      const batch = Array.isArray(payload?.data) ? payload.data : [];
      if (!batch.length) break;

      for (const definition of batch) {
        const normalized = normalizeDefinition(definition);
        if (!normalized?.id) continue;
        definitions.set(normalized.id, normalized);
        if (normalized.number) definitions.set(normalized.number, normalized);
      }

      if (batch.length < pageSize) break;
      page += 1;
    }

    return definitions;
  })();

  definitionCache.set(cacheKey, promise);
  return promise;
};

const getAccessToken = async (tenant: TenantConfig): Promise<string> => {
  const cacheKey = buildTenantCacheKey(tenant);
  const cached = accessTokenCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

  const response = await fetchWithRetry(getTokenUrl(tenant.env), {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: tenant.clientId,
      client_secret: tenant.clientSecret,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token request failed (${response.status}): ${await response.text()}`);
  }

  const data = (await response.json()) as BluestoneTokenResponse;
  if (!data.access_token) {
    throw new Error('Bluestone token response did not include an access token');
  }

  accessTokenCache.set(cacheKey, {
    token: data.access_token,
    expiresAt: Date.now() + 55 * 60 * 1000,
  });

  return data.access_token;
};

const fetchAssetDownloads = async (tenant: TenantConfig, token: string, assetIds: string[]) => {
  const uniqueAssetIds = [...new Set(assetIds.map(assetId => String(assetId).trim()).filter(Boolean))];
  const downloads = new Map<string, { assetId: string; presignedUrl: string; fileName: string }>();
  if (!uniqueAssetIds.length) return downloads;

  const baseUrl = getBaseUrl(tenant.env);
  const batches = chunk(uniqueAssetIds, 100);

  await mapWithConcurrency(batches, 4, async batch => {
    const response = await fetchWithRetry(`${baseUrl}/media-bank/assets/download`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        'x-organization-id': tenant.orgId,
        context: tenant.context || 'en',
        'context-fallback': 'true',
      },
      body: JSON.stringify({ assetIds: batch, expiresInMinutes: 60 }),
    });

    if (!response.ok) {
      throw new Error(`Bluestone assets request failed (${response.status}): ${await response.text()}`);
    }

    const payload = (await response.json()) as AssetDownloadResponse;
    for (const asset of payload.assets || []) {
      if (!asset?.assetId || !asset?.presignedUrl) continue;
      downloads.set(asset.assetId, {
        assetId: asset.assetId,
        presignedUrl: asset.presignedUrl,
        fileName: asset.fileName || asset.assetId,
      });
    }
  });

  return downloads;
};

const normalizeMediaItem = (
  media: unknown
): { kind: 'image'; item: { id: string; url: string; downloadUrl: string; alt: string; isPrimary?: boolean } } | {
  kind: 'attachment';
  item: { id: string; name: string; url: string; downloadUrl: string; type: string };
} | null => {
  if (!media || typeof media !== 'object') return null;
  const record = media as Record<string, unknown>;
  const contentType = cleanText(record.contentType).toLowerCase();
  const url = cleanText(record.previewUri || record.downloadUri || record.url);
  const downloadUrl = cleanText(record.downloadUri || record.previewUri || record.url);
  if (!url && !downloadUrl) return null;

  if (contentType.includes('image/')) {
    return {
      kind: 'image',
      item: {
        id: cleanText(record.id || record.number || record.assetId),
        url: url || downloadUrl,
        downloadUrl: downloadUrl || url,
        alt: cleanText(record.fileName || record.name || record.title || 'Imagen'),
        isPrimary: Boolean(record.isPrimary),
      },
    };
  }

  return {
    kind: 'attachment',
    item: {
      id: cleanText(record.id || record.number || record.assetId),
      name: cleanText(record.fileName || record.name || record.title || 'Documento'),
      url: downloadUrl || url,
      downloadUrl: downloadUrl || url,
      type: cleanText(record.contentType || 'application/octet-stream') || 'application/octet-stream',
    },
  };
};

const extractEmbeddedMedia = (product: Record<string, unknown>) => {
  const images: Array<{ id: string; url: string; downloadUrl: string; alt: string; isPrimary?: boolean }> = [];
  const attachments: Array<{ id: string; name: string; url: string; downloadUrl: string; type: string }> = [];
  const media = Array.isArray(product.media) ? product.media : [];

  for (const mediaItem of media) {
    const normalized = normalizeMediaItem(mediaItem);
    if (!normalized) continue;
    if (normalized.kind === 'image') {
      images.push(normalized.item);
      continue;
    }
    attachments.push(normalized.item);
  }

  images.sort((a, b) => scoreImageByFileName(b) - scoreImageByFileName(a));
  if (images.length > 0) images[0]!.isPrimary = true;

  return {
    images,
    attachments,
    hasImage: images.length > 0,
    hasDocument: attachments.length > 0,
  };
};

// TRES Grifería standard image slots — only these two are shown, in this order.
// If a product has at least one asset matching these suffixes, the TRES filter
// activates: only IMG_L and PLUMI_L are exposed (deduplicated), all others hidden.
// Products without these suffixes fall through to the legacy heuristic sort.
const getTresSlot = (fileName: string): 0 | 1 | null => {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('_img_l.jpg')) return 0;   // first / primary
  if (lower.endsWith('_plumi_l.jpg')) return 1;  // last
  return null;
};

const buildProductMedia = (
  assetIds: string[],
  assetMap: Map<string, { assetId: string; presignedUrl: string; fileName: string }>
) => {
  const images: Array<{ id: string; url: string; downloadUrl: string; alt: string; isPrimary?: boolean }> = [];
  const attachments: Array<{ id: string; name: string; url: string; downloadUrl: string; type: string }> = [];

  for (const assetId of assetIds) {
    const asset = assetMap.get(assetId);
    if (!asset) continue;

    const fileName = asset.fileName || asset.assetId;
    const lower = fileName.toLowerCase();
    const entry = {
      id: asset.assetId,
      url: asset.presignedUrl,
      downloadUrl: asset.presignedUrl,
    };

    if (isImageFileName(fileName)) {
      images.push({ ...entry, alt: fileName, isPrimary: false });
      continue;
    }

    attachments.push({
      ...entry,
      name: fileName,
      type: lower.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
    });
  }

  // TRES filter: if any image matches _IMG_L / _PLUMI_L naming, apply strict filter
  const hasTresImages = images.some(img => getTresSlot(img.alt) !== null);
  if (hasTresImages) {
    // Keep only the first occurrence of each slot (deduplicates repeated PLUMIL/IMG_L)
    const slotMap = new Map<number, typeof images[0]>();
    for (const img of images) {
      const slot = getTresSlot(img.alt);
      if (slot === null) continue;
      if (!slotMap.has(slot)) slotMap.set(slot, img);
    }
    const filtered = ([slotMap.get(0), slotMap.get(1)] as Array<typeof images[0] | undefined>)
      .filter((img): img is typeof images[0] => img !== undefined);
    if (filtered.length > 0) filtered[0]!.isPrimary = true;
    return { images: filtered, attachments };
  }

  // Legacy: heuristic sort for non-TRES products
  images.sort((a, b) => scoreImageByFileName(b) - scoreImageByFileName(a));
  if (images.length > 0) images[0]!.isPrimary = true;
  return { images, attachments };
};

const summarizeAttributes = (attributes: unknown[]): IndexedAttributeRecord[] =>
  attributes.map(attribute => {
    const source = typeof attribute === 'object' && attribute !== null ? (attribute as Record<string, unknown>) : {};
    const rawValue = source.value ?? source.values;
    const displayValue = formatAttributeValue(rawValue);
    const preferredName = cleanText(source.definitionName || source.name || source.label || '');
    const fallbackName = cleanText(source.definitionId || 'Atributo');
    return {
      definitionId: cleanText(source.definitionId || ''),
      definitionName: preferredName || fallbackName,
      name: preferredName || fallbackName,
      group: cleanText(source.groupName || source.group || ''),
      dataType: cleanText(source.dataType || ''),
      value: displayValue,
      displayValue,
      rawValue,
    };
  });

const enrichAttributes = (attributes: unknown[], definitionMap: Map<string, DefinitionRecord>) =>
  attributes.map(attribute => {
    const source = typeof attribute === 'object' && attribute !== null ? (attribute as Record<string, unknown>) : {};
    const definitionId = String(source.definitionId || '');
    const definition = definitionMap.get(definitionId);
    const rawValue = source.value ?? source.values;
    const displayValue = formatAttributeValue(rawValue);

    return {
      definitionId,
      definitionName: cleanText(source.definitionName || source.name || source.label || definition?.name || definitionId || 'Atributo'),
      name: cleanText(source.definitionName || source.name || source.label || definition?.name || definitionId || 'Atributo'),
      group: cleanText(definition?.group || source.groupName || source.group || ''),
      dataType: cleanText(definition?.dataType || source.dataType || ''),
      value: displayValue,
      displayValue,
      rawValue,
      readOnly: Boolean(source.readOnly),
    };
  });

const buildAttributeSearchText = (attributes: Array<Record<string, unknown>>) =>
  attributes
    .map(attribute =>
      [
        isSearchNoise(cleanText(attribute.definitionName).trim()) ? '' : attribute.definitionName,
        isSearchNoise(cleanText(attribute.name).trim()) ? '' : attribute.name,
        attribute.group,
        attribute.dataType,
        isSearchNoise(cleanText(attribute.displayValue).trim()) ? '' : attribute.displayValue,
        isSearchNoise(cleanText(attribute.value).trim()) ? '' : attribute.value,
      ]
        .map(value => cleanText(value).trim())
        .filter(Boolean)
        .join(' ')
    )
    .filter(Boolean)
    .join(' ')
    .slice(0, 320);

const ATTRIBUTE_KEYSETS = {
  collection: ['collection', 'coleccion', 'colección'],
  range: ['range', 'gama'],
  ean: ['ean', 'gtin', 'codigoean', 'códigoean', 'codigo ean', 'código ean'],
  flowRate: ['692d69b4f8de9bb8df7818d5', 'caudal', 'flow rate', 'flowrate', 'l/min', 'l min'],
  finish: ['692962777118d05218bb7788', 'finish', 'acabado', 'acabados tres', 'color'],
  price: ['price', 'precio', 'pvp'],
  weight: ['weight', 'peso'],
} as const;

const matchesAttributeKey = (attribute: Record<string, unknown>, keys: readonly string[]) => {
  const haystack = [
    attribute.definitionName,
    attribute.name,
    attribute.definitionId,
    attribute.label,
  ]
    .map(value => normalizeKey(value))
    .filter(Boolean);

  return haystack.some(value => keys.some(key => value === normalizeKey(key) || value.includes(normalizeKey(key))));
};

const findAttributeRecord = (attributes: Array<Record<string, unknown>>, keys: readonly string[]) =>
  attributes.find(attribute => matchesAttributeKey(attribute, keys));

const parseNumberish = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const match = cleanText(value).replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const parsed = Number.parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const getAttributeText = (attributes: Array<Record<string, unknown>>, keys: readonly string[]) =>
  cleanText(
    findAttributeRecord(attributes, keys)?.displayValue ??
      findAttributeRecord(attributes, keys)?.value ??
      ''
  ).trim();

const getAttributeNumber = (attributes: Array<Record<string, unknown>>, keys: readonly string[]) =>
  parseNumberish(
    findAttributeRecord(attributes, keys)?.displayValue ??
      findAttributeRecord(attributes, keys)?.value
  );

const normalizeCatalogProduct = (
  product: Record<string, unknown>,
  media: {
    images: Array<{ id: string; url: string; downloadUrl: string; alt: string; isPrimary?: boolean }>;
    attachments: Array<{ id: string; name: string; url: string; downloadUrl: string; type: string }>;
  },
  attributes: Array<Record<string, unknown>>,
  options?: { assetIds?: string[]; includeAttributes?: boolean; includeMediaUrls?: boolean }
): Product => {
  const metadata = typeof product.metadata === 'object' && product.metadata !== null ? (product.metadata as Record<string, unknown>) : {};
  const metadataName = extractLocalizedValue(metadata.name);
  const metadataDescription = extractLocalizedValue(metadata.description);
  const metadataNumber = extractLocalizedValue(metadata.number);
  const metadataType = extractLocalizedValue(metadata.type);
  const metadataBrand = extractLocalizedValue(metadata.brand || metadata.manufacturer || metadata.vendor || metadata.publisher);
  const assetIds = options?.assetIds ?? extractPreviewAssetIds(product);
  const includeAttributes = options?.includeAttributes ?? true;
  const includeMediaUrls = options?.includeMediaUrls ?? true;
  const previewImage = media.images[0];
  const previewImageAssetId = previewImage?.id ?? assetIds[0];
  const collection = getAttributeText(attributes, ATTRIBUTE_KEYSETS.collection);
  const range = getAttributeText(attributes, ATTRIBUTE_KEYSETS.range);
  const ean = getAttributeText(attributes, ATTRIBUTE_KEYSETS.ean);
  const flowRate = getAttributeText(attributes, ATTRIBUTE_KEYSETS.flowRate);
  const finish = getAttributeText(attributes, ATTRIBUTE_KEYSETS.finish);
  const price = getAttributeNumber(attributes, ATTRIBUTE_KEYSETS.price);
  const weight = getAttributeNumber(attributes, ATTRIBUTE_KEYSETS.weight);

  return {
    id: String(product.id || product._id || metadata.id || metadata.number || ''),
    name: cleanText(metadataName || product.name || product.title || product.description || 'Producto'),
    description: cleanText(metadataDescription || extractLocalizedValue(product.description) || ''),
    sku: cleanText(metadataNumber || product.number || product.sku || ''),
    number: cleanText(metadataNumber || product.number || ''),
    variantParentId: cleanText(metadata.variantParentId || product.variantParentId || ''),
    images: includeMediaUrls ? media.images : [],
    attachments: includeMediaUrls ? media.attachments : [],
    previewImageAssetId,
    previewImageAlt: previewImage?.alt,
    thumbnailUrl: previewImage?.url,
    thumbnailDownloadUrl: previewImage?.downloadUrl,
    collection,
    range,
    ean,
    flowRate,
    finish,
    price,
    weight,
    assets: assetIds,
    attributes: includeAttributes ? attributes : [],
    attributeText: buildAttributeSearchText(attributes),
    categories: Array.isArray(product.categories) ? product.categories.map(category => String(category)).filter(Boolean) : [],
    category: cleanText(metadataType || product.type || 'Sin categoría'),
    brand: cleanText(metadataBrand || product.brand || product.manufacturer || product.vendor || ''),
    stock: typeof product.stock === 'number' ? product.stock : undefined,
    hasImage: media.images.length > 0 || Boolean(previewImageAssetId),
    hasDocument: media.attachments.length > 0,
    hasAsset: media.images.length > 0 || media.attachments.length > 0 || assetIds.length > 0,
    type: cleanText(metadataType || product.type || ''),
    state: normalizeCatalogState(metadata.state || product.state),
    publicationState: normalizeCatalogState(metadata.publicationState || product.publicationState),
    lastUpdate: metadata.lastUpdate || product.lastUpdate,
    updatedAt: metadata.updatedAt || product.updatedAt,
    createDate: metadata.createDate || product.createDate,
    updatedBy: metadata.updatedBy || product.updatedBy,
    lastUpdatedBy: metadata.lastUpdatedBy || product.lastUpdatedBy,
    variants: Array.isArray(product.variants) ? (product.variants as Record<string, unknown>[]) : [],
    relations: Array.isArray(product.relations) ? (product.relations as Record<string, unknown>[]) : [],
  };
};

const buildFacetOptions = (products: Product[], pickValue: (product: Product) => string | undefined): CatalogPageMeta['rangeOptions'] => {
  const countMap = new Map<string, { label: string; count: number }>();

  for (const product of products) {
    const raw = cleanText(pickValue(product) || '').trim();
    if (!raw) continue;
    const key = normalizeKey(raw);
    const current = countMap.get(key);
    if (current) {
      current.count += 1;
    } else {
      countMap.set(key, { label: raw, count: 1 });
    }
  }

  return [...countMap.entries()]
    .map(([id, value]) => ({ id, label: value.label, count: value.count }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'));
};

const buildPriceRange = (products: Product[]): CatalogPageMeta['priceRange'] => {
  const prices = products
    .map(product => (typeof product.price === 'number' && Number.isFinite(product.price) ? product.price : undefined))
    .filter((value): value is number => value !== undefined);

  if (prices.length === 0) return { min: 0, max: 0 };

  return {
    min: Math.floor(Math.min(...prices)),
    max: Math.ceil(Math.max(...prices)),
  };
};

const buildCatalogBaseMeta = (products: Product[]): CatalogBaseMeta => {
  const categoryLabelMap = buildCategoryLabelMap(products);
  const categoryOptions = buildCategoryOptions(products, categoryLabelMap);
  const categoryTree = buildCategoryTree(categoryOptions);
  const visibleCatalogCount = products.filter(product => normalizeKey(product.type) !== 'variant').length;

  return {
    totalCatalogCount: visibleCatalogCount,
    totalRawProductCount: products.length,
    categoryLabelMap,
    brandOptions: buildBrandOptions(products),
    rangeOptions: buildFacetOptions(products, product => product.range),
    flowOptions: buildFacetOptions(products, product => product.flowRate),
    finishOptions: buildFacetOptions(products, product => product.finish),
    priceRange: buildPriceRange(products),
    categoryTree,
    typeOptions: buildTypeOptions(products),
    statusOptions: buildStatusOptions(products),
    imageCount: products.reduce((sum, product) => sum + (product.assets?.length || 0), 0),
    attachmentCount: products.reduce((sum, product) => sum + (product.attachments?.length || 0), 0),
    assetCount: products.filter(product => hasAssets(product)).length,
    withImagesCount: products.filter(product => hasImages(product)).length,
    withDocumentsCount: products.filter(product => hasDocuments(product)).length,
    mixedMediaCount: products.filter(product => hasMixedMedia(product)).length,
  };
};

const parseCatalogQuery = (query: Record<string, unknown>): CatalogQueryParams => ({
  tenantId: typeof query.tenant === 'string' ? query.tenant : DEFAULT_TENANT,
  page: clamp(Number.parseInt(String(query.page || '1'), 10) || 1, 1, Number.MAX_SAFE_INTEGER),
  pageSize: clamp(Number.parseInt(String(query.pageSize || DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE),
  sortBy: (typeof query.sortBy === 'string' ? query.sortBy : 'relevance') as CatalogSortKey,
  searchTerm: typeof query.searchTerm === 'string' ? query.searchTerm : '',
  selectedName: typeof query.selectedName === 'string' ? query.selectedName : '',
  selectedNumber: typeof query.selectedNumber === 'string' ? query.selectedNumber : '',
  selectedCollection: typeof query.selectedCollection === 'string' ? query.selectedCollection : '',
  selectedRange: typeof query.selectedRange === 'string' ? query.selectedRange : '',
  selectedPriceMin: typeof query.selectedPriceMin === 'string' ? query.selectedPriceMin : '',
  selectedPriceMax: typeof query.selectedPriceMax === 'string' ? query.selectedPriceMax : '',
  selectedEan: typeof query.selectedEan === 'string' ? query.selectedEan : '',
  selectedFlow: typeof query.selectedFlow === 'string' ? query.selectedFlow : '',
  selectedFinish: typeof query.selectedFinish === 'string' ? query.selectedFinish : '',
  selectedAttributeQuery: typeof query.selectedAttributeQuery === 'string' ? query.selectedAttributeQuery : '',
  selectedBrand: typeof query.selectedBrand === 'string' ? query.selectedBrand : 'all',
  selectedCategory: typeof query.selectedCategory === 'string' ? query.selectedCategory : 'all',
  selectedType: typeof query.selectedType === 'string' ? query.selectedType : 'all',
  selectedStatus: typeof query.selectedStatus === 'string' ? query.selectedStatus : 'all',
  selectedMediaFilter: typeof query.selectedMediaFilter === 'string' ? query.selectedMediaFilter : 'all',
  selectedQuickFilter: typeof query.selectedQuickFilter === 'string' ? query.selectedQuickFilter : 'all',
});

const buildCatalogPage = (entry: CatalogCacheEntry, query: CatalogQueryParams) => {
  const selectedCategoryIds = resolveCategorySelectionIds(query.selectedCategory, entry.meta.categoryTree);
  const filteredProducts = filterProducts(
    entry.data,
    query.searchTerm,
    query.selectedName,
    query.selectedNumber,
    query.selectedCollection,
    query.selectedRange,
    query.selectedPriceMin,
    query.selectedPriceMax,
    query.selectedEan,
    query.selectedFlow,
    query.selectedFinish,
    query.selectedAttributeQuery,
    query.selectedBrand,
    selectedCategoryIds,
    query.selectedType,
    query.selectedStatus,
    query.selectedMediaFilter,
    query.selectedQuickFilter
  );
  const groupedProducts = groupProductsForDisplay(filteredProducts);
  const sortedProducts = sortCatalogProducts(groupedProducts, query.sortBy);
  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / query.pageSize));
  const currentPage = clamp(query.page, 1, totalPages);
  const startIndex = (currentPage - 1) * query.pageSize;
  const pageProducts = sortedProducts.slice(startIndex, startIndex + query.pageSize);
  const cacheAgeMs = Date.now() - entry.fetchedAt;

  return {
    products: pageProducts,
    meta: {
      ...entry.meta,
      currentPage,
      pageSize: query.pageSize,
      totalPages,
      filteredGroupCount: groupedProducts.length,
      imageCount: filteredProducts.reduce((sum, product) => sum + (product.assets?.length || 0), 0),
      attachmentCount: filteredProducts.reduce((sum, product) => sum + (product.attachments?.length || 0), 0),
      assetCount: filteredProducts.filter(product => hasAssets(product)).length,
      withImagesCount: filteredProducts.filter(product => hasImages(product)).length,
      withDocumentsCount: filteredProducts.filter(product => hasDocuments(product)).length,
      mixedMediaCount: filteredProducts.filter(product => hasMixedMedia(product)).length,
      cacheAgeMs,
      stale: cacheAgeMs > SUPABASE_CACHE_TTL_MS,
    } satisfies CatalogPageMeta,
  };
};

const readSupabaseCache = async (cacheKey: string): Promise<CatalogCacheEntry | null> => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  try {
    const { data } = await (supabase as ReturnType<typeof createClient>)
      .from('catalog_cache')
      .select('products, meta, fetched_at')
      .eq('tenant_key', cacheKey)
      .maybeSingle();

    const row = data as
      | {
          products?: unknown;
          meta?: unknown;
          fetched_at?: string;
        }
      | null;

    if (!row?.products || !row.fetched_at) return null;

    const products = Array.isArray(row.products) ? (row.products as Product[]) : [];
    const meta =
      row.meta && typeof row.meta === 'object'
        ? {
            rangeOptions: [],
            flowOptions: [],
            finishOptions: [],
            priceRange: { min: 0, max: 0 },
            ...(row.meta as CatalogBaseMeta),
          }
        : buildCatalogBaseMeta(products);

    return {
      data: products,
      meta,
      fetchedAt: new Date(String(row.fetched_at)).getTime(),
    };
  } catch {
    return null;
  }
};

const persistSupabaseCache = async (cacheKey: string, entry: CatalogCacheEntry) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  try {
    await ((supabase as ReturnType<typeof createClient>).from('catalog_cache') as any).upsert({
        tenant_key: cacheKey,
        products: entry.data,
        meta: entry.meta,
        fetched_at: new Date(entry.fetchedAt).toISOString(),
      });
  } catch {
    // Keep runtime resilient until every environment has the latest migration.
  }
};

const refreshCatalogIndex = (tenant: TenantConfig, cacheKey: string) => {
  const existing = refreshInFlight.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    const token = await getAccessToken(tenant);
    const baseUrl = getBaseUrl(tenant.env);
    const definitionMap = await fetchDefinitions(tenant, token);
    const allProducts: Record<string, unknown>[] = [];
    let cursor: string | null = null;

    do {
      const body = cursor
        ? {
            cursor,
            count: 100,
            views: [{ type: 'METADATA' }, { type: 'ATTRIBUTES' }, { type: 'ASSETS' }, { type: 'CATEGORIES' }],
          }
        : {
            count: 100,
            views: [{ type: 'METADATA' }, { type: 'ATTRIBUTES' }, { type: 'ASSETS' }, { type: 'CATEGORIES' }],
          };

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
        throw new Error(`Bluestone products request failed (${response.status}): ${await response.text()}`);
      }

      const payload = (await response.json()) as { nextCursor?: string | null; cursor?: string | null; data?: unknown[]; results?: unknown[]; items?: unknown[] };
      const batch = normalizeProductBatch(payload) as Record<string, unknown>[];
      allProducts.push(...batch);
      cursor = payload?.nextCursor || payload?.cursor || null;
    } while (cursor);

    const stagedProducts = allProducts.map(product => {
      const previewAssetIds = extractPreviewAssetIds(product);
      const rawAttributes = Array.isArray(product.attributes) ? (product.attributes as unknown[]) : [];
      const attributes = enrichAttributes(rawAttributes, definitionMap) as Array<Record<string, unknown>>;
      const embeddedMedia = extractEmbeddedMedia(product);

      return {
        product,
        previewAssetIds,
        attributes,
        embeddedMedia,
      };
    });

    const previewAssetIdsToHydrate = stagedProducts
      .filter(entry => entry.embeddedMedia.images.length === 0 && entry.previewAssetIds.length > 0)
      .map(entry => entry.previewAssetIds[0]!)
      .filter(Boolean);

    const hydratedPreviewAssets =
      previewAssetIdsToHydrate.length > 0
        ? await fetchAssetDownloads(tenant, token, previewAssetIdsToHydrate)
        : new Map<string, { assetId: string; presignedUrl: string; fileName: string }>();

    const normalizedProducts = stagedProducts
      .map(entry => {
        const media =
          entry.embeddedMedia.images.length > 0 || entry.embeddedMedia.attachments.length > 0
            ? entry.embeddedMedia
            : buildProductMedia(entry.previewAssetIds.slice(0, 1), hydratedPreviewAssets);

        return normalizeCatalogProduct(entry.product, media, entry.attributes, {
          assetIds: entry.previewAssetIds,
          includeAttributes: false,
          includeMediaUrls: false,
        });
      })
      .filter(product => !isTestProduct(product));

    const entry: CatalogCacheEntry = {
      data: normalizedProducts,
      meta: buildCatalogBaseMeta(normalizedProducts),
      fetchedAt: Date.now(),
    };

    catalogCache.set(cacheKey, entry);
    await persistSupabaseCache(cacheKey, entry);
    return entry;
  })();

  refreshInFlight.set(cacheKey, promise);
  return promise.finally(() => {
    refreshInFlight.delete(cacheKey);
  });
};

const getCatalogIndex = async (tenant: TenantConfig, options?: { forceRefresh?: boolean }) => {
  const cacheKey = buildTenantCacheKey(tenant);
  if (options?.forceRefresh) {
    return refreshCatalogIndex(tenant, cacheKey);
  }

  const memoryEntry = catalogCache.get(cacheKey);
  if (memoryEntry && Date.now() - memoryEntry.fetchedAt < MEMORY_CACHE_TTL_MS) {
    return memoryEntry;
  }

  if (memoryEntry && Date.now() - memoryEntry.fetchedAt < REFRESH_GRACE_MS) {
    void refreshCatalogIndex(tenant, cacheKey).catch(() => {});
    return memoryEntry;
  }

  const supabaseEntry = await readSupabaseCache(cacheKey);
  if (supabaseEntry) {
    catalogCache.set(cacheKey, supabaseEntry);
    if (Date.now() - supabaseEntry.fetchedAt > SUPABASE_CACHE_TTL_MS) {
      void refreshCatalogIndex(tenant, cacheKey).catch(() => {});
    }
    return supabaseEntry;
  }

  return refreshCatalogIndex(tenant, cacheKey);
};

const fetchProductDetail = async (tenant: TenantConfig, productId: string) => {
  const token = await getAccessToken(tenant);
  const baseUrl = getBaseUrl(tenant.env);
  const response = await fetchWithRetry(`${baseUrl}/pim/products/${encodeURIComponent(productId)}`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
      'x-organization-id': tenant.orgId,
      context: tenant.context || 'en',
    },
  });

  if (!response.ok) {
    throw new Error(`Bluestone product request failed (${response.status}): ${await response.text()}`);
  }

  const product = (await response.json()) as Record<string, unknown>;
  const assetIds = Array.isArray(product.assets) ? product.assets.map(asset => String(asset).trim()).filter(Boolean) : [];
  const embeddedMedia = extractEmbeddedMedia(product);
  const needsAssetDownloads = embeddedMedia.images.length === 0 && embeddedMedia.attachments.length === 0 && assetIds.length > 0;
  const [definitionMap, assetMap] = await Promise.all([
    fetchDefinitions(tenant, token),
    needsAssetDownloads ? fetchAssetDownloads(tenant, token, assetIds) : Promise.resolve(new Map<string, { assetId: string; presignedUrl: string; fileName: string }>()),
  ]);
  const media = needsAssetDownloads ? buildProductMedia(assetIds, assetMap) : embeddedMedia;
  const attributes = Array.isArray(product.attributes)
    ? (enrichAttributes(product.attributes as unknown[], definitionMap) as Array<Record<string, unknown>>)
    : [];

  return normalizeCatalogProduct(product, media, attributes, {
    assetIds,
    includeAttributes: true,
    includeMediaUrls: true,
  });
};

const sendJson = (res: { status: (statusCode: number) => void; setHeader: (name: string, value: string) => void; send: (body: string) => void }, statusCode: number, body: unknown, headers: Record<string, string> = corsHeaders) => {
  res.status(statusCode);
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(body));
};

export default async function handler(req: { method?: string; query: Record<string, unknown>; headers?: Record<string, string | string[] | undefined>; url?: string }, res: { status: (statusCode: number) => void; setHeader: (name: string, value: string) => void; send: (body: string) => void; end: () => void }) {
  if (req.method === 'OPTIONS') {
    Object.entries(getCorsHeaders(req)).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    res.status(200);
    res.end();
    return;
  }

  const refreshRequested = String(req.query.refresh || '').trim() === '1';
  let refreshAuthorized = refreshRequested && hasRefreshAccess(req);

  if (!refreshAuthorized) {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    if (refreshRequested) {
      refreshAuthorized = await checkSuperadminRole(auth.userId);
    }
  }

  if (!checkRateLimit(`${getClientIp(req)}:catalog`, 30, 60_000)) {
    sendJson(res, 429, { error: 'Too many requests' }, getCorsHeaders(req));
    return;
  }

  try {
    const query = parseCatalogQuery(req.query);
    const productId = typeof req.query.productId === 'string' ? req.query.productId.trim() : '';
    const tenant = getTenantConfig(query.tenantId);

    if (!tenant) {
      sendJson(res, 400, { error: 'Tenant not configured' }, getCorsHeaders(req));
      return;
    }

    if (refreshAuthorized) {
      const tenantIds =
        typeof req.query.tenant === 'string' && TENANT_MAP[req.query.tenant]
          ? [req.query.tenant]
          : getConfiguredTenantIds();
      const refreshed = [];

      for (const tenantId of tenantIds) {
        const targetTenant = getTenantConfig(tenantId);
        if (!targetTenant) continue;
        const entry = await getCatalogIndex(targetTenant, { forceRefresh: true });
        refreshed.push({
          tenantId,
          fetchedAt: new Date(entry.fetchedAt).toISOString(),
          totalCatalogCount: entry.meta.totalCatalogCount,
          totalRawProductCount: entry.meta.totalRawProductCount,
        });
      }

      sendJson(res, 200, { ok: true, refreshed }, getCorsHeaders(req));
      return;
    }

    if (productId) {
      const product = await fetchProductDetail(tenant, productId);
      sendJson(res, 200, { data: product }, getCorsHeaders(req));
      return;
    }

    const catalogIndex = await getCatalogIndex(tenant);
    const page = buildCatalogPage(catalogIndex, query);
    sendJson(res, 200, { data: page.products, meta: page.meta }, getCorsHeaders(req));
  } catch (err: unknown) {
    console.error('[catalog] Internal error:', err);
    sendJson(
      res,
      500,
      { error: err instanceof Error ? err.message : 'Internal server error' },
      getCorsHeaders(req)
    );
  }
}
