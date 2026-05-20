import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type TenantBranding = {
  logoUrl: string | null;
  primaryColor: string;
  primaryHover: string;
  primaryText: string;
};

const hexToRgb = (hex: string) => {
  const normalized = hex.replace('#', '').trim();
  if (![3, 6].includes(normalized.length)) return null;

  const expanded = normalized.length === 3
    ? normalized.split('').map(char => `${char}${char}`).join('')
    : normalized;

  const value = Number.parseInt(expanded, 16);
  if (Number.isNaN(value)) return null;

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
};

const hexToRgba = (hex: string, alpha: number) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};

export function useTenantBranding(tenantId: string | undefined) {
  const [branding, setBranding] = useState<TenantBranding | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!tenantId) {
      setBranding(null);
      return () => {
        isMounted = false;
      };
    }

    const loadBranding = async () => {
      const { data } = await supabase
        .from('tenants')
        .select('primary_color, primary_hover, primary_text, logo_url')
        .eq('id', tenantId)
        .single();

      if (!isMounted || !data) return;

      const nextBranding: TenantBranding = {
        logoUrl: data.logo_url ?? null,
        primaryColor: data.primary_color || '#1B3A5C',
        primaryHover: data.primary_hover || '#152E4A',
        primaryText: data.primary_text || '#ffffff',
      };

      const root = document.documentElement;
      root.style.setProperty('--cs-primary', nextBranding.primaryColor);
      root.style.setProperty('--cs-primary-hover', nextBranding.primaryHover);
      root.style.setProperty('--cs-primary-text', nextBranding.primaryText);
      root.style.setProperty('--catalog-accent', nextBranding.primaryColor);
      root.style.setProperty('--catalog-accent-strong', nextBranding.primaryHover);
      root.style.setProperty('--catalog-accent-soft', hexToRgba(nextBranding.primaryColor, 0.12));
      root.style.setProperty('--catalog-accent-ink', nextBranding.primaryText);

      setBranding(nextBranding);
    };

    void loadBranding();

    return () => {
      isMounted = false;
    };
  }, [tenantId]);

  return branding;
}
