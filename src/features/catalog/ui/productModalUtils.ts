import type { LucideIcon } from 'lucide-react';
import { CheckCircle2, CircleDot, Clock3 } from 'lucide-react';
import type { Product } from '../api/productService';
import { cleanText } from '../selectors/catalogSelectors';

export type SheetTab = 'contenido' | 'variantes';
export type ProductStatus = 'draft' | 'pending' | 'published';
export type LocaleCode = 'ES' | 'EN' | 'FR' | 'DE' | 'CA';

export const DEFAULT_LOCALES: LocaleCode[] = ['ES', 'EN', 'FR', 'DE', 'CA'];

export const STATUS_META: Record<ProductStatus, { label: string; className: string; icon: LucideIcon }> = {
  draft: { label: 'Borrador', className: 'bg-amber-100 text-amber-800', icon: CircleDot },
  pending: { label: 'Por publicar', className: 'bg-blue-100 text-blue-800', icon: Clock3 },
  published: { label: 'Publicado', className: 'bg-green-100 text-green-800', icon: CheckCircle2 },
};

export const STATUS_ORDER: ProductStatus[] = ['draft', 'pending', 'published'];

export const TECHNICAL_IMAGE_KEYWORDS = [
  'plano', 'drawing', 'dibujo', 'esquema', 'technical', 'dimensiones', 'medidas', 'dwg', 'cad',
];

export const FILE_ATTRIBUTE_KEYWORDS = [
  'url', 'link', 'enlace', 'archivo', 'fichero', 'ficha tecnica', 'ficha técnica',
  'pdf', 'manual', 'download', 'descarga', '2d', '3d', 'dwg',
];

export const fallbackImage = (title: string) => {
  const safeTitle = title.slice(0, 28);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 720" fill="none">
      <rect width="960" height="720" rx="32" fill="#f8fafc"/>
      <rect x="160" y="120" width="640" height="420" rx="24" fill="#e2e8f0"/>
      <rect x="196" y="156" width="568" height="348" rx="18" fill="#ffffff"/>
      <path d="M286 362h388" stroke="#cbd5e1" stroke-width="14" stroke-linecap="round"/>
      <path d="M360 278h240" stroke="#cbd5e1" stroke-width="14" stroke-linecap="round"/>
      <text x="50%" y="632" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#64748b">${safeTitle}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

export const normalizeText = (value: unknown) => cleanText(value).trim();

export const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return cleanText(value);
  if (Array.isArray(value)) return value.map(item => formatValue(item)).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    const record = value as Record<string, any>;
    const candidateKeys = ['displayValue', 'value', 'values', 'text', 'label', 'name', 'description'];
    for (const key of candidateKeys) {
      if (record[key] !== undefined && record[key] !== null) {
        const text = formatValue(record[key]);
        if (text) return text;
      }
    }
    const localeCandidate = ['es', 'en', 'pt', 'fr', 'de', 'it']
      .map(locale => record[locale])
      .find(candidate => candidate !== undefined && candidate !== null && String(candidate).trim());
    if (localeCandidate !== undefined) return formatValue(localeCandidate);
    const primitiveValues = Object.values(record)
      .map(item => formatValue(item))
      .filter(item => item && item !== '[object Object]');
    if (primitiveValues.length) return primitiveValues.join(', ');
  }
  return '';
};

export const extractTextValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return formatValue(value);
  }
  if (Array.isArray(value)) {
    return value.map(item => extractTextValue(item)).filter(Boolean).join(', ');
  }
  if (typeof value === 'object') {
    const record = value as Record<string, any>;
    const candidateKeys = ['displayValue', 'value', 'values', 'text', 'label', 'name', 'description'];
    for (const key of candidateKeys) {
      if (record[key] !== undefined && record[key] !== null) {
        const text = extractTextValue(record[key]);
        if (text) return text;
      }
    }
    const localeCandidate = ['es', 'en', 'pt', 'fr', 'de', 'it']
      .map(locale => record[locale])
      .find(candidate => candidate !== undefined && candidate !== null && String(candidate).trim());
    if (localeCandidate !== undefined) return extractTextValue(localeCandidate);
    const primitiveValues = Object.values(record)
      .map(item => extractTextValue(item))
      .filter(Boolean);
    if (primitiveValues.length) return primitiveValues.join(', ');
  }
  return '';
};

