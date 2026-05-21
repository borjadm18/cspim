import { CATALOG_SOURCE_MODE } from '../../../shared/config/catalogTenant';

export interface ProductImage {
  id?: string;
  url: string;
  downloadUrl?: string;
  alt?: string;
  isPrimary?: boolean;
}

export interface ProductAttribute {
  name: string;
  value: any;
  label?: string;
  definitionId?: string;
  definitionName?: string;
  dataType?: string;
  group?: string;
  displayValue?: string;
  rawValue?: any;
}

export interface ProductAttachment {
  id?: string;
  name: string;
  url: string;
  downloadUrl?: string;
  type?: string;
  size?: number;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  variantParentId?: string;
  price?: number;
  currency?: string;
  images?: ProductImage[];
  attributes?: ProductAttribute[] | Record<string, any>;
  attachments?: ProductAttachment[];
  categories?: string[];
  category?: string;
  brand?: string;
  stock?: number;
  [key: string]: any;
}

const PRODUCT_CACHE = new Map<string, Product[]>();
const CATALOG_REQUEST_TIMEOUT_MS = 15000;
const CATALOG_REQUEST_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 2000;

export const getCachedProducts = (tenantId: string): Product[] | null => {
  const cached = PRODUCT_CACHE.get(tenantId);
  return cached ? [...cached] : null;
};

export const setCachedProducts = (tenantId: string, products: Product[]) => {
  PRODUCT_CACHE.set(tenantId, [...products]);
};

const cleanText = (value: unknown) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (!/[ÃƒÃ‚ï¿½]/.test(text)) return text;

  try {
    const bytes = Uint8Array.from(text, char => char.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes) || text;
  } catch {
    return text;
  }
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const fetchWithTimeout = async (input: RequestInfo | URL, init: RequestInit, timeoutMs = CATALOG_REQUEST_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};

const normalizeAttributeValue = (attribute: any): any => {
  const value = attribute?.value ?? attribute?.values;
  if (Array.isArray(value)) {
    return value.length === 1 ? normalizeAttributeValue({ value: value[0] }) : value.map(item => normalizeAttributeValue({ value: item }));
  }

  if (value && typeof value === 'object') {
    const nested = value as Record<string, any>;
    const localized =
      nested.value ??
      nested.values ??
      nested.label ??
      nested.name ??
      nested.text ??
      nested.displayValue ??
      nested.description;

    if (localized !== undefined) {
      return normalizeAttributeValue({ value: localized });
    }

    const localeCandidate = ['es', 'en', 'pt', 'fr', 'de', 'it']
      .map(locale => nested[locale])
      .find(candidate => candidate !== undefined && candidate !== null && String(candidate).trim());

    if (localeCandidate !== undefined) {
      return normalizeAttributeValue({ value: localeCandidate });
    }
  }

  return value;
};

const IMAGE_PRIORITY_KEYWORDS = {
  positive: ['foto', 'photo', 'principal', 'main', 'hero', 'producto', 'product', 'real', 'realista', 'lifestyle', 'render'],
  negative: ['dibujo', 'drawing', 'sketch', 'esquema', 'diagram', 'diagrama', 'technical', 'tecnica', 'técnica', 'plano', 'blueprint', 'lineart', 'dwg', 'cad', 'section', 'vista', 'alzado', 'perfil', 'medida', 'medidas', 'dimensión', 'dimension'],
};

const scoreImageForDisplay = (image: ProductImage) => {
  const descriptor = cleanText([image.alt, image.downloadUrl, image.url].filter(Boolean).join(' ')).toLowerCase();
  let score = 0;

  if (image.isPrimary) score += 1000;
  for (const keyword of IMAGE_PRIORITY_KEYWORDS.positive) {
    if (descriptor.includes(keyword)) score += 80;
  }
  for (const keyword of IMAGE_PRIORITY_KEYWORDS.negative) {
    if (descriptor.includes(keyword)) score -= 260;
  }
  if (/(\.jpe?g|\.png|\.webp)(\?|$)/i.test(descriptor)) score += 5;
  if (!image.alt || cleanText(image.alt).trim() === 'Imagen') score -= 10;

  return score;
};

