export type CatalogTheme = {
  id: string;
  name: string;
  accent: string;
  accentStrong: string;
  accentSoft: string;
  accentInk: string;
  pageStart: string;
  pageEnd: string;
};

export const CATALOG_THEMES: CatalogTheme[] = [
  {
    id: 'navy',
    name: 'Azul marino',
    accent: '#143d6b',
    accentStrong: '#0f3157',
    accentSoft: '#dfeaf6',
    accentInk: '#0f172a',
    pageStart: '#f7f9fd',
    pageEnd: '#edf2f8',
  },
  {
    id: 'teal',
    name: 'Verde petróleo',
    accent: '#175a58',
    accentStrong: '#0f4442',
    accentSoft: '#dff1ef',
    accentInk: '#0f172a',
    pageStart: '#f7faf9',
    pageEnd: '#edf6f4',
  },
  {
    id: 'slate',
    name: 'Pizarra',
    accent: '#334155',
    accentStrong: '#1f2937',
    accentSoft: '#e6ebf1',
    accentInk: '#0f172a',
    pageStart: '#f7f8fb',
    pageEnd: '#edf1f6',
  },
  {
    id: 'copper',
    name: 'Cobre',
    accent: '#8a5b34',
    accentStrong: '#6a4527',
    accentSoft: '#f3e6d8',
    accentInk: '#0f172a',
    pageStart: '#fcfaf7',
    pageEnd: '#f6efe8',
  },
];

export const DEFAULT_CATALOG_THEME_ID = 'navy';

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(n => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')).join('');
}

export function darkenHex(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

export function mixWithWhite(hex: string, whiteFraction: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * whiteFraction, g + (255 - g) * whiteFraction, b + (255 - b) * whiteFraction);
}

export function hexToTheme(hex: string): CatalogTheme {
  return {
    id: 'custom',
    name: 'Personalizado',
    accent: hex,
    accentStrong: darkenHex(hex, 0.2),
    accentSoft: mixWithWhite(hex, 0.88),
    accentInk: '#0f172a',
    pageStart: mixWithWhite(hex, 0.97),
    pageEnd: mixWithWhite(hex, 0.94),
  };
}

export const resolveCatalogTheme = (themeId?: string, customHex?: string): CatalogTheme => {
  if (customHex && /^#[0-9a-fA-F]{6}$/.test(customHex)) {
    return hexToTheme(customHex);
  }
  return CATALOG_THEMES.find(theme => theme.id === themeId) || CATALOG_THEMES[0];
};

