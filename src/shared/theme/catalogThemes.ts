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

export const resolveCatalogTheme = (themeId?: string): CatalogTheme =>
  CATALOG_THEMES.find(theme => theme.id === themeId) || CATALOG_THEMES[0];