export const formatDate = (value?: unknown) => {
  if (!value) return '';
  const date = new Date(typeof value === 'number' ? value : String(value));
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
};

export const resolveFileName = (url: string, fallback: string) => {
  try {
    const parsed = new URL(url);
    const lastSegment = parsed.pathname.split('/').filter(Boolean).pop();
    if (!lastSegment) return fallback;
    return decodeURIComponent(lastSegment);
  } catch {
    return fallback;
  }
};

export const triggerDownload = async (url?: string, fileName?: string) => {
  if (!url) return;
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName || 'archivo';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
    return;
  } catch {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    if (fileName) anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }
};

export const normalizeKey = (value: string) => normalizeText(value).toLowerCase();

export const attributeKeys = (attr: any) =>
  [attr.key, attr.definitionName, attr.name, attr.label, attr.definitionId, attr.group, attr.groupName]
    .map(normalizeText)
    .filter(Boolean);

export const valueFromAttribute = (attr: any) => formatValue(attr?.displayValue ?? attr?.value ?? attr?.values);

export const isRenderableValue = (value: unknown) => {
  if (value === null || value === undefined) return false;
  const text = formatValue(value).trim();
  if (!text) return false;
  const lower = text.toLowerCase();
  return lower !== 'null' && lower !== 'undefined' && lower !== 'n/a';
};

export const getProductStatus = (product: Product): ProductStatus => {
  const raw = normalizeKey(product.status || (product as any).state || (product as any).publicationState || '');
  if (raw.includes('publish')) return 'published';
  if (raw.includes('draft')) return 'draft';
  if (raw.includes('pending') || raw.includes('ready')) return 'pending';
  return 'pending';
};

export const parseBooleanValue = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return undefined;
    if (['true', '1', 'yes', 'si', 'sí', 'visible', 'activo'].includes(normalized)) return true;
    if (['false', '0', 'no', 'oculto', 'inactivo'].includes(normalized)) return false;
  }
  return undefined;
};

export const buildAttributeLookup = (attributes: any[]) => {
  const lookup = new Map<string, any>();
  for (const attr of attributes) {
    for (const key of attributeKeys(attr)) {
      lookup.set(key, attr);
    }
  }
  return lookup;
};

export const readTopLevelValue = (product: Product, keys: string[]) => {
  for (const key of keys) {
    const direct = (product as any)[key];
    if (isRenderableValue(direct)) return direct;
    const lowerKey = key.toLowerCase();
    const directMatch = Object.entries(product as Record<string, any>).find(
      ([candidate]) => candidate.toLowerCase() === lowerKey
    );
    if (directMatch && isRenderableValue(directMatch[1])) return directMatch[1];
  }
  return undefined;
};

export const readAttributeValue = (lookup: Map<string, any>, keys: string[]) => {
  for (const key of keys) {
    const attr = lookup.get(normalizeKey(key));
    if (!attr) continue;
    const value = valueFromAttribute(attr);
    if (value) return { attr, value };
  }
  return null;
};

export const firstAvailableText = (
  product: Product,
  lookup: Map<string, any>,
  topLevelKeys: string[],
  attributeKeysList: string[]
) => {
  const top = readTopLevelValue(product, topLevelKeys);
  if (isRenderableValue(top)) return formatValue(top);
  const attr = readAttributeValue(lookup, attributeKeysList);
  return attr?.value || '';
};