const sortImagesByPriority = (items: ProductImage[]) =>
  [...items].sort((a, b) => scoreImageForDisplay(b) - scoreImageForDisplay(a));

const extractTextCandidates = (value: unknown, preferredLocales: string[] = ['en', 'es']): string => {
  if (value === null || value === undefined) return '';

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return cleanText(value);
  }

  if (Array.isArray(value)) {
    return value.map(item => extractTextCandidates(item, preferredLocales)).filter(Boolean).join(', ');
  }

  if (typeof value === 'object') {
    const record = value as Record<string, any>;
    const candidateKeys = ['displayValue', 'value', 'values', 'text', 'label', 'name', 'description'];

    for (const key of candidateKeys) {
      if (record[key] !== undefined && record[key] !== null) {
        const resolved = extractTextCandidates(record[key], preferredLocales);
        if (resolved) return resolved;
      }
    }

    for (const locale of preferredLocales) {
      if (record[locale] !== undefined && record[locale] !== null) {
        const resolved = extractTextCandidates(record[locale], preferredLocales);
        if (resolved) return resolved;
      }
    }

    const flattened = Object.values(record)
      .map(item => extractTextCandidates(item, preferredLocales))
      .filter(text => text && text !== '[object Object]');
    if (flattened.length) return flattened.join(', ');
  }

  return '';
};

const formatAttributeValue = (value: unknown): string => {
  const resolved = extractTextCandidates(value);
  if (resolved) return resolved;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  return '';
};

const extractLocalizedValue = (value: unknown, preferredLocales: string[] = ['en', 'es']): string => {
  const resolved = extractTextCandidates(value, preferredLocales);
  if (resolved) return resolved;
  return '';
};

const normalizeMediaItem = (media: any): ProductImage | ProductAttachment | null => {
  const type = String(media?.contentType || '').toLowerCase();
  const url = media?.previewUri || media?.downloadUri || media?.url;
  if (!url) return null;

  if (type.includes('image/')) {
    return {
      id: media?.id || media?.number,
      url: media?.previewUri || url,
      downloadUrl: media?.downloadUri || url,
      alt: cleanText(media?.fileName || media?.name || 'Imagen'),
      isPrimary: Boolean(media?.isPrimary),
    };
  }

  return {
    id: media?.id || media?.number,
    url: media?.downloadUri || url,
    downloadUrl: media?.downloadUri || url,
    name: cleanText(media?.fileName || media?.name || 'Documento'),
    type: type || media?.contentType || 'application/octet-stream',
    size: media?.size,
  };
};

