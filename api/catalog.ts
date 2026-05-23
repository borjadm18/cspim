/// <reference types="node" />
import { createClient } from '@supabase/supabase-js';
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
  expires_in?: number;
  token_type?: string;
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

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const getCorsHeaders = (request: Request | { headers?: Record<string, string | string[] | undefined>; url?: string }) => {
  const headerSource =
    request && typeof request === 'object' && 'headers' in request ? (request as any).headers : undefined;
  const origin =
    typeof headerSource?.get === 'function'
      ? headerSource.get('origin')
      : Array.isArray(headerSource?.origin)
        ? headerSource.origin[0]
        : headerSource?.origin;
  if (!origin) return corsHeaders;

  const requestUrl =
    typeof (request as any)?.url === 'string'
      ? (request as any).url
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
const definitionCache = new Map<string, Promise<Map<string, DefinitionRecord>>>();
type CatalogCacheEntry = {
  data: any[];
  fetchedAt: number;
};
const catalogCache = new Map<string, CatalogCacheEntry>();
const fetchInFlight = new Map<string, Promise<any[]>>();
const CATALOG_CACHE_TTL_MS = 10 * 60 * 1000;
const SUPABASE_CACHE_TTL_MS = 30 * 60 * 1000;

let supabaseAdminClient: ReturnType<typeof createClient> | null | undefined = undefined;

const getSupabaseAdmin = () => {
  if (supabaseAdminClient !== undefined) return supabaseAdminClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { supabaseAdminClient = null; return null; }
  supabaseAdminClient = createClient(url, key, { auth: { persistSession: false } });
  return supabaseAdminClient;
};
const CATALOG_PREVIEW_ASSETS_PER_PRODUCT = 6;

const cleanText = (value: unknown) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (!/[ÃƒÆ’Ãƒâ€šÃ¯Â¿Â½]/.test(text)) return text;

  try {
    const bytes = Uint8Array.from(text, char => char.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes) || text;
  } catch {
    return text;
  }
};

const extractTextCandidates = (value: unknown, preferredLocales: string[] = ['es', 'en']): string => {
  if (value === null || value === undefined) return '';

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return cleanText(value);
  }

  if (Array.isArray(value)) {
    return value.map(item => extractTextCandidates(item, preferredLocales)).filter(Boolean).join(', ');
  }

  if (typeof value === 'object') {
    const record = value as Record<string, any>;
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

const extractLocalizedValue = (value: unknown, preferredLocales: string[] = ['es', 'en']): string =>
  extractTextCandidates(value, preferredLocales);

const formatAttributeValue = (value: unknown): string => {
  const resolved = extractTextCandidates(value);
  if (resolved) return resolved;
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'number') return String(value);
  return '';
};

const normalizeDefinition = (definition: any): DefinitionRecord | null => {
  if (!definition?.id) return null;

  return {
    id: String(definition.id),
    number: definition.number ? String(definition.number) : undefined,
    name: cleanText(definition.name || definition.label || definition.id),
    group: definition.group ? cleanText(definition.group) : null,
    dataType: definition.dataType ? cleanText(definition.dataType) : undefined,
  };
};