export const firstAvailableNumber = (
  product: Product,
  lookup: Map<string, any>,
  topLevelKeys: string[],
  attributeKeysList: string[]
) => {
  const top = readTopLevelValue(product, topLevelKeys);
  if (top !== undefined && top !== null && String(top).trim()) {
    const parsed = typeof top === 'number' ? top : Number(String(top).replace(',', '.'));
    if (!Number.isNaN(parsed)) return parsed;
  }
  const attr = readAttributeValue(lookup, attributeKeysList);
  if (attr?.value) {
    const parsed = Number(String(attr.value).replace(',', '.'));
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
};

export const firstAvailableBoolean = (
  product: Product,
  lookup: Map<string, any>,
  topLevelKeys: string[],
  attributeKeysList: string[]
) => {
  const top = readTopLevelValue(product, topLevelKeys);
  const parsedTop = parseBooleanValue(top);
  if (parsedTop !== undefined) return parsedTop;
  const attr = readAttributeValue(lookup, attributeKeysList);
  return attr ? parseBooleanValue(attr.value) : undefined;
};

export const normalizeAttachmentName = (attachment: any) =>
  cleanText(attachment.name || attachment.fileName || 'Documento');

export const isUrlLikeString = (value: unknown) => {
  const text = formatValue(value).trim();
  return /^https?:\/\//i.test(text);
};

export const getFriendlyUrlLabel = (url: string) => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, '');
    const lastSegment = parsed.pathname.split('/').filter(Boolean).pop();
    if (!lastSegment) return host;
    const decoded = decodeURIComponent(lastSegment);
    return decoded.length > 42 ? `${host} · ${decoded.slice(0, 39)}…` : `${host} · ${decoded}`;
  } catch {
    return url;
  }
};

export const getAttributeLabel = (attr: any) =>
  cleanText(attr?.label || attr?.definitionName || attr?.name || attr?.definitionId || 'Atributo');

export const getAttributeHref = (attr: any) => {
  const candidates = [attr?.downloadUrl, attr?.url, attr?.fileUrl, attr?.href, attr?.displayValue, attr?.value, attr?.values];
  for (const candidate of candidates) {
    const text = extractTextValue(candidate).trim();
    if (/^https?:\/\//i.test(text)) return text;
  }
  return '';
};

export const isFileLikeAttribute = (attr: any) => {
  const label = normalizeKey(getAttributeLabel(attr));
  const href = getAttributeHref(attr);
  const valueText = normalizeKey(formatValue(attr?.displayValue ?? attr?.value ?? attr?.values));
  if (href || isUrlLikeString(attr?.displayValue ?? attr?.value ?? attr?.values)) return true;
  return FILE_ATTRIBUTE_KEYWORDS.some(keyword => label.includes(keyword) || valueText.includes(keyword));
};

export const getAttributeFileKind = (attr: any, href: string) => {
  const label = normalizeKey(getAttributeLabel(attr));
  const lowerHref = href.toLowerCase();
  if (label.includes('pdf') || lowerHref.endsWith('.pdf')) return 'PDF';
  if (label.includes('dwg') || lowerHref.endsWith('.dwg')) return 'DWG';
  if (label.includes('3d')) return '3D';
  if (label.includes('2d')) return '2D';
  if (label.includes('manual')) return 'Manual';
  if (label.includes('url') || label.includes('link') || label.includes('enlace')) return 'Enlace';
  return 'Archivo';
};

export const getAttributeFileName = (attr: any, href: string) => {
  const label = getAttributeLabel(attr);
  if (href) {
    const fileName = resolveFileName(href, label);
    if (fileName) return fileName;
  }
  const valueText = formatValue(attr?.displayValue ?? attr?.value ?? attr?.values).trim();
  if (valueText && !isUrlLikeString(valueText)) return valueText;
  if (isUrlLikeString(valueText)) return getFriendlyUrlLabel(valueText);
  return label;
};
