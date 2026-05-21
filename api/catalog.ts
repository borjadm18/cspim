/// <reference types="node" />
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
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const DEFAULT_TENANT = 'default';
const definitionCache = new Map<string, Promise<Map<string, DefinitionRecord>>>();
type CatalogCacheEntry = {
  data: any[];
  fetchedAt: number;
};
const catalogCache = new Map<string, CatalogCacheEntry>();
const CATALOG_CACHE_TTL_MS = 10 * 60 * 1000;

const cleanText = (value: unknown) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (!/[ÃƒÃ‚ï¿½]/.test(text)) return text;

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
  if (typeof value === 'boolean') return value ? 'S�' : 'No';
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

const parseTenantMap = (): TenantConfigMap => {
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
};

const getTenantConfig = (tenantId: string): TenantConfig | null => {
  const tenants = parseTenantMap();
  return tenants[tenantId] || tenants[DEFAULT_TENANT] || null;
};

const getBaseUrl = (env: TenantConfig['env']) => (env === 'test' ? 'https://api.test.bluestonepim.com' : 'https://api.bluestonepim.com');
const getTokenUrl = (env: TenantConfig['env']) => (env === 'test' ? 'https://idp.test.bluestonepim.com/op/token' : 'https://idp.bluestonepim.com/op/token');

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const fetchWithRetry = async (input: RequestInfo | URL, init: RequestInit, attempts = 4) => {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(input, init);
      if (response.ok || (response.status !== 429 && response.status < 500)) {
        return response;
      }

      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
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

const isImageFileName = (fileName: string) => /\.(png|jpe?g|gif|webp|bmp|svg|avif|tiff?)$/i.test(fileName);

const fetchAssetDownloads = async (tenant: TenantConfig, assetIds: string[]) => {
  const uniqueAssetIds = [...new Set(assetIds.map(assetId => String(assetId).trim()).filter(Boolean))];
  const downloads = new Map<string, { assetId: string; presignedUrl: string; fileName: string }>();
  if (!uniqueAssetIds.length) return downloads;

  const token = await getAccessToken(tenant);
  const baseUrl = getBaseUrl(tenant.env);

  for (const batch of chunk(uniqueAssetIds, 100)) {
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
  }

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

const fetchProducts = async (tenant: TenantConfig) => {
  const cacheKey = `${tenant.env}:${tenant.orgId}:${tenant.context || 'en'}`;
  const cached = catalogCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CATALOG_CACHE_TTL_MS) {
    return cached.data;
  }

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

  const definitionMap = await fetchDefinitions(tenant, token);
  const assetIds = allProducts.flatMap(product => (Array.isArray(product?.assets) ? product.assets.map((asset: unknown) => String(asset)).filter(Boolean) : []));
  const assetMap = await fetchAssetDownloads(tenant, assetIds);

  const normalizedProducts = allProducts.map(product => {
    const media = buildProductMedia(
      Array.isArray(product?.assets) ? product.assets.map((asset: unknown) => String(asset)).filter(Boolean) : [],
      assetMap
    );
    const attributes = Array.isArray(product?.attributes) ? enrichAttributes(product.attributes, definitionMap) : [];

    return {
      ...product,
      attributes,
      ...media,
    };
  });

    catalogCache.set(cacheKey, {
      data: normalizedProducts,
      fetchedAt: Date.now(),
    });

    return normalizedProducts;
  } catch (error) {
    if (cached) {
      return cached.data;
    }

    throw error;
  }
};

const sendJson = (res: any, statusCode: number, body: unknown) => {
  res.status(statusCode);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(body));
};

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    res.status(200).end();
    return;
  }

  try {
    const tenantId = typeof req.query.tenant === 'string' ? req.query.tenant : DEFAULT_TENANT;
    const tenant = getTenantConfig(tenantId);

    if (!tenant) {
      sendJson(res, 400, { error: 'Tenant not configured' });
      return;
    }

    const products = await fetchProducts(tenant);
    sendJson(res, 200, { data: products });
  } catch (error) {
    sendJson(res, 500, {
      error: 'Failed to fetch catalog',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}


