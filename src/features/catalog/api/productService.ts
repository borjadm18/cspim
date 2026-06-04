import { CATALOG_SOURCE_MODE } from '../../../shared/config/catalogTenant';
import { supabase } from '../../../lib/supabase';
import type { CatalogPageResponse, CatalogQueryParams, TextMatchOperator } from '../model/catalogTypes';

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
  definitionNumber?: string;
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
  number?: string;
  variantParentId?: string;
  baseReference?: string;
  attributeText?: string;
  previewImageAssetId?: string;
  previewImageAlt?: string;
  thumbnailUrl?: string;
  thumbnailDownloadUrl?: string;
  price?: number;
  weight?: number;
  flowRate?: string;
  ean?: string;
  finish?: string;
  collection?: string;
  range?: string;
  currency?: string;
  images?: ProductImage[];
  attributes?: ProductAttribute[] | Record<string, any>;
  attachments?: ProductAttachment[];
  categories?: string[];
  category?: string;
  brand?: string;
  stock?: number;
  hasImage?: boolean;
  hasDocument?: boolean;
  hasAsset?: boolean;
  variants?: Record<string, unknown>[];
  variantGroupId?: string;
  isVariantGroup?: boolean;
  [key: string]: any;
}

type CacheEntry = { data: CatalogPageResponse; ts: number };

const PRODUCT_CACHE = new Map<string, CacheEntry>();
const PRODUCT_CACHE_TTL_MS = 5 * 60 * 1000;
const CATALOG_REQUEST_TIMEOUT_MS = 25_000;
const CATALOG_REQUEST_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 1_500;

const buildCatalogQueryKey = (query: CatalogQueryParams) =>
  JSON.stringify({
    tenantId: query.tenantId,
    page: query.page,
    pageSize: query.pageSize,
    sortBy: query.sortBy,
    searchTerm: query.searchTerm,
    selectedName: query.selectedName,
      selectedNumber: query.selectedNumber,
      selectedNumberOperator: query.selectedNumberOperator,
      selectedCollection: query.selectedCollection,
      selectedRange: query.selectedRange,
      selectedVariantGroup: query.selectedVariantGroup,
    selectedPriceMin: query.selectedPriceMin,
    selectedPriceMax: query.selectedPriceMax,
    selectedEan: query.selectedEan,
    selectedFlow: query.selectedFlow,
    selectedFinish: query.selectedFinish,
    selectedAttributeQuery: query.selectedAttributeQuery,
    selectedBrand: query.selectedBrand,
    selectedCategory: query.selectedCategory,
    selectedType: query.selectedType,
    selectedStatus: query.selectedStatus,
    selectedMediaFilter: query.selectedMediaFilter,
    selectedQuickFilter: query.selectedQuickFilter,
  });

export const getCachedCatalogPage = (query: CatalogQueryParams): CatalogPageResponse | null => {
  const cacheKey = buildCatalogQueryKey(query);
  const entry = PRODUCT_CACHE.get(cacheKey);
  if (!entry) return null;
  if (Date.now() - entry.ts > PRODUCT_CACHE_TTL_MS) {
    PRODUCT_CACHE.delete(cacheKey);
    return null;
  }
  return entry.data;
};

export const setCachedCatalogPage = (query: CatalogQueryParams, response: CatalogPageResponse) => {
  PRODUCT_CACHE.set(buildCatalogQueryKey(query), { data: response, ts: Date.now() });
};

