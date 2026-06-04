export type CatalogTenantOption = {
  id: string;
  label: string;
  description?: string;
};

export type CatalogAccessMode = 'admin' | 'client';

const CANONICAL_LABELS: Record<string, string> = {
  'tres-griferia': 'TRES Grifería',
  'tres-griferia-test': 'TRES Grifería TEST',
};

const DEFAULT_PUBLIC_TENANTS: CatalogTenantOption[] = [
  {
    id: 'default',
    label: 'Tenant por defecto',
    description: 'Usa la configuración activa del backend',
  },
];

const cleanText = (value: unknown) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (!/[\u00C3\u00C2\uFFFD]/.test(text)) return text;

  try {
    const bytes = Uint8Array.from(text, char => char.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes) || text;
  } catch {
    return text;
  }
};

const normalizeTenantOption = (value: unknown): CatalogTenantOption | null => {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Partial<CatalogTenantOption> & Record<string, unknown>;
  const id = typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id.trim() : '';
  const fallbackLabel = CANONICAL_LABELS[id] || id;
  const label = cleanText(typeof candidate.label === 'string' && candidate.label.trim() ? candidate.label.trim() : fallbackLabel).trim();

  if (!id || !label) return null;

  return {
    id,
    label: CANONICAL_LABELS[id] || label,
    description: typeof candidate.description === 'string' && candidate.description.trim() ? cleanText(candidate.description).trim() : undefined,
  };
};

const parsePublicTenants = (): CatalogTenantOption[] => {
  const raw = import.meta.env.VITE_CATALOG_TENANTS_JSON;
  if (!raw) return DEFAULT_PUBLIC_TENANTS;

  try {
    const parsed = JSON.parse(raw) as unknown;
    const entries = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object'
        ? Object.entries(parsed).map(([id, value]) => ({ id, ...(value as Record<string, unknown>) }))
        : [];

    const next = entries.map(normalizeTenantOption).filter((item): item is CatalogTenantOption => Boolean(item));
    return next.length > 0 ? next : DEFAULT_PUBLIC_TENANTS;
  } catch {
    return DEFAULT_PUBLIC_TENANTS;
  }
};

export const CATALOG_TENANT_OPTIONS = parsePublicTenants();
export const CATALOG_DEFAULT_TENANT_ID = CATALOG_TENANT_OPTIONS[0]?.id || 'default';
export const CATALOG_SOURCE_MODE = import.meta.env.VITE_CATALOG_SOURCE_MODE || (import.meta.env.PROD ? 'remote' : 'local');
export const CATALOG_ACCESS_MODE =
  (import.meta.env.VITE_CATALOG_ACCESS_MODE as CatalogAccessMode | undefined) === 'client'
    ? 'client'
    : 'admin';
