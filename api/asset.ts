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

const DEFAULT_TENANT = 'default';

const TENANT_MAP: TenantConfigMap = (() => {
  const raw = process.env.BLUESTONE_TENANTS_JSON;
  if (!raw) return {};

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

const assetTokenCache = new Map<string, { token: string; expiresAt: number }>();
const assetUrlCache = new Map<string, { url: string; expiresAt: number }>();

const getBaseUrl = (env: TenantConfig['env']) => (env === 'test' ? 'https://api.test.bluestonepim.com' : 'https://api.bluestonepim.com');
const getTokenUrl = (env: TenantConfig['env']) => (env === 'test' ? 'https://idp.test.bluestonepim.com/op/token' : 'https://idp.bluestonepim.com/op/token');

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const fetchWithRetry = async (input: string | URL, init: RequestInit, attempts = 3, timeoutMs = 10000) => {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(new Error(`Asset request timeout after ${timeoutMs}ms`)), timeoutMs);
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
      await sleep(300 * attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Request failed after retries');
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
    throw new Error(`Token request failed (${response.status}): ${await response.text()}`);
  }

  const data = (await response.json()) as BluestoneTokenResponse;
  if (!data.access_token) {
    throw new Error('Bluestone token response did not include an access token');
  }

  return data.access_token;
};

const getCachedToken = async (tenant: TenantConfig): Promise<string> => {
  const key = `${tenant.env || 'default'}:${tenant.orgId}`;
  const cached = assetTokenCache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  const token = await getAccessToken(tenant);
  assetTokenCache.set(key, { token, expiresAt: Date.now() + 55 * 60 * 1000 });
  return token;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req: any, res: any) {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  if (!checkRateLimit(`${getClientIp(req)}:asset`, 120, 60_000)) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  try {
    const tenantId = typeof req.query.tenant === 'string' ? req.query.tenant : DEFAULT_TENANT;
    const assetId = typeof req.query.assetId === 'string' ? req.query.assetId.trim() : '';
    if (!assetId || !UUID_RE.test(assetId)) {
      res.status(400).json({ error: 'Invalid assetId' });
      return;
    }

    const tenant = getTenantConfig(tenantId);
    if (!tenant) {
      res.status(400).json({ error: 'Tenant not configured' });
      return;
    }

    const previewCacheKey = `${tenant.env}:${tenant.orgId}:${tenant.context || 'en'}:${assetId}`;
    const cachedUrl = assetUrlCache.get(previewCacheKey);
    if (cachedUrl && Date.now() < cachedUrl.expiresAt) {
      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
      res.writeHead(307, { Location: cachedUrl.url });
      res.end();
      return;
    }

    const token = await getCachedToken(tenant);
    const response = await fetchWithRetry(`${getBaseUrl(tenant.env)}/media-bank/assets/download`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        'x-organization-id': tenant.orgId,
        context: tenant.context || 'en',
        'context-fallback': 'true',
      },
      body: JSON.stringify({ assetIds: [assetId], expiresInMinutes: 60 }),
    });

    if (!response.ok) {
      console.error('[asset] Bluestone download error:', response.status, await response.text());
      res.status(response.status).json({ error: 'Failed to fetch asset' });
      return;
    }

    const payload = (await response.json()) as AssetDownloadResponse;
    const asset = payload.assets?.[0];
    if (!asset?.presignedUrl) {
      res.status(404).json({ error: 'Asset URL not found' });
      return;
    }

    assetUrlCache.set(previewCacheKey, {
      url: asset.presignedUrl,
      expiresAt: Date.now() + 45 * 60 * 1000,
    });

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.writeHead(307, { Location: asset.presignedUrl });
    res.end();
  } catch (err: unknown) {
    console.error('[asset] Internal error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