const normalizeLegacyProduct = (raw: any): Product => {
  const metadata = raw?.metadata || {};
  const metadataName = extractLocalizedValue(metadata.name);
  const metadataDescription = extractLocalizedValue(metadata.description);
  const metadataNumber = extractLocalizedValue(metadata.number);
  const metadataType = extractLocalizedValue(metadata.type);
  const metadataBrand = extractLocalizedValue(metadata.brand || metadata.manufacturer || metadata.vendor || metadata.publisher);
  const images: ProductImage[] = [];
  const attachments: ProductAttachment[] = [];
  const assets = Array.isArray(raw.assets) ? raw.assets.map((asset: unknown) => String(asset)).filter(Boolean) : [];

  const normalizedImages = Array.isArray(raw.images) ? raw.images : [];
  const normalizedAttachments = Array.isArray(raw.attachments) ? raw.attachments : [];
  const media = Array.isArray(raw.media) ? raw.media : [];

  const pushImage = (item: any) => {
    const url = item?.downloadUrl || item?.url || item?.previewUri;
    if (!url) return;
    images.push({
      id: item?.id || item?.assetId || item?.number,
      url: item?.url || url,
      downloadUrl: item?.downloadUrl || url,
      alt: cleanText(item?.alt || item?.name || item?.fileName || metadataName || 'Imagen'),
      isPrimary: Boolean(item?.isPrimary),
    });
  };

  const pushAttachment = (item: any) => {
    const url = item?.downloadUrl || item?.url || item?.previewUri;
    if (!url) return;
    attachments.push({
      id: item?.id || item?.assetId || item?.number,
      url: item?.url || url,
      downloadUrl: item?.downloadUrl || url,
      name: cleanText(item?.name || item?.fileName || 'Documento'),
      type: cleanText(item?.type || item?.contentType || 'application/octet-stream'),
      size: item?.size,
    });
  };

  normalizedImages.forEach(pushImage);
  normalizedAttachments.forEach(pushAttachment);

  media.forEach((mediaItem: any) => {
    const normalized = normalizeMediaItem(mediaItem);
    if (!normalized) return;

    const contentType = String(mediaItem?.contentType || '').toLowerCase();
    if (contentType.includes('image/')) {
      images.push(normalized as ProductImage);
      return;
    }

    attachments.push(normalized as ProductAttachment);
  });

  const attributes = Array.isArray(raw.attributes)
    ? raw.attributes.map((attribute: any) => {
        const rawValue = normalizeAttributeValue(attribute);
        const displayValue = formatAttributeValue(rawValue);

        return {
          definitionId: cleanText(attribute.definitionId || ''),
          name: cleanText(attribute.definitionName || attribute.name || attribute.label || attribute.definitionId || 'Atributo'),
          label: cleanText(attribute.groupName || attribute.group || ''),
          group: cleanText(attribute.groupName || attribute.group || ''),
          dataType: cleanText(attribute.dataType || ''),
          value: displayValue,
          displayValue,
          rawValue,
        };
      })
    : Object.entries(raw.attributes || {}).map(([name, value]) => ({
        name: cleanText(name),
        value: formatAttributeValue(value),
        displayValue: formatAttributeValue(value),
        rawValue: value,
      }));

  const prioritizedImages = sortImagesByPriority(images);

  return {
    id: String(raw.id || raw._id || metadata.id || metadata.number || ''),
    name: cleanText(metadataName || raw.name || raw.title || raw.description || 'Producto'),
    description: cleanText(metadataDescription || extractLocalizedValue(raw.description) || ''),
    sku: cleanText(metadataNumber || raw.number || raw.sku || ''),
    variantParentId: cleanText(metadata.variantParentId || raw.variantParentId || ''),
    images: prioritizedImages,
    attachments,
    assets,
    attributes,
    categories: Array.isArray(raw.categories) ? raw.categories.map((category: unknown) => String(category)).filter(Boolean) : [],
    category: cleanText(metadataType || raw.type || 'Sin categoría'),
    brand: cleanText(metadataBrand || raw.brand || raw.manufacturer || raw.vendor || ''),
    stock: typeof raw.stock === 'number' ? raw.stock : undefined,
    type: cleanText(metadataType || raw.type || ''),
    number: cleanText(metadataNumber || raw.number || ''),
    state: metadata.state || raw.state,
    lastUpdate: metadata.lastUpdate || raw.lastUpdate,
    createDate: metadata.createDate || raw.createDate,
  };
};

const loadLocalFallbackProducts = async () => {
  const { loadLocalProducts } = await import('../../../dev/localProducts');
  return loadLocalProducts(normalizeLegacyProduct);
};

export const fetchProducts = async (tenantId: string): Promise<Product[]> => {
  const allowLocalSampleInDev = import.meta.env.DEV && CATALOG_SOURCE_MODE !== 'remote';
  const shouldUseRemoteCatalog = import.meta.env.PROD || CATALOG_SOURCE_MODE === 'remote';

  if (!shouldUseRemoteCatalog) {
    if (import.meta.env.PROD) {
      throw new Error('Production catalog must use remote Bluestone data');
    }
    return loadLocalFallbackProducts();
  }

  const apiUrl = `/api/catalog?tenant=${encodeURIComponent(tenantId)}`;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= CATALOG_REQUEST_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchWithTimeout(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const products = Array.isArray(data) ? data : data.products || data.data || data.items || data.results || [];

      if (!Array.isArray(products)) {
        return [];
      }

      return products.map(normalizeLegacyProduct).filter(product => Boolean(product.id && product.name));
    } catch (error) {
      lastError = error;
      if (attempt < CATALOG_REQUEST_ATTEMPTS) {
        await sleep(RETRY_BACKOFF_MS * attempt);
      }
    }
  }

  if (allowLocalSampleInDev) {
    return loadLocalFallbackProducts();
  }

  throw lastError instanceof Error ? lastError : new Error('Error desconocido al cargar productos');
};
