import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import dotenv from 'dotenv';

const rootDir = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
dotenv.config({ path: path.join(rootDir, '.env.local') });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const DEFAULT_TENANT = 'default';
const definitionCache = new Map();
const catalogCache = new Map();
const CATALOG_CACHE_TTL_MS = 10 * 60 * 1000;
const organizationSettingsPath = path.join(rootDir, '.content-store-data', 'organization-settings.json');
const organizationSettingsCache = new Map();

const DEFAULT_SETTINGS = {
  pageSize: 30,
  density: 'comfortable',
  logoUrl: undefined,
  paletteId: 'navy',
};

const ensureStorageDir = async () => {
  await fs.mkdir(path.dirname(organizationSettingsPath), { recursive: true });
};

const normalizeSettings = settings => ({
  pageSize: typeof settings?.pageSize === 'number' ? settings.pageSize : DEFAULT_SETTINGS.pageSize,
  density: settings?.density === 'compact' ? 'compact' : 'comfortable',
  logoUrl: typeof settings?.logoUrl === 'string' && settings.logoUrl.trim() ? settings.logoUrl.trim() : undefined,
  paletteId: typeof settings?.paletteId === 'string' && settings.paletteId.trim() ? settings.paletteId.trim() : DEFAULT_SETTINGS.paletteId,
});

const loadOrganizationSettings = async () => {
  try {
    const raw = await fs.readFile(organizationSettingsPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    for (const [tenantId, settings] of Object.entries(parsed)) {
      organizationSettingsCache.set(tenantId, normalizeSettings(settings));
    }
  } catch {
    // ignore missing file
  }
};

const persistOrganizationSettings = async () => {
  await ensureStorageDir();
  const payload = Object.fromEntries(organizationSettingsCache.entries());
  await fs.writeFile(organizationSettingsPath, JSON.stringify(payload, null, 2), 'utf8');
};

void loadOrganizationSettings();

const parsePublicOrganizations = () => {
  const rawPublic = process.env.VITE_CATALOG_TENANTS_JSON;
  if (rawPublic) {
    try {
      const parsed = JSON.parse(rawPublic);
      const entries = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object'
          ? Object.entries(parsed).map(([id, value]) => ({ id, ...value }))
          : [];

      return entries
        .map(item => {
          const id = typeof item.id === 'string' ? item.id.trim() : '';
          const label = cleanText(typeof item.label === 'string' && item.label.trim() ? item.label.trim() : id).trim();
          return {
            id,
            label: id === 'tres-griferia'
              ? 'TRES Grifería'
              : id === 'tres-griferia-test'
                ? 'TRES Grifería TEST'
                : label,
            description: typeof item.description === 'string' && item.description.trim() ? cleanText(item.description).trim() : undefined,
          };
        })
        .filter(item => item.id && item.label);
    } catch {
      // fall back below
    }
  }

  const rawPrivate = process.env.BLUESTONE_TENANTS_JSON;
  if (!rawPrivate) {
    return [
      {
        id: DEFAULT_TENANT,
        label: 'Tenant por defecto',
        description: 'Configuración activa del backend',
      },
    ];
  }

  try {
    const parsed = JSON.parse(rawPrivate);
    return Object.keys(parsed || {}).map(id => ({
      id,
      label: id === 'tres-griferia'
        ? 'TRES Grifería'
        : id === 'tres-griferia-test'
          ? 'TRES Grifería TEST'
          : id,
      description: 'Organización configurada en Bluestone',
    }));
  } catch {
    return [
      {
        id: DEFAULT_TENANT,
        label: 'Tenant por defecto',
        description: 'Configuración activa del backend',
      },
    ];
  }
};

const cleanText = (value) => {
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

const extractTextCandidates = (value, preferredLocales = ['es', 'en']) => {
  if (value === null || value === undefined) return '';

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return cleanText(value);
  }

  if (Array.isArray(value)) {
    return value.map(item => extractTextCandidates(item, preferredLocales)).filter(Boolean).join(', ');
  }

  if (typeof value === 'object') {
    const record = value;
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

const extractLocalizedValue = (value, preferredLocales = ['es', 'en']) => extractTextCandidates(value, preferredLocales);

const formatAttributeValue = (value) => {
  const resolved = extractTextCandidates(value);
  if (resolved) return resolved;
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'number') return String(value);
  return '';
};

const normalizeDefinition = (definition) => {
  if (!definition?.id) return null;
  return {
    id: String(definition.id),
    number: definition.number ? String(definition.number) : undefined,
    name: cleanText(definition.name || definition.label || definition.id),
    group: definition.group ? cleanText(definition.group) : null,
    dataType: definition.dataType ? cleanText(definition.dataType) : undefined,
  };
};

const getBaseUrl = (env) => (env === 'test' ? 'https://api.test.bluestonepim.com' : 'https://api.bluestonepim.com');
const getTokenUrl = (env) => (env === 'test' ? 'https://idp.test.bluestonepim.com/op/token' : 'https://idp.bluestonepim.com/op/token');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const fetchWithRetry = async (input, init, attempts = 4) => {
  let lastError = null;

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

const parseTenantMap = () => {
  const raw = process.env.BLUESTONE_TENANTS_JSON;
  if (!raw) {
    const clientId = process.env.BLUESTONE_CLIENT_ID;
    const clientSecret = process.env.BLUESTONE_CLIENT_SECRET;
    const orgId = process.env.BLUESTONE_ORG_ID;
    const env = process.env.BLUESTONE_ENV || 'test';

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
    const parsed = JSON.parse(raw);
    return Object.fromEntries(
      Object.entries(parsed).filter(([, config]) => Boolean(config?.clientId && config?.clientSecret && config?.orgId && config?.env))
    );
  } catch {
    return {};
  }
};

const getTenantConfig = (tenantId) => {
  const tenants = parseTenantMap();
  return tenants[tenantId] || tenants[DEFAULT_TENANT] || null;
};

const normalizeProductBatch = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.items)) return data.items;
  return [];
};

