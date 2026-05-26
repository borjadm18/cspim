import { useEffect, useState } from 'react';
import { loadOrganizationSettings, saveOrganizationSettings } from '../api/organizationSettings';
import { DEFAULT_CATALOG_THEME_ID } from '../../../shared/theme/catalogThemes';
import type { CatalogSettings } from '../model/catalogTypes';

export const DEFAULT_SETTINGS: CatalogSettings = {
  pageSize: 30,
  density: 'comfortable',
  logoUrl: undefined,
  paletteId: DEFAULT_CATALOG_THEME_ID,
};

const SETTINGS_BY_TENANT_KEY = 'content-store.settings-by-tenant.v1';

const loadSettingsByTenant = (): Record<string, CatalogSettings> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(SETTINGS_BY_TENANT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, CatalogSettings>;
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.fromEntries(
      Object.entries(parsed).map(([id, s]) => [id, { ...DEFAULT_SETTINGS, ...(s || {}) }])
    );
  } catch {
    return {};
  }
};

export function useCatalogSettings(selectedTenantId: string) {
  const [settingsByTenant, setSettingsByTenant] = useState<Record<string, CatalogSettings>>(
    () => loadSettingsByTenant()
  );
  const [hydratedTenantSettings, setHydratedTenantSettings] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SETTINGS_BY_TENANT_KEY, JSON.stringify(settingsByTenant));
  }, [settingsByTenant]);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      setHydratedTenantSettings(prev => ({ ...prev, [selectedTenantId]: false }));
      const remote = await loadOrganizationSettings(selectedTenantId);
      if (cancelled) return;

      if (remote) {
        setSettingsByTenant(prev => ({
          ...prev,
          [selectedTenantId]: {
            ...DEFAULT_SETTINGS,
            ...(prev[selectedTenantId] || DEFAULT_SETTINGS),
            ...remote,
          },
        }));
      }

      setHydratedTenantSettings(prev => ({ ...prev, [selectedTenantId]: true }));
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [selectedTenantId]);

  const settings = settingsByTenant[selectedTenantId] || DEFAULT_SETTINGS;

  useEffect(() => {
    if (!hydratedTenantSettings[selectedTenantId]) return;
    void saveOrganizationSettings({ tenantId: selectedTenantId, settings });
  }, [hydratedTenantSettings, selectedTenantId, settings]);

  const setSettingsForTenant = (
    tenantId: string,
    next: CatalogSettings | ((prev: CatalogSettings) => CatalogSettings)
  ) => {
    setSettingsByTenant(prev => {
      const current = prev[tenantId] || DEFAULT_SETTINGS;
      const resolved = typeof next === 'function' ? next(current) : next;
      return { ...prev, [tenantId]: { ...DEFAULT_SETTINGS, ...resolved } };
    });
  };

  const setSettings = (next: CatalogSettings | ((prev: CatalogSettings) => CatalogSettings)) =>
    setSettingsForTenant(selectedTenantId, next);

  const restoreDefaultSettings = () => setSettings(DEFAULT_SETTINGS);

  return { settings, setSettings, setSettingsForTenant, restoreDefaultSettings };
}
