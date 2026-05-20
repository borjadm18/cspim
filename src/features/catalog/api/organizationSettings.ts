import type { CatalogSettings } from '../model/catalogTypes';

export type OrganizationSettingsPayload = {
  tenantId: string;
  settings: CatalogSettings;
};

const SETTINGS_ENDPOINT = '/api/organization-settings';

const parseJsonSafe = async <T>(response: Response): Promise<T | null> => {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

export const loadOrganizationSettings = async (tenantId: string): Promise<CatalogSettings | null> => {
  try {
    const response = await fetch(`${SETTINGS_ENDPOINT}?tenant=${encodeURIComponent(tenantId)}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });

    if (!response.ok) return null;

    const payload = await parseJsonSafe<{ settings?: CatalogSettings }>(response);
    return payload?.settings ?? null;
  } catch {
    return null;
  }
};

export const saveOrganizationSettings = async (payload: OrganizationSettingsPayload): Promise<boolean> => {
  try {
    const response = await fetch(SETTINGS_ENDPOINT, {
      method: 'PATCH',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return response.ok;
  } catch {
    return false;
  }
};
