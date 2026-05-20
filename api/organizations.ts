type PublicOrganization = {
  id: string;
  label: string;
  description?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const sendJson = (statusCode: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status: statusCode,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
    },
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
          const label = typeof item.label === 'string' && item.label.trim() ? item.label.trim() : id;
          const description = typeof item.description === 'string' && item.description.trim() ? item.description.trim() : undefined;
          return { id, label, description };
        })
        .filter(item => Boolean(item.id && item.label));
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
    return Object.keys(parsed || {}).map(id => ({
      id,
      label: id,
        description: 'Organización configurada en Bluestone',
    }));
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

export async function GET() {
  return sendJson(200, {
    organizations: parsePublicOrganizations(),
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

