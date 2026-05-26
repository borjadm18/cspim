/// <reference types="node" />
import { requireAuth } from './_lib/auth.js';
import { checkRateLimit, getClientIp } from './_lib/rateLimit.js';

type PublicOrganization = {
  id: string;
  label: string;
  description?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

const sendJson = (statusCode: number, body: unknown, headers: Record<string, string> = corsHeaders) =>
  new Response(JSON.stringify(body), {
    status: statusCode,
    headers: {
      ...headers,
      'Content-Type': 'application/json; charset=utf-8',
    },
  });

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

const canonicalLabels: Record<string, string> = {
  'tres-griferia': 'TRES Grifería',
  'tres-griferia-test': 'TRES Grifería TEST',
};

const normalizeOrganization = (id: string, label?: unknown, description?: unknown): PublicOrganization => ({
  id,
  label: canonicalLabels[id] || cleanText(label ?? id).trim() || id,
  description: typeof description === 'string' && description.trim() ? cleanText(description).trim() : undefined,
});

const parsePublicOrganizations = (): PublicOrganization[] => {
  const rawPublic = process.env.VITE_CATALOG_TENANTS_JSON;
  if (rawPublic) {
    try {
      const parsed = JSON.parse(rawPublic) as unknown;
      const entries = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object'
          ? Object.entries(parsed).map(([id, value]) => ({ id, ...(value as Record<string, unknown>) }))
          : [];

      return entries
        .map(item => {
          const id = typeof item.id === 'string' ? item.id.trim() : '';
          if (!id) return null;
          return normalizeOrganization(id, item.label, item.description);
        })
        .filter((item): item is PublicOrganization => Boolean(item?.id && item?.label));
    } catch {
      // fall back below
    }
  }

  const rawPrivate = process.env.BLUESTONE_TENANTS_JSON;
  if (!rawPrivate) {
    return [
      {
        id: 'default',
        label: 'Tenant por defecto',
        description: 'Configuración activa del backend',
      },
    ];
  }

  try {
    const parsed = JSON.parse(rawPrivate) as Record<string, unknown>;
    return Object.keys(parsed || {}).map(id =>
      normalizeOrganization(id, canonicalLabels[id] || id, 'Organización configurada en Bluestone')
    );
  } catch {
    return [
      {
        id: 'default',
        label: 'Tenant por defecto',
        description: 'Configuración activa del backend',
      },
    ];
  }
};

export async function GET(request: Request) {
  let authResponse: Response | null = null;
  const fakeRes = {
    status: (code: number) => ({
      json: (body: unknown) => {
        authResponse = new Response(JSON.stringify(body), {
          status: code,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
        return authResponse;
      },
    }),
  };

  const auth = await requireAuth(request, fakeRes);
  if (!auth) return authResponse ?? new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

  if (!checkRateLimit(`${getClientIp(request)}:organizations`, 30, 60_000)) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }

  return sendJson(200, {
    organizations: parsePublicOrganizations(),
  }, getCorsHeaders(request));
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 200, headers: getCorsHeaders(request) });
}