const chunk = (items, size) => {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
};

const isImageFileName = (fileName) => /\.(png|jpe?g|gif|webp|bmp|svg|avif|tiff?)$/i.test(fileName);

const fetchDefinitions = async (tenant, token) => {
  const cacheKey = `${tenant.env}:${tenant.orgId}:${tenant.context || 'en'}`;
  const cached = definitionCache.get(cacheKey);
  if (cached) return cached;

  const promise = (async () => {
    const baseUrl = getBaseUrl(tenant.env);
    const definitions = new Map();
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

const getAccessToken = async (tenant) => {
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

  const data = await response.json();
  if (!data.access_token) {
    throw new Error('Bluestone token response did not include an access token');
  }

  return data.access_token;
};

const fetchProducts = async (tenant) => {
  const cacheKey = `${tenant.env}:${tenant.orgId}:${tenant.context || 'en'}`;
  const cached = catalogCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CATALOG_CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const token = await getAccessToken(tenant);
    const baseUrl = getBaseUrl(tenant.env);
    const allProducts = [];
    let cursor = null;

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
        throw new Error(`Bluestone products request failed (${response.status}): ${await response.text()}`);
      }

      const payload = await response.json();
      const batch = normalizeProductBatch(payload);
      allProducts.push(...batch);
      cursor = payload?.nextCursor || payload?.cursor || null;
    } while (cursor);

    const definitionMap = await fetchDefinitions(tenant, token);
    const assetIds = allProducts.flatMap(product => (Array.isArray(product?.assets) ? product.assets.map((asset) => String(asset)).filter(Boolean) : []));
    const uniqueAssetIds = [...new Set(assetIds)];
    const assetMap = new Map();

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
        throw new Error(`Bluestone assets request failed (${response.status}): ${await response.text()}`);
      }

      const payload = await response.json();
      for (const asset of payload.assets || []) {
        if (!asset?.assetId || !asset?.presignedUrl) continue;
        assetMap.set(asset.assetId, {
          assetId: asset.assetId,
          presignedUrl: asset.presignedUrl,
          fileName: asset.fileName || asset.assetId,
        });
      }
    }

    const normalizedProducts = allProducts.map(product => {
      const ids = Array.isArray(product?.assets) ? product.assets.map((asset) => String(asset)).filter(Boolean) : [];
      const images = [];
      const attachments = [];
      const attributes = Array.isArray(product?.attributes)
        ? product.attributes.map(attribute => {
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
          })
        : [];

      ids.forEach((assetId, index) => {
        const asset = assetMap.get(assetId);
        if (!asset) return;
        const fileName = asset.fileName || asset.assetId;
        const lower = fileName.toLowerCase();
        if (isImageFileName(fileName)) {
          images.push({
            id: asset.assetId,
            url: asset.presignedUrl,
            downloadUrl: asset.presignedUrl,
            alt: fileName,
            isPrimary: index === 0,
          });
          return;
        }
        attachments.push({
          id: asset.assetId,
          name: fileName,
          url: asset.presignedUrl,
          downloadUrl: asset.presignedUrl,
          type: lower.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
        });
      });

      return {
        ...product,
        attributes,
        images,
        attachments,
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

const sendJson = (res, statusCode, body) => {
  res.writeHead(statusCode, {
    ...corsHeaders,
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(body));
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1:3001'}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }

  if (url.pathname === '/api/organization-settings') {
    if (req.method === 'GET') {
      const tenantId = url.searchParams.get('tenant') || DEFAULT_TENANT;
      sendJson(res, 200, {
        tenantId,
        settings: organizationSettingsCache.get(tenantId) || DEFAULT_SETTINGS,
      });
      return;
    }

    if (req.method === 'PATCH' || req.method === 'POST') {
      try {
        const body = await new Promise((resolve, reject) => {
          let raw = '';
          req.on('data', chunk => {
            raw += chunk;
          });
          req.on('end', () => {
            try {
              resolve(raw ? JSON.parse(raw) : {});
            } catch (error) {
              reject(error);
            }
          });
          req.on('error', reject);
        });

        const tenantId = typeof body?.tenantId === 'string' && body.tenantId.trim() ? body.tenantId.trim() : DEFAULT_TENANT;
        const settings = normalizeSettings(body?.settings);
        organizationSettingsCache.set(tenantId, settings);
        await persistOrganizationSettings();

        sendJson(res, 200, { tenantId, settings });
      } catch (error) {
        sendJson(res, 500, {
          error: 'Failed to save organization settings',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
      return;
    }
  }

  if (url.pathname !== '/api/catalog') {
    if (url.pathname === '/api/organizations') {
      sendJson(res, 200, { organizations: parsePublicOrganizations() });
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  try {
    const tenantId = url.searchParams.get('tenant') || DEFAULT_TENANT;
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
});

const port = Number(process.env.PORT || 3001);
server.listen(port, '127.0.0.1', () => {
  console.log(`Bluestone proxy listening on http://127.0.0.1:${port}`);
});

