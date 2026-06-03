import { useEffect, useMemo, useState } from 'react';
import { loadOrganizationSettings } from '../features/catalog/api/organizationSettings';
import type { CatalogSettings } from '../features/catalog/model/catalogTypes';
import { resolveCatalogTheme } from '../shared/theme/catalogThemes';
import { useTenantBranding } from './useTenantBranding';

type LoginTenantBranding = {
  tenantName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  accentText: string;
  theme: ReturnType<typeof resolveCatalogTheme>;
  loginHeroImageUrl: string | null;
  loginEyebrow: string | null;
  loginHeading: string | null;
  loginBody: string | null;
};

const DEFAULT_SETTINGS: CatalogSettings = {
  pageSize: 30,
  density: 'comfortable',
  logoUrl: undefined,
  faviconUrl: undefined,
  paletteId: 'navy',
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function useLoginTenantBranding(
  tenantId: string | undefined,
  fallbackTenantName?: string
): LoginTenantBranding {
  const branding = useTenantBranding(tenantId && UUID_PATTERN.test(tenantId) ? tenantId : undefined);
  const [settings, setSettings] = useState<CatalogSettings | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!tenantId) {
      setSettings(null);
      return () => {
        cancelled = true;
      };
    }

    const loadSettings = async () => {
      const next = await loadOrganizationSettings(tenantId);
      if (cancelled) return;
      setSettings(next ? { ...DEFAULT_SETTINGS, ...next } : null);
    };

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const theme = useMemo(
    () => resolveCatalogTheme(settings?.paletteId, settings?.customAccentHex ?? branding?.primaryColor),
    [branding?.primaryColor, settings?.customAccentHex, settings?.paletteId]
  );

  return {
    tenantName: branding?.tenantName ?? fallbackTenantName ?? 'Content Store',
    logoUrl: settings?.logoUrl ?? branding?.logoUrl ?? null,
    faviconUrl: settings?.faviconUrl ?? settings?.logoUrl ?? branding?.logoUrl ?? null,
    accentText: branding?.primaryText ?? '#ffffff',
    theme,
    loginHeroImageUrl: settings?.loginHeroImageUrl ?? null,
    loginEyebrow: settings?.loginEyebrow ?? null,
    loginHeading: settings?.loginHeading ?? null,
    loginBody: settings?.loginBody ?? null,
  };
}