const TENANT_MAP: TenantConfigMap = (() => {
  const raw = process.env.BLUESTONE_TENANTS_JSON;
  if (!raw) {
    const clientId = process.env.BLUESTONE_CLIENT_ID;
    const clientSecret = process.env.BLUESTONE_CLIENT_SECRET;
    const orgId = process.env.BLUESTONE_ORG_ID;
    const env = (process.env.BLUESTONE_ENV || 'test') as TenantConfig['env'];

    if (!clientId || !clientSecret || !orgId) {
      return {};
    }

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

const getBaseUrl = (env: TenantConfig['env']) => (env === 'test' ? 'https://api.test.bluestonepim.com' : 'https://api.bluestonepim.com');
const getTokenUrl = (env: TenantConfig['env']) => (env === 'test' ? 'https://idp.test.bluestonepim.com/op/token' : 'https://idp.bluestonepim.com/op/token');

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const fetchWithRetry = async (input: RequestInfo | URL, init: RequestInit, attempts = 4, timeoutMs = 15000) => {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), timeoutMs);
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
    }
    finally {
      if (timeout) clearTimeout(timeout);
    }

    if (attempt < attempts) {
      await sleep(400 * attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Request failed after retries');
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

      const payload = await response.json();
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
    const errorText = await response.text();
    throw new Error(`Token request failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as BluestoneTokenResponse;
  if (!data.access_token) {
    throw new Error('Bluestone token response did not include an access token');
  }

  return data.access_token;
};

const normalizeProductBatch = (data: any) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.items)) return data.items;
  return [];
};

const chunk = <T,>(items: T[], size: number) => {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
};

const extractPreviewAssetIds = (product: any, maxAssets = CATALOG_PREVIEW_ASSETS_PER_PRODUCT) => {
  if (!Array.isArray(product?.assets)) return [];
  return product.assets
    .map((asset: unknown) => String(asset).trim())
    .filter(Boolean)
    .slice(0, maxAssets);
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

const isImageFileName = (fileName: string) => /\.(png|jpe?g|gif|webp|bmp|svg|avif|tiff?)$/i.test(fileName);

const scoreImageByFileName = (image: { alt?: string; url?: string; isPrimary?: boolean }) => {
  const descriptor = (image.alt || image.url || '').toLowerCase();
  let score = 0;
  const positive = ['foto', 'photo', 'principal', 'main', 'hero', 'producto', 'product', 'real', 'realista', 'lifestyle', 'render'];
  const negative = ['dibujo', 'drawing', 'sketch', 'esquema', 'diagram', 'diagrama', 'technical', 'tecnica', 'plano', 'blueprint', 'lineart', 'dwg', 'cad', 'section', 'vista', 'alzado', 'perfil', 'medida', 'medidas', 'dimension'];
  for (const kw of positive) if (descriptor.includes(kw)) score += 80;
  for (const kw of negative) if (descriptor.includes(kw)) score -= 260;
  return score;
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
      const errorText = await response.text();
      throw new Error(`Bluestone assets request failed (${response.status}): ${errorText}`);
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

const buildProductMedia = (assetIds: string[], assetMap: Map<string, { assetId: string; presignedUrl: string; fileName: string }>) => {
  const images: Array<{ id: string; url: string; downloadUrl: string; alt: string; isPrimary?: boolean }> = [];
  const attachments: Array<{ id: string; name: string; url: string; downloadUrl: string; type: string }> = [];

  for (const [index, assetId] of assetIds.entries()) {
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
      images.push({
        ...entry,
        alt: fileName,
        isPrimary: index === 0,
      });
      continue;
    }

    attachments.push({
      ...entry,
      name: fileName,
      type: lower.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
    });
  }

  images.sort((a, b) => scoreImageByFileName(b) - scoreImageByFileName(a));
  return { images, attachments };
};

const enrichAttributes = (attributes: any[], definitionMap: Map<string, DefinitionRecord>) =>
  attributes.map(attribute => {
    const definitionId = String(attribute?.definitionId || '');
    const definition = definitionMap.get(definitionId);
    const rawValue = attribute?.value ?? attribute?.values;
    const displayValue = formatAttributeValue(rawValue);

    return {
      definitionId,
      definitionName: cleanText(definition?.name || attribute?.definitionName || attribute?.name || attribute?.label || definitionId || 'Atributo'),
      name: cleanText(definition?.name || attribute?.definitionName || attribute?.name || attribute?.label || definitionId || 'Atributo'),
      group: cleanText(definition?.group || attribute?.groupName || attribute?.group || ''),
      dataType: cleanText(definition?.dataType || attribute?.dataType || ''),
      value: displayValue,
      displayValue,
      rawValue,
      readOnly: Boolean(attribute?.readOnly),
    };
  });

const buildAttributeSearchText = (attributes: any[]) =>
  attributes
    .map(attribute =>
      [
        attribute?.definitionName,
        attribute?.name,
        attribute?.group,
        attribute?.dataType,
        attribute?.displayValue,
        attribute?.value,
      ]
        .map(value => cleanText(value).trim())
        .filter(Boolean)
        .join(' ')
    )
    .filter(Boolean)
    .join(' ');

const normalizeCatalogProduct = (
  product: any,
  media: { images: Array<{ id: string; url: string; downloadUrl: string; alt: string; isPrimary?: boolean }>; attachments: Array<{ id: string; name: string; url: string; downloadUrl: string; type: string }> },
  attributes: any[],
  options?: { assetIds?: string[]; includeAttributes?: boolean; includeMediaUrls?: boolean }
) => {
  const metadata = product?.metadata || {};
  const metadataName = extractLocalizedValue(metadata?.name);
  const metadataDescription = extractLocalizedValue(metadata?.description);
  const metadataNumber = extractLocalizedValue(metadata?.number);
  const metadataType = extractLocalizedValue(metadata?.type);
  const metadataBrand = extractLocalizedValue(
    metadata?.brand || metadata?.manufacturer || metadata?.vendor || metadata?.publisher
  );
  const assetIds = options?.assetIds ?? extractPreviewAssetIds(product);
  const includeAttributes = options?.includeAttributes ?? true;
  const includeMediaUrls = options?.includeMediaUrls ?? true;
  const previewImage = media.images[0];
  const previewImageAssetId = previewImage?.id ?? options?.assetIds?.[0];

  return {
    id: String(product?.id || product?._id || metadata?.id || metadata?.number || ''),
    name: cleanText(metadataName || product?.name || product?.title || product?.description || 'Producto'),
    description: cleanText(metadataDescription || extractLocalizedValue(product?.description) || ''),
    sku: cleanText(metadataNumber || product?.number || product?.sku || ''),
    number: cleanText(metadataNumber || product?.number || ''),
    variantParentId: cleanText(metadata?.variantParentId || product?.variantParentId || ''),
    images: includeMediaUrls ? media.images : [],
    attachments: includeMediaUrls ? media.attachments : [],
    previewImageAssetId,
    previewImageAlt: previewImage?.alt,
    assets: assetIds,
    attributes: includeAttributes ? attributes : [],
    attributeText: buildAttributeSearchText(attributes),
    categories: Array.isArray(product?.categories)
      ? product.categories.map((category: unknown) => String(category)).filter(Boolean)
      : [],
    category: cleanText(metadataType || product?.type || 'Sin categoría'),
    brand: cleanText(metadataBrand || product?.brand || product?.manufacturer || product?.vendor || ''),
    stock: typeof product?.stock === 'number' ? product.stock : undefined,
    type: cleanText(metadataType || product?.type || ''),
    state: metadata?.state || product?.state,
    publicationState: metadata?.publicationState || product?.publicationState,
    lastUpdate: metadata?.lastUpdate || product?.lastUpdate,
    updatedAt: metadata?.updatedAt || product?.updatedAt,
    createDate: metadata?.createDate || product?.createDate,
    updatedBy: metadata?.updatedBy || product?.updatedBy,
    lastUpdatedBy: metadata?.lastUpdatedBy || product?.lastUpdatedBy,
    variants: Array.isArray(product?.variants) ? product.variants : [],
    relations: Array.isArray(product?.relations) ? product.relations : [],
  };
};

const fetchProducts = async (tenant: TenantConfig) => {
  const cacheKey = `${tenant.env}:${tenant.orgId}:${tenant.context || 'en'}`;

  // L1: in-memory cache (10 min — survives within a warm serverless instance)
  const cached = catalogCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CATALOG_CACHE_TTL_MS) {
    return cached.data;
  }

  // L2: Supabase persistent cache (30 min — survives cold starts)
  if (!fetchInFlight.has(cacheKey)) {
    try {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data: row } = await (supabase as any)
          .from('catalog_cache')
          .select('products, fetched_at')
          .eq('tenant_key', cacheKey)
          .single() as { data: { products: any[]; fetched_at: string } | null };
        if (row && Date.now() - new Date(row.fetched_at).getTime() < SUPABASE_CACHE_TTL_MS) {
          catalogCache.set(cacheKey, { data: row.products, fetchedAt: Date.now() });
          return row.products;
        }
      }
    } catch {
      // Supabase unavailable — fall through to Bluestone fetch
    }
  }

  const inFlight = fetchInFlight.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const fetchPromise = (async () => {
  try {
    const token = await getAccessToken(tenant);
    const baseUrl = getBaseUrl(tenant.env);
    const allProducts: any[] = [];
    let cursor: string | null = null;

  do {
    const body = cursor
      ? {
          cursor,
          count: 100,
          views: [{ type: 'METADATA' }, { type: 'ATTRIBUTES' }, { type: 'ASSETS' }, { type: 'CATEGORIES' }, { type: 'LABELS' }],
        }
      : {
          count: 100,
          views: [{ type: 'METADATA' }, { type: 'ATTRIBUTES' }, { type: 'ASSETS' }, { type: 'CATEGORIES' }, { type: 'LABELS' }],
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
      const errorText = await response.text();
      throw new Error(`Bluestone products request failed (${response.status}): ${errorText}`);
    }

    const payload = await response.json();
    const batch = normalizeProductBatch(payload);
    allProducts.push(...batch);
    cursor = payload?.nextCursor || payload?.cursor || null;
  } while (cursor);

  const normalizedProducts = allProducts.map(product => {
    const previewAssetIds = extractPreviewAssetIds(product);
    return normalizeCatalogProduct(product, { images: [], attachments: [] }, [], {
      assetIds: previewAssetIds,
      includeAttributes: false,
      includeMediaUrls: false,
    });
  });

    catalogCache.set(cacheKey, {
      data: normalizedProducts,
      fetchedAt: Date.now(),
    });

    // Write-back to Supabase L2 cache (fire-and-forget)
    const supabase = getSupabaseAdmin();
    if (supabase) {
      void (supabase as any)
        .from('catalog_cache')
        .upsert({ tenant_key: cacheKey, products: normalizedProducts, fetched_at: new Date().toISOString() })
        .then(() => {}, () => {});
    }

    return normalizedProducts;
  } catch (error) {
    if (cached) {
      return cached.data;
    }

    throw error;
  }
  })();

  fetchInFlight.set(cacheKey, fetchPromise);
  try {
    return await fetchPromise;
  } finally {
    fetchInFlight.delete(cacheKey);
  }
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
    const errorText = await response.text();
    throw new Error(`Bluestone product request failed (${response.status}): ${errorText}`);
  }

  const product = await response.json();
  const assetIds = Array.isArray(product?.assets)
    ? product.assets.map((asset: unknown) => String(asset).trim()).filter(Boolean)
    : [];
  const [definitionMap, assetMap] = await Promise.all([
    fetchDefinitions(tenant, token),
    fetchAssetDownloads(tenant, token, assetIds),
  ]);
  const media = buildProductMedia(assetIds, assetMap);
  const attributes = Array.isArray(product?.attributes) ? enrichAttributes(product.attributes, definitionMap) : [];

  return normalizeCatalogProduct(product, media, attributes, {
    assetIds,
    includeAttributes: true,
    includeMediaUrls: true,
  });
};

const sendJson = (res: any, statusCode: number, body: unknown, headers: Record<string, string> = corsHeaders) => {
  res.status(statusCode);
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(body));
};

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    Object.entries(getCorsHeaders(req)).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    res.status(200).end();
    return;
  }

  const auth = await requireAuth(req, res);
  if (!auth) return;

  if (!checkRateLimit(`${getClientIp(req)}:catalog`, 30, 60_000)) {
    sendJson(res, 429, { error: 'Too many requests' }, getCorsHeaders(req));
    return;
  }

  try {
    const tenantId = typeof req.query.tenant === 'string' ? req.query.tenant : DEFAULT_TENANT;
    const productId = typeof req.query.productId === 'string' ? req.query.productId.trim() : '';
    const tenant = getTenantConfig(tenantId);

    if (!tenant) {
      sendJson(res, 400, { error: 'Tenant not configured' }, getCorsHeaders(req));
      return;
    }

    if (productId) {
      const product = await fetchProductDetail(tenant, productId);
      sendJson(res, 200, { data: product }, getCorsHeaders(req));
      return;
    }

    const products = await fetchProducts(tenant);
    sendJson(res, 200, { data: products }, getCorsHeaders(req));
  } catch (err: unknown) {
    console.error('[catalog] Internal error:', err);
    sendJson(res, 500, { error: 'Internal server error' }, getCorsHeaders(req));
  }
}
