import type { CatalogSettings } from '../model/catalogTypes';
import { supabase } from '../../../lib/supabase';

export type OrganizationSettingsPayload = {
  tenantId: string;
  settings: CatalogSettings;
};

export type OrganizationAssetKind = 'logo' | 'favicon' | 'login-hero';

const SETTINGS_ENDPOINT = '/api/organization-settings';
const ASSETS_ENDPOINT = '/api/organization-assets';
const settingsCache = new Map<string, CatalogSettings | null>();
const inFlightSettings = new Map<string, Promise<CatalogSettings | null>>();

const parseJsonSafe = async <T>(response: Response): Promise<T | null> => {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

export const loadOrganizationSettings = async (tenantId: string): Promise<CatalogSettings | null> => {
  const cached = settingsCache.get(tenantId);
  if (cached !== undefined) {
    return cached;
  }

  const pending = inFlightSettings.get(tenantId);
  if (pending) {
    return pending;
  }

  const request = (async () => {
    try {
      const response = await fetch(`${SETTINGS_ENDPOINT}?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'GET',
        headers: { accept: 'application/json' },
      });

      if (!response.ok) {
        settingsCache.set(tenantId, null);
        return null;
      }

      const payload = await parseJsonSafe<{ settings?: CatalogSettings }>(response);
      const settings = payload?.settings ?? null;
      settingsCache.set(tenantId, settings);
      return settings;
    } catch {
      settingsCache.set(tenantId, null);
      return null;
    } finally {
      inFlightSettings.delete(tenantId);
    }
  })();

  inFlightSettings.set(tenantId, request);

  return request;
};

export const saveOrganizationSettings = async (payload: OrganizationSettingsPayload): Promise<boolean> => {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const response = await fetch(SETTINGS_ENDPOINT, {
      method: 'PATCH',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      settingsCache.set(payload.tenantId, payload.settings);
    }

    return response.ok;
  } catch {
    return false;
  }
};

export const uploadOrganizationAsset = async (
  tenantId: string,
  kind: OrganizationAssetKind,
  file: File
): Promise<string> => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    throw new Error('No active session to upload organization assets');
  }

  const formData = new FormData();
  formData.append('tenantId', tenantId);
  formData.append('kind', kind);
  formData.append('file', file);

  const response = await fetch(ASSETS_ENDPOINT, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const payload = await parseJsonSafe<{ url?: string; error?: string }>(response);
  if (!response.ok || !payload?.url) {
    throw new Error(payload?.error || 'No se pudo subir el archivo');
  }

  return payload.url;
};