const cleanText = (value: unknown) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (!/[\u00C3\u00C2\uFFFD]/.test(text)) return text;

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
  const timeout = setTimeout(() => controller.abort(new Error(`Catalog request timeout after ${timeoutMs}ms`)), timeoutMs);

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
          definitionNumber: cleanText(attribute.definitionNumber || attribute.number || ''),
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
    baseReference: cleanText(raw.baseReference || ''),
    attributeText: cleanText(raw.attributeText || ''),
    previewImageAssetId: cleanText(raw.previewImageAssetId || ''),
    previewImageAlt: cleanText(raw.previewImageAlt || ''),
    thumbnailUrl: cleanText(raw.thumbnailUrl || prioritizedImages[0]?.url || ''),
    thumbnailDownloadUrl: cleanText(raw.thumbnailDownloadUrl || prioritizedImages[0]?.downloadUrl || ''),
    price: typeof raw.price === 'number' ? raw.price : undefined,
    weight: typeof raw.weight === 'number' ? raw.weight : undefined,
    flowRate: cleanText(raw.flowRate || ''),
    ean: cleanText(raw.ean || ''),
    finish: cleanText(raw.finish || raw.finishName || ''),
    collection: cleanText(raw.collection || ''),
    range: cleanText(raw.range || raw.gama || ''),
    images: prioritizedImages,
    attachments,
    assets,
    attributes,
    categories: Array.isArray(raw.categories) ? raw.categories.map((category: unknown) => String(category)).filter(Boolean) : [],
    category: cleanText(metadataType || raw.type || 'Sin categoría'),
    brand: cleanText(metadataBrand || raw.brand || raw.manufacturer || raw.vendor || ''),
    stock: typeof raw.stock === 'number' ? raw.stock : undefined,
    hasImage: typeof raw.hasImage === 'boolean' ? raw.hasImage : prioritizedImages.length > 0 || Boolean(raw.previewImageAssetId),
    hasDocument: typeof raw.hasDocument === 'boolean' ? raw.hasDocument : attachments.length > 0,
    hasAsset: typeof raw.hasAsset === 'boolean' ? raw.hasAsset : prioritizedImages.length > 0 || attachments.length > 0 || assets.length > 0,
    type: cleanText(metadataType || raw.type || ''),
    number: cleanText(metadataNumber || raw.number || ''),
    state: metadata.state || raw.state,
    lastUpdate: metadata.lastUpdate || raw.lastUpdate,
    createDate: metadata.createDate || raw.createDate,
    variants: Array.isArray(raw.variants) ? raw.variants : [],
    variantGroupId: cleanText(raw.variantGroupId || ''),
    isVariantGroup: Boolean(raw.isVariantGroup),
  };
};

const loadLocalFallbackProducts = async () => {
  const { loadLocalProducts } = await import('../../../dev/localProducts');
  return loadLocalProducts(normalizeLegacyProduct);
};

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
};

const buildLocalCatalogResponse = async (query: CatalogQueryParams): Promise<CatalogPageResponse> => {
  const products = await loadLocalFallbackProducts();
  return {
    products,
    meta: {
      currentPage: 1,
      pageSize: products.length || query.pageSize,
      totalPages: 1,
      totalCatalogCount: products.length,
      filteredGroupCount: products.length,
      totalRawProductCount: products.length,
      categoryLabelMap: {},
      brandOptions: [],
      rangeOptions: [],
      variantGroupOptions: [],
      flowOptions: [],
      finishOptions: [],
      priceRange: { min: 0, max: 0 },
      categoryTree: [],
      typeOptions: [],
      statusOptions: [],
      imageCount: products.reduce((sum, product) => sum + (product.images?.length || 0), 0),
      attachmentCount: products.reduce((sum, product) => sum + (product.attachments?.length || 0), 0),
      assetCount: products.filter(product => (product.images?.length || 0) + (product.attachments?.length || 0) > 0).length,
      withImagesCount: products.filter(product => (product.images?.length || 0) > 0).length,
      withDocumentsCount: products.filter(product => (product.attachments?.length || 0) > 0).length,
      mixedMediaCount: products.filter(product => (product.images?.length || 0) > 0 && (product.attachments?.length || 0) > 0).length,
    },
  };
};

