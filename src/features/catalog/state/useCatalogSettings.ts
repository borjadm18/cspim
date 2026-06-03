import { useEffect, useState } from 'react';
import { loadOrganizationSettings, saveOrganizationSettings } from '../api/organizationSettings';
import { DEFAULT_CATALOG_THEME_ID } from '../../../shared/theme/catalogThemes';
import type { CatalogSettings } from '../model/catalogTypes';

export const DEFAULT_SETTINGS: CatalogSettings = {
  pageSize: 30,
  density: 'comfortable',
  logoUrl: undefined,
  faviconUrl: undefined,
  loginHeroImageUrl: undefined,
  loginEyebrow: undefined,
  loginHeading: undefined,
  loginBody: undefined,
  paletteId: DEFAULT_CATALOG_THEME_ID,
};

const SETTINGS_BY_TENANT_KEY = 'content-store.settings-by-tenant.v1';

const keepRemoteAssetUrl = (value: unknown) =>
  typeof value === 'string' && value.trim().startsWith('https://') ? value.trim() : undefined;

const normalizePersistedSettings = (settings: CatalogSettings | null | undefined): CatalogSettings => ({
  ...DEFAULT_SETTINGS,
  ...(settings || {}),
  logoUrl: keepRemoteAssetUrl(settings?.logoUrl),
  faviconUrl: keepRemoteAssetUrl(settings?.faviconUrl),
  loginHeroImageUrl: keepRemoteAssetUrl(settings?.loginHeroImageUrl),
});

const loadSettingsByTenant = (): Record<string, CatalogSettings> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(SETTINGS_BY_TENANT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, CatalogSettings>;
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.fromEntries(
      Object.entries(parsed).map(([id, s]) => [id, normalizePersistedSettings(s)])
    );
  } catch {
    return {};
  }
};

export function useCatalogSettings(selectedTenantId: string) {
  const [settingsByTenant, setSettingsByTenant] = useState<Record<string, CatalogSettings>>(
    () => loadSettingsByTenant()
  );
  const [saveStateByTenant, setSaveStateByTenant] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SETTINGS_BY_TENANT_KEY, JSON.stringify(settingsByTenant));
  }, [settingsByTenant]);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const remote = await loadOrganizationSettings(selectedTenantId);
      if (cancelled) return;

      if (remote) {
        setSettingsByTenant(prev => ({
          ...prev,
          [selectedTenantId]: normalizePersistedSettings({
            ...(prev[selectedTenantId] || DEFAULT_SETTINGS),
            ...remote,
          }),
        }));
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [selectedTenantId]);

  const settings = settingsByTenant[selectedTenantId] || DEFAULT_SETTINGS;

  const setSettingsForTenant = (
    tenantId: string,
    next: CatalogSettings | ((prev: CatalogSettings) => CatalogSettings)
  ) => {
    setSettingsByTenant(prev => {
      const current = prev[tenantId] || DEFAULT_SETTINGS;
      const resolved = typeof next === 'function' ? next(current) : next;
      return { ...prev, [tenantId]: normalizePersistedSettings(resolved) };
    });
  };

  const setSettings = (next: CatalogSettings | ((prev: CatalogSettings) => CatalogSettings)) =>
    setSettingsForTenant(selectedTenantId, next);

  const restoreDefaultSettings = () => setSettings(DEFAULT_SETTINGS);

  const saveSettingsForTenant = async (tenantId: string) => {
    const nextSettings = settingsByTenant[tenantId] || DEFAULT_SETTINGS;
    setSaveStateByTenant(prev => ({ ...prev, [tenantId]: 'saving' }));

    const ok = await saveOrganizationSettings({ tenantId, settings: nextSettings });
    setSaveStateByTenant(prev => ({ ...prev, [tenantId]: ok ? 'saved' : 'error' }));

    if (ok) {
      window.setTimeout(() => {
        setSaveStateByTenant(prev => ({
          ...prev,
          [tenantId]: prev[tenantId] === 'saved' ? 'idle' : prev[tenantId],
        }));
      }, 1800);
    }

    return ok;
  };

  const saveSettings = async () => saveSettingsForTenant(selectedTenantId);

  return {
    settings,
    setSettings,
    setSettingsForTenant,
    restoreDefaultSettings,
    saveSettings,
    saveSettingsForTenant,
    saveState: saveStateByTenant[selectedTenantId] || 'idle',
  };
}
