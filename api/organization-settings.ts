import type { CatalogSettings } from '../src/features/catalog/model/catalogTypes.js';
import { DEFAULT_CATALOG_THEME_ID } from '../src/shared/theme/catalogThemes.js';

type StoredSettings = {
  tenantId: string;
  settings: CatalogSettings;
};

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const getCorsHeaders = (request: Request) => {
  const origin = request.headers.get('origin');
  if (!origin) return corsHeaders;

  const requestOrigin = new URL(request.url).origin;
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

const DEFAULT_SETTINGS: CatalogSettings = {
  pageSize: 30,
  density: 'comfortable',
  logoUrl: undefined,
  paletteId: DEFAULT_CATALOG_THEME_ID,
};

const settingsStore = new Map<string, CatalogSettings>();

const normalizeSettings = (value: unknown): CatalogSettings => {
  const candidate = value && typeof value === 'object' ? (value as Partial<CatalogSettings>) : {};
  return {
    pageSize: typeof candidate.pageSize === 'number' ? candidate.pageSize : DEFAULT_SETTINGS.pageSize,
    density: candidate.density === 'compact' ? 'compact' : 'comfortable',
    logoUrl: typeof candidate.logoUrl === 'string' && candidate.logoUrl.trim() ? candidate.logoUrl.trim() : undefined,
    paletteId: typeof candidate.paletteId === 'string' && candidate.paletteId.trim() ? candidate.paletteId.trim() : DEFAULT_SETTINGS.paletteId,
  };
};

const getStoredSettings = (tenantId: string): CatalogSettings => settingsStore.get(tenantId) || DEFAULT_SETTINGS;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get('tenant') || 'default';

  return new Response(
    JSON.stringify({
      tenantId,
      settings: getStoredSettings(tenantId),
    }),
    {
      status: 200,
      headers: {
        ...getCorsHeaders(request),
        'Content-Type': 'application/json; charset=utf-8',
      },
    }
  );
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as StoredSettings | Partial<StoredSettings>;
    const tenantId = typeof body.tenantId === 'string' && body.tenantId.trim() ? body.tenantId.trim() : 'default';
    const settings = normalizeSettings(body.settings);
    settingsStore.set(tenantId, settings);

    return new Response(
      JSON.stringify({
        tenantId,
        settings,
      }),
      {
        status: 200,
        headers: {
          ...getCorsHeaders(request),
          'Content-Type': 'application/json; charset=utf-8',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Failed to save organization settings',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          ...getCorsHeaders(request),
          'Content-Type': 'application/json; charset=utf-8',
        },
      }
    );
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 200, headers: getCorsHeaders(request) });
}