export const fetchCatalogPage = async (query: CatalogQueryParams): Promise<CatalogPageResponse> => {
  const allowLocalSampleInDev = import.meta.env.DEV && CATALOG_SOURCE_MODE !== 'remote';
  const shouldUseRemoteCatalog = import.meta.env.PROD || CATALOG_SOURCE_MODE === 'remote';

  if (!shouldUseRemoteCatalog) {
    if (import.meta.env.PROD) {
      throw new Error('Production catalog must use remote Bluestone data');
    }
    return buildLocalCatalogResponse(query);
  }

  const apiUrl = `/api/catalog?${new URLSearchParams({
    tenant: query.tenantId,
    page: String(query.page),
    pageSize: String(query.pageSize),
    sortBy: query.sortBy,
    searchTerm: query.searchTerm,
    selectedName: query.selectedName,
    selectedNumber: query.selectedNumber,
    selectedNumberOperator: query.selectedNumberOperator,
    selectedCollection: query.selectedCollection,
    selectedRange: query.selectedRange,
    selectedVariantGroup: query.selectedVariantGroup,
    selectedPriceMin: query.selectedPriceMin,
    selectedPriceMax: query.selectedPriceMax,
    selectedEan: query.selectedEan,
    selectedFlow: query.selectedFlow,
    selectedFinish: query.selectedFinish,
    selectedAttributeQuery: query.selectedAttributeQuery,
    selectedBrand: query.selectedBrand,
    selectedCategory: query.selectedCategory,
    selectedType: query.selectedType,
    selectedStatus: query.selectedStatus,
    selectedMediaFilter: query.selectedMediaFilter,
    selectedQuickFilter: query.selectedQuickFilter,
  }).toString()}`;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= CATALOG_REQUEST_ATTEMPTS; attempt += 1) {
    try {
      const authHeaders = await getAuthHeaders();
      let response = await fetchWithTimeout(apiUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
      });

      if (response.status === 401) {
        await supabase.auth.refreshSession();
        const freshHeaders = await getAuthHeaders();
        response = await fetchWithTimeout(apiUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', ...freshHeaders },
        });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const rawProducts = Array.isArray(data) ? data : data.products || data.data || data.items || data.results || [];
      const meta = data?.meta;
      if (!Array.isArray(rawProducts) || !meta) {
        throw new Error('Catalog response is missing products or metadata');
      }

      return {
        products: rawProducts.map(normalizeLegacyProduct).filter(product => Boolean(product.id && product.name)),
        meta,
      };
    } catch (error) {
      lastError = error;
      if (attempt < CATALOG_REQUEST_ATTEMPTS) {
        await sleep(RETRY_BACKOFF_MS * attempt);
      }
    }
  }

  if (allowLocalSampleInDev) {
    return buildLocalCatalogResponse(query);
  }

  throw lastError instanceof Error ? lastError : new Error('Error desconocido al cargar el catálogo');
};

export const fetchProducts = async (tenantId: string): Promise<Product[]> => {
  const response = await fetchCatalogPage({
    tenantId,
    page: 1,
    pageSize: 30,
    sortBy: 'relevance',
    searchTerm: '',
    selectedName: '',
    selectedNumber: '',
    selectedNumberOperator: 'contains' satisfies TextMatchOperator,
    selectedCollection: '',
    selectedRange: '',
    selectedVariantGroup: '',
    selectedPriceMin: '',
    selectedPriceMax: '',
    selectedEan: '',
    selectedFlow: '',
    selectedFinish: '',
    selectedAttributeQuery: '',
    selectedBrand: 'all',
    selectedCategory: 'all',
    selectedType: 'all',
    selectedStatus: 'all',
    selectedMediaFilter: 'all',
    selectedQuickFilter: 'all',
  });
  return response.products;
};

export const fetchProductDetail = async (tenantId: string, productId: string): Promise<Product> => {
  const authHeaders = await getAuthHeaders();
  let response = await fetchWithTimeout(`/api/catalog?tenant=${encodeURIComponent(tenantId)}&productId=${encodeURIComponent(productId)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
  });

  if (response.status === 401) {
    await supabase.auth.refreshSession();
    const freshHeaders = await getAuthHeaders();
    response = await fetchWithTimeout(`/api/catalog?tenant=${encodeURIComponent(tenantId)}&productId=${encodeURIComponent(productId)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', ...freshHeaders },
    });
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  const raw = data?.data ?? data?.product ?? data;
  return normalizeLegacyProduct(raw);
};
