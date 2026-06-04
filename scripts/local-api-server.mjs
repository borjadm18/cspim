import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import dotenv from 'dotenv';

const rootDir = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
dotenv.config({ path: path.join(rootDir, '.env.local') });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const DEFAULT_TENANT = 'default';
const definitionCache = new Map();
const catalogCache = new Map();
const CATALOG_CACHE_TTL_MS = 10 * 60 * 1000;
const CATALOG_DISK_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CATALOG_PREVIEW_ASSETS_PER_PRODUCT = 6;
const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 120;
const organizationSettingsPath = path.join(rootDir, '.content-store-data', 'organization-settings.json');
const brandingAssetsDir = path.join(rootDir, '.content-store-data', 'branding');
const catalogDiskCachePath = path.join(rootDir, '.content-store-data', 'catalog-cache.json');
const localProductsPath = path.join(rootDir, 'src', 'dev', 'all-products-cursor.json');
const organizationSettingsCache = new Map();
let localProductsCache = null;

const DEFAULT_SETTINGS = {
  pageSize: 30,
  density: 'comfortable',
  logoUrl: undefined,
  faviconUrl: undefined,
  loginHeroImageUrl: undefined,
  loginEyebrow: undefined,
  loginHeading: undefined,
  loginBody: undefined,
  paletteId: 'navy',
};

const ensureStorageDir = async () => {
  await fs.mkdir(path.dirname(organizationSettingsPath), { recursive: true });
  await fs.mkdir(brandingAssetsDir, { recursive: true });
};

const isAllowedAssetUrl = value => {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const parsed = new URL(value.trim());
    return (
      parsed.protocol === 'https:' ||
      (parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))
    );
  } catch {
    return false;
  }
};

const normalizeShortText = (value, maxLength) => {
  if (typeof value !== 'string') return undefined;
  const next = cleanText(value).trim();
  if (!next) return undefined;
  return next.slice(0, maxLength);
};

const normalizeSettings = settings => ({
  pageSize: typeof settings?.pageSize === 'number' ? settings.pageSize : DEFAULT_SETTINGS.pageSize,
  density: settings?.density === 'compact' ? 'compact' : 'comfortable',
  logoUrl: isAllowedAssetUrl(settings?.logoUrl) ? settings.logoUrl.trim() : undefined,
  faviconUrl: isAllowedAssetUrl(settings?.faviconUrl) ? settings.faviconUrl.trim() : undefined,
  loginHeroImageUrl: isAllowedAssetUrl(settings?.loginHeroImageUrl) ? settings.loginHeroImageUrl.trim() : undefined,
  loginEyebrow: normalizeShortText(settings?.loginEyebrow, 48),
  loginHeading: normalizeShortText(settings?.loginHeading, 140),
  loginBody: normalizeShortText(settings?.loginBody, 320),
  paletteId: typeof settings?.paletteId === 'string' && settings.paletteId.trim() ? settings.paletteId.trim() : DEFAULT_SETTINGS.paletteId,
  customAccentHex:
    typeof settings?.customAccentHex === 'string' && /^#[0-9a-fA-F]{6}$/.test(settings.customAccentHex.trim())
      ? settings.customAccentHex.trim()
      : undefined,
});

const loadOrganizationSettings = async () => {
  try {
    const raw = await fs.readFile(organizationSettingsPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    for (const [tenantId, settings] of Object.entries(parsed)) {
      organizationSettingsCache.set(tenantId, normalizeSettings(settings));
    }
  } catch {
    // ignore missing file
  }
};

const persistOrganizationSettings = async () => {
  await ensureStorageDir();
  const payload = Object.fromEntries(organizationSettingsCache.entries());
  await fs.writeFile(organizationSettingsPath, JSON.stringify(payload, null, 2), 'utf8');
};

const loadCatalogCacheFromDisk = async () => {
  try {
    const raw = await fs.readFile(catalogDiskCachePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    let loaded = 0;
    for (const [key, entry] of Object.entries(parsed)) {
      if (entry?.data && typeof entry.fetchedAt === 'number' && Date.now() - entry.fetchedAt < CATALOG_DISK_CACHE_TTL_MS) {
        catalogCache.set(key, {
          ...entry,
          meta: entry.meta && typeof entry.meta === 'object' ? entry.meta : buildCatalogBaseMeta(entry.data),
        });
        loaded += 1;
      }
    }
    if (loaded) console.log(`[catalog-cache] Cargado desde disco: ${loaded} tenant(s)`);
  } catch {
    // archivo inexistente o corrupto — se regenera en el primer request
  }
};

const persistCatalogCacheToDisk = async () => {
  try {
    await ensureStorageDir();
    const payload = Object.fromEntries(catalogCache.entries());
    await fs.writeFile(catalogDiskCachePath, JSON.stringify(payload), 'utf8');
  } catch (error) {
    console.warn('[catalog-cache] Error al persistir en disco:', error?.message);
  }
};

const loadLocalProducts = async () => {
  if (localProductsCache) return localProductsCache;

  const raw = await fs.readFile(localProductsPath, 'utf8');
  const parsed = JSON.parse(raw);
  localProductsCache = Array.isArray(parsed) ? parsed : [];
  return localProductsCache;
};

void loadOrganizationSettings();
void loadCatalogCacheFromDisk();

const parsePublicOrganizations = () => {
  const rawPublic = process.env.VITE_CATALOG_TENANTS_JSON;
  if (rawPublic) {
    try {
      const parsed = JSON.parse(rawPublic);
      const entries = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object'
          ? Object.entries(parsed).map(([id, value]) => ({ id, ...value }))
          : [];

      return entries
        .map(item => {
          const id = typeof item.id === 'string' ? item.id.trim() : '';
          const label = cleanText(typeof item.label === 'string' && item.label.trim() ? item.label.trim() : id).trim();
          return {
            id,
            label: id === 'tres-griferia'
              ? 'TRES Grifería'
              : id === 'tres-griferia-test'
                ? 'TRES Grifería TEST'
                : label,
            description: typeof item.description === 'string' && item.description.trim() ? cleanText(item.description).trim() : undefined,
          };
        })
        .filter(item => item.id && item.label);
    } catch {
      // fall back below
    }
  }

  const rawPrivate = process.env.BLUESTONE_TENANTS_JSON;
  if (!rawPrivate) {
    return [
      {
        id: DEFAULT_TENANT,
        label: 'Tenant por defecto',
        description: 'Configuración activa del backend',
      },
    ];
  }

  try {
    const parsed = JSON.parse(rawPrivate);
    return Object.keys(parsed || {}).map(id => ({
      id,
      label: id === 'tres-griferia'
        ? 'TRES Grifería'
        : id === 'tres-griferia-test'
          ? 'TRES Grifería TEST'
          : id,
      description: 'Organización configurada en Bluestone',
    }));
  } catch {
    return [
      {
        id: DEFAULT_TENANT,
        label: 'Tenant por defecto',
        description: 'Configuración activa del backend',
      },
    ];
  }
};

const cleanText = (value) => {
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

const normalizeKey = (value) => cleanText(value).trim().toLowerCase();
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const compareStrings = (a, b) =>
  String(a || '').localeCompare(String(b || ''), 'es', { sensitivity: 'base', numeric: true });

const extractTextCandidates = (value, preferredLocales = ['es', 'en']) => {
  if (value === null || value === undefined) return '';

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return cleanText(value);
  }

  if (Array.isArray(value)) {
    return value.map(item => extractTextCandidates(item, preferredLocales)).filter(Boolean).join(', ');
  }

  if (typeof value === 'object') {
    const record = value;
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

const extractLocalizedValue = (value, preferredLocales = ['es', 'en']) => extractTextCandidates(value, preferredLocales);

const formatAttributeValue = (value) => {
  const resolved = extractTextCandidates(value);
  if (resolved) return resolved;
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'number') return String(value);
  return '';
};

const normalizeDefinition = (definition) => {
  if (!definition?.id) return null;
  return {
    id: String(definition.id),
    number: definition.number ? String(definition.number) : undefined,
    name: cleanText(definition.name || definition.label || definition.id),
    group: definition.group ? cleanText(definition.group) : null,
    dataType: definition.dataType ? cleanText(definition.dataType) : undefined,
  };
};

const enrichAttributes = (attributes, definitionMap) =>
  (Array.isArray(attributes) ? attributes : []).map(attribute => {
    const source = typeof attribute === 'object' && attribute !== null ? attribute : {};
    const definitionId = String(source.definitionId || '');
    const definition = definitionMap.get(definitionId);
    const rawValue = source.value ?? source.values;
    const displayValue = formatAttributeValue(rawValue);

    return {
      definitionId,
      definitionNumber: cleanText(source.number || source.definitionNumber || definition?.number || ''),
      definitionName: cleanText(source.definitionName || source.name || source.label || definition?.name || definitionId || 'Atributo'),
      name: cleanText(source.definitionName || source.name || source.label || definition?.name || definitionId || 'Atributo'),
      group: cleanText(definition?.group || source.groupName || source.group || ''),
      dataType: cleanText(definition?.dataType || source.dataType || ''),
      value: displayValue,
      displayValue,
      rawValue,
      readOnly: Boolean(source.readOnly),
    };
  });

const extractPreviewAssetIds = (product, maxAssets = CATALOG_PREVIEW_ASSETS_PER_PRODUCT) => {
  if (!Array.isArray(product?.assets)) return [];
  return product.assets
    .map(asset => String(asset).trim())
    .filter(Boolean)
    .slice(0, maxAssets);
};

const buildAttributeSearchText = (attributes) =>
  attributes
    .map(attribute =>
      [
        attribute?.definitionName,
        attribute?.name,
        attribute?.group,
        attribute?.dataType,
        attribute?.displayValue,
        attribute?.value,
      ]
        .map(value => cleanText(value).trim())
        .filter(Boolean)
        .join(' ')
    )
    .filter(Boolean)
    .join(' ');

const ATTRIBUTE_KEYSETS = {
  collection: ['collection', 'coleccion', 'colección'],
  range: ['range', 'gama'],
  ean: ['ean', 'gtin', 'codigoean', 'códigoean', 'codigo ean', 'código ean'],
  flowRate: ['692d69b4f8de9bb8df7818d5', 'caudal', 'flow rate', 'flowrate', 'l/min', 'l min'],
  finish: ['692962777118d05218bb7788', 'finish', 'acabado', 'acabados tres', 'color'],
  price: ['price', 'precio', 'pvp'],
  weight: ['weight', 'peso'],
};

const matchesAttributeKey = (attribute, keys) => {
  const haystack = [
    attribute?.definitionName,
    attribute?.name,
    attribute?.label,
    attribute?.definitionId,
    attribute?.definitionNumber,
    attribute?.group,
  ]
    .map(value => normalizeKey(value))
    .filter(Boolean);

  return haystack.some(value =>
    keys.some(key => {
      const normalizedKey = normalizeKey(key);
      return value === normalizedKey || value.startsWith(normalizedKey);
    })
  );
};

const findAttributeRecord = (attributes, keys) => {
  if (!Array.isArray(attributes)) return null;
  return attributes.find(attribute => matchesAttributeKey(attribute, keys)) || null;
};

const parseNumberish = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const match = cleanText(value).replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
};

const getAttributeText = (attributes, keys) =>
  cleanText(
    findAttributeRecord(attributes, keys)?.displayValue ??
      findAttributeRecord(attributes, keys)?.value ??
      findAttributeRecord(attributes, keys)?.values ??
      ''
  ).trim() || null;

const getAttributeNumber = (attributes, keys) => parseNumberish(getAttributeText(attributes, keys));

const tokenizeSearch = (value) =>
  cleanText(value)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map(token => token.trim())
    .filter(token => token.length > 1);

const matchesStructuredQuery = (values, query) => {
  const queryTokens = tokenizeSearch(query);
  if (!queryTokens.length) return false;
  const haystackTokens = values.flatMap(value => tokenizeSearch(value));
  if (!haystackTokens.length) return false;
  return queryTokens.every(queryToken =>
    haystackTokens.some(token => token === queryToken || token.startsWith(queryToken))
  );
};

const normalizeCatalogProduct = (product, media, attributes) => {
  const metadata = product?.metadata || {};
  const metadataName = extractLocalizedValue(metadata?.name);
  const metadataDescription = extractLocalizedValue(metadata?.description);
  const metadataNumber = extractLocalizedValue(metadata?.number);
  const metadataType = extractLocalizedValue(metadata?.type);
  const metadataBrand = extractLocalizedValue(
    metadata?.brand || metadata?.manufacturer || metadata?.vendor || metadata?.publisher
  );

  const includeAttributes = product?.__includeAttributes !== false;
  const assetIds = Array.isArray(product?.__assetIds) ? product.__assetIds : extractPreviewAssetIds(product);
  const collection = getAttributeText(attributes, ['collection', 'coleccion', 'colección']);
  const range = getAttributeText(attributes, ['69f1c5af54e43fd1f8a009f1', 'range', 'gama']);
  const baseReference = getAttributeText(attributes, ['referencia base acabado', 'base ref', 'baseref']);
  const ean = getAttributeText(attributes, ['69f1c5af4f379fb27d452d06', 'ean', 'gtin', 'codigoean', 'códigoean', 'codigo ean', 'código ean']);
  const flowRate = getAttributeText(attributes, ['692d69b4f8de9bb8df7818d5', '6995d02329297e5aaf6e7796', 'caudal', 'flow rate', 'flowrate', 'l/min', 'l min']);
  const finish = getAttributeText(attributes, ['692962777118d05218bb7788', '6995d022fc7f3f7a6325fb21', 'acabado', 'acabados tres', 'acabados']);
  const price = getAttributeNumber(attributes, ['69297107f8de9bb8df77a29b', 'price', 'precio', 'pvp']);
  const weight = getAttributeNumber(attributes, ATTRIBUTE_KEYSETS.weight);
  return {
    id: String(product?.id || product?._id || metadata?.id || metadata?.number || ''),
    name: cleanText(metadataName || product?.name || product?.title || product?.description || 'Producto'),
    description: cleanText(metadataDescription || extractLocalizedValue(product?.description) || ''),
    sku: cleanText(metadataNumber || product?.number || product?.sku || ''),
    number: cleanText(metadataNumber || product?.number || ''),
    variantParentId: cleanText(metadata?.variantParentId || product?.variantParentId || ''),
    baseReference,
    images: media.images,
    attachments: media.attachments,
    previewImageAssetId: media.images[0]?.id ?? assetIds[0],
    assets: assetIds,
    collection,
    range,
    ean,
    flowRate,
    finish,
    price,
    weight,
    attributes: includeAttributes ? attributes : [],
    attributeText: buildAttributeSearchText(attributes),
    categories: Array.isArray(product?.categories) ? product.categories.map(category => String(category)).filter(Boolean) : [],
    category: cleanText(metadataType || product?.type || 'Sin categoría'),
    brand: cleanText(metadataBrand || product?.brand || product?.manufacturer || product?.vendor || ''),
    stock: typeof product?.stock === 'number' ? product.stock : undefined,
    type: cleanText(metadataType || product?.type || ''),
    state: normalizeStatusKey(metadata?.state || product?.state),
    publicationState: normalizeStatusKey(metadata?.publicationState || product?.publicationState),
    lastUpdate: metadata?.lastUpdate || product?.lastUpdate,
    updatedAt: metadata?.updatedAt || product?.updatedAt,
    createDate: metadata?.createDate || product?.createDate,
    updatedBy: metadata?.updatedBy || product?.updatedBy,
    lastUpdatedBy: metadata?.lastUpdatedBy || product?.lastUpdatedBy,
    authorEmail: metadata?.authorEmail || product?.authorEmail,
    variants: Array.isArray(product?.variants) ? product.variants : [],
    relations: Array.isArray(product?.relations) ? product.relations : [],
  };
};

const getProductBrand = (product) => {
  const candidates = [
    product?.brand,
    product?.manufacturer,
    product?.vendor,
    product?.publisher,
    product?.metadata?.brand,
  ];

  for (const candidate of candidates) {
    const text = cleanText(candidate).trim();
    if (text) return text;
  }

  const attributes = Array.isArray(product?.attributes)
    ? product.attributes
    : Object.entries(product?.attributes || {}).map(([name, value]) => ({ name, value }));

  const brandAttribute = attributes.find(attribute => {
    const name = normalizeKey(attribute?.name || attribute?.label || attribute?.definitionName || attribute?.definitionId || '');
    return name.includes('marca') || name.includes('brand') || name.includes('fabricante') || name.includes('vendor');
  });

  return cleanText(brandAttribute?.value ?? brandAttribute?.values ?? brandAttribute?.displayValue).trim();
};

const getProductTypeLabel = (type) => {
  const normalized = normalizeKey(type);
  if (normalized === 'group') return 'Grupo';
  if (normalized === 'single') return 'Simple';
  if (normalized === 'variant') return 'Con acabados';
  if (normalized === 'bundle') return 'Bundle';
  return cleanText(type).trim() || 'Sin tipo';
};

const normalizeStatusKey = (value) => {
  const normalized = normalizeKey(value);
  if (!normalized) return '';
  if (normalized.includes('playground') || normalized.includes('sandbox') || normalized.includes('test')) return 'draft';
  if (normalized.includes('draft') || normalized.includes('borrador')) return 'draft';
  if (normalized.includes('publish') || normalized.includes('published') || normalized.includes('public')) return 'published';
  if (normalized.includes('review') || normalized.includes('pending') || normalized.includes('to be published')) return 'to-be-published';
  if (normalized.includes('archive') || normalized.includes('archiv')) return 'archived';
  return normalized;
};

const getProductStatusLabel = (status) => {
  const normalized = normalizeStatusKey(status);
  if (normalized === 'draft') return 'Borrador';
  if (normalized === 'to-be-published') return 'Por publicar';
  if (normalized === 'published') return 'Publicado';
  if (normalized === 'archived') return 'Archivado';
  return cleanText(status).trim() || 'Sin estado';
};

const hasAssets = (product) => {
  const images = Array.isArray(product?.images) ? product.images.length : 0;
  const attachments = Array.isArray(product?.attachments) ? product.attachments.length : 0;
  const assets = Array.isArray(product?.assets) ? product.assets.length : 0;
  return images > 0 || attachments > 0 || assets > 0;
};

const hasImages = (product) =>
  (product?.images?.length || 0) > 0 || Boolean(product?.previewImageAssetId);

const hasDocuments = (product) => (Array.isArray(product?.attachments) ? product.attachments.length : 0) > 0;
const hasMixedMedia = (product) => hasImages(product) && hasDocuments(product);
const hasCategories = (product) =>
  Array.isArray(product?.categories) ? product.categories.length > 0 : Boolean(product?.category);

const getVariantParentId = (product) =>
  cleanText(product?.variantParentId || product?.metadata?.variantParentId || '').trim();

const getBaseReference = (product) => {
  const explicit = cleanText(product?.baseReference).trim();
  if (explicit) return explicit;

  const attributes = Array.isArray(product?.attributes)
    ? product.attributes
    : Object.entries(product?.attributes || {}).map(([name, value]) => ({ name, value }));

  const attributeMatch = attributes.find(attribute => {
    const key = normalizeKey(
      attribute?.definitionName || attribute?.name || attribute?.label || ''
    );
    return key.includes('referencia base acabado') || key === 'baseref' || key === 'base ref';
  });

  const attributeValue = cleanText(attributeMatch?.displayValue ?? attributeMatch?.value ?? '').trim();
  if (attributeValue) return attributeValue;

  const attributeText = cleanText(product?.attributeText);
  const match = attributeText.match(/Referencia base acabado(?:\s+Referencia base acabado)?\s+\w+\s+([A-Z0-9-]+)/i);
  return cleanText(match?.[1]).trim();
};

const matchesTextOperator = (values, query, operator) => {
  const normalizedQuery = normalizeKey(query);
  if (!normalizedQuery) return true;

  const haystackValues = values
    .map(value => cleanText(value).trim().toLowerCase())
    .filter(Boolean);

  if (!haystackValues.length) return operator === 'is_not';

  const matchesValue = (value) => {
    switch (operator) {
      case 'is':
        return value === normalizedQuery;
      case 'starts_with':
        return value.startsWith(normalizedQuery);
      case 'is_not':
        return value !== normalizedQuery;
      case 'contains':
      default:
        return value.includes(normalizedQuery);
    }
  };

  return operator === 'is_not'
    ? haystackValues.every(matchesValue)
    : haystackValues.some(matchesValue);
};

const getVariantGroupSelectionId = (product) => {
  const typeKey = normalizeKey(product?.type || product?.metadata?.type);
  const parentId = getVariantParentId(product);
  const baseReference = getBaseReference(product);

  if (typeKey === 'group') return `group:${product?.id}`;
  if (parentId) return `group:${parentId}`;
  if (baseReference) return `base:${baseReference}`;
  return '';
};

const isTestProduct = (product) => {
  const haystack = [
    product?.id,
    product?.name,
    product?.sku,
    product?.number,
    product?.metadata?.name,
    product?.metadata?.number,
  ]
    .map(value => normalizeKey(value).toUpperCase())
    .join(' ');

  return /\bTEST[_\s-]|DEBUG|PLAYGROUND\b/i.test(haystack) || /(^|[\s/_-])test($|[\s/_-])/i.test(haystack);
};

const scoreForRepresentative = (product) => {
  let value = 0;
  if (hasImages(product)) value += 200;
  if (hasDocuments(product)) value += 100;
  if (hasAssets(product)) value += 20;
  value += Math.min((product?.images?.length || 0) + (product?.attachments?.length || 0), 9);
  value += cleanText(product?.name).length ? 1 : 0;
  return value;
};

const scoreForMediaSource = (product) => {
  const images = Array.isArray(product?.images) ? product.images : [];
  const primaryImages = images.filter(image => Boolean(image?.isPrimary)).length;
  const bestImageScore = images.reduce((best, image) => Math.max(best, scoreImageByFileName(image)), Number.NEGATIVE_INFINITY);
  let value = Number.isFinite(bestImageScore) ? bestImageScore * 10 : 0;
  value += primaryImages * 120;
  value += images.length * 25;
  value += hasDocuments(product) ? 10 : 0;
  value += hasAssets(product) ? 5 : 0;
  value += normalizeKey(product?.type) === 'group' ? 20 : 0;
  return value;
};

const getProductUpdatedAt = (product) => {
  const raw = product?.updatedAt || product?.lastUpdate || product?.createDate || '';
  const time = Date.parse(String(raw));
  return Number.isNaN(time) ? 0 : time;
};

const getProductVariantCount = (product) =>
  Array.isArray(product?.variants) ? product.variants.length : 0;

const getRelevanceScore = (product) => {
  let score = 0;
  if ((product?.images?.length || 0) > 0 || product?.previewImageAssetId) score += 1000;
  if (hasDocuments(product)) score += 120;
  if (hasAssets(product)) score += 40;
  if (getProductVariantCount(product) > 0) score += 20;
  score += Math.min((product?.images?.length || 0) * 10, 90);
  score += getProductUpdatedAt(product) > 0 ? 5 : 0;
  return score;
};

const sortCatalogProducts = (products, sortBy) => {
  const next = [...products];
  switch (sortBy) {
    case 'name_asc':
      return next.sort((a, b) => compareStrings(a?.name, b?.name));
    case 'name_desc':
      return next.sort((a, b) => compareStrings(b?.name, a?.name));
    case 'sku_asc':
      return next.sort((a, b) => compareStrings(a?.sku || a?.number, b?.sku || b?.number));
    case 'updated_desc':
      return next.sort((a, b) => getProductUpdatedAt(b) - getProductUpdatedAt(a) || compareStrings(a?.name, b?.name));
    case 'variants_desc':
      return next.sort((a, b) => getProductVariantCount(b) - getProductVariantCount(a) || compareStrings(a?.name, b?.name));
    case 'relevance':
    default:
      return next.sort((a, b) => getRelevanceScore(b) - getRelevanceScore(a) || compareStrings(a?.name, b?.name));
  }
};

const groupProductsForDisplay = (products) => {
  const buckets = new Map();
  const groupRootsById = new Map();
  const groupRootsByPrefix = new Map();
  const groupRootsByBaseReference = new Map();

  const getNumberValue = product => cleanText(product?.number || product?.sku || product?.id).trim();
  const getDisplayName = product => cleanText(product?.name).trim().toLowerCase();
  const extractVariantPrefix = (value) => {
    const normalized = cleanText(value).trim();
    if (!normalized) return '';

    const numericPrefixMatch = normalized.match(/^(\d{4,})/);
    if (numericPrefixMatch) return numericPrefixMatch[1];

    const alphanumericPrefixMatch = normalized.match(/^([A-Za-z0-9]{4,}?)(?:[-_ ]?[A-Za-z]+|\s+[A-Za-z]+)?$/);
    return alphanumericPrefixMatch?.[1] || '';
  };

  for (const product of products) {
    if (normalizeKey(product?.type) !== 'group') continue;
    const numberValue = getNumberValue(product);
    const prefix = extractVariantPrefix(numberValue);
    const baseReference = getBaseReference(product);
    if (!groupRootsById.has(product.id)) groupRootsById.set(product.id, product);
    if (prefix && !groupRootsByPrefix.has(prefix)) groupRootsByPrefix.set(prefix, product);
    if (numberValue && !groupRootsByPrefix.has(numberValue)) groupRootsByPrefix.set(numberValue, product);
    if (baseReference && !groupRootsByBaseReference.has(baseReference)) {
      groupRootsByBaseReference.set(baseReference, product);
    }
  }

  for (const product of products) {
    const typeKey = normalizeKey(product?.type);
    const parentId = getVariantParentId(product);
    const numberValue = getNumberValue(product);
    const prefix = extractVariantPrefix(numberValue);
    const baseReference = getBaseReference(product);
    const matchedRoot =
      (parentId && groupRootsById.get(parentId)) ||
      (baseReference && groupRootsByBaseReference.get(baseReference)) ||
      (prefix && groupRootsByPrefix.get(prefix)) ||
      (numberValue && groupRootsByPrefix.get(numberValue)) ||
      null;
    const bucketId =
      typeKey === 'group'
        ? `group:${product.id}`
        : typeKey === 'variant' && parentId
          ? `group:${parentId}`
          : matchedRoot
            ? `group:${matchedRoot.id}`
            : baseReference
              ? `base:${baseReference}`
              : `single:${product.id}`;

    if (!buckets.has(bucketId)) {
      buckets.set(bucketId, { id: bucketId, representative: null, members: [], syntheticKey: null });
    }

    const bucket = buckets.get(bucketId);
    bucket.members.push(product);
    if (typeKey === 'group') bucket.representative = product;
  }

  const orphanSinglesBySignature = new Map();
  for (const bucket of buckets.values()) {
    if (bucket.id.startsWith('group:') || bucket.members.length !== 1) continue;
    const [single] = bucket.members;
    const numberValue = getNumberValue(single);
    const prefix = extractVariantPrefix(numberValue);
    if (!prefix) continue;
    const signature = `${prefix}:${getDisplayName(single)}`;
    if (!orphanSinglesBySignature.has(signature)) orphanSinglesBySignature.set(signature, []);
    orphanSinglesBySignature.get(signature).push(single);
  }

  for (const [signature, members] of orphanSinglesBySignature.entries()) {
    if (members.length < 2) continue;
    const bucketId = `synthetic:${signature}`;
    buckets.set(bucketId, { id: bucketId, representative: null, members, syntheticKey: signature });
    for (const member of members) {
      buckets.delete(`single:${member.id}`);
    }
  }

  return [...buckets.values()]
    .map(bucket => {
      const sortedMembers = [...bucket.members].sort(
        (a, b) => scoreForRepresentative(b) - scoreForRepresentative(a) || compareStrings(a?.name, b?.name)
      );
      const bucketBaseReference = bucket.id.startsWith('base:') ? bucket.id.slice(5) : '';
      const representative =
        bucket.representative ||
        (bucketBaseReference
          ? sortedMembers.find(product => {
              const normalizedBucketBaseReference = normalizeKey(bucketBaseReference);
              const productNumber = normalizeKey(product?.number || product?.sku || '');
              const productBaseReference = normalizeKey(getBaseReference(product));
              return (
                productNumber === normalizedBucketBaseReference ||
                productBaseReference === normalizedBucketBaseReference
              );
            }) || null
          : null) ||
        sortedMembers[0] ||
        null;
      if (!representative) return null;

      const variants = bucket.members
        .filter(product => product.id !== representative.id)
        .sort((a, b) => scoreForRepresentative(b) - scoreForRepresentative(a) || compareStrings(a?.name, b?.name));
      const mediaSource =
        [...bucket.members].sort(
          (a, b) => scoreForMediaSource(b) - scoreForMediaSource(a) || scoreForRepresentative(b) - scoreForRepresentative(a)
        )[0] || representative;
      const resolvedBaseReference =
        getBaseReference(representative) ||
        bucketBaseReference ||
        getBaseReference(sortedMembers[0]) ||
        '';

      return {
        ...representative,
        name: cleanText(representative.name || bucket.members[0]?.name || 'Producto'),
        images: mediaSource?.images || representative.images,
        attachments: mediaSource?.attachments || representative.attachments,
        assets: mediaSource?.assets || representative.assets,
        baseReference: resolvedBaseReference,
        variants,
        variantCount: variants.length,
        variantGroupId: bucket.id,
        isVariantGroup: variants.length > 0,
      };
    })
    .filter(Boolean);
};

const CATEGORY_STOP_WORDS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'y', 'o', 'a', 'en', 'para', 'con', 'sin',
  'kit', 'kits', 'compo', 'mndo', 'mundo', 'mn', 'emp', 'empotrado', 'empotrada',
  'empotrados', 'empotradas', 'sal', 'recto', 'caño', 'cano', 'caña', 'cana', 'repisa',
  'completo', 'completa', 'comple', 'grupo', 'single', 'variant', 'variante', 'dcha',
  'izq', 'izquierda', 'derecha', 'solo', 'home', 'standard', 'playground_only', 'playground',
]);

const titleCase = (value) =>
  value
    .toLowerCase()
    .replace(/(^|\s|[-_/])\p{L}/gu, letter => letter.toUpperCase());

const slugify = (value) =>
  cleanText(value)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

const normalizeCategoryToken = (value) =>
  cleanText(value)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();

const getMeaningfulTokens = (value) =>
  normalizeCategoryToken(value)
    .split(/\s+/)
    .filter(token => token.length > 2 && !CATEGORY_STOP_WORDS.has(token));

const buildCategoryPhrase = (productNames) => {
  const phraseCount = new Map();
  const tokenCount = new Map();

  for (const name of productNames) {
    const tokens = getMeaningfulTokens(name);
    if (!tokens.length) continue;
    const candidate = tokens.slice(0, 2).join(' ');
    if (candidate) phraseCount.set(candidate, (phraseCount.get(candidate) || 0) + 1);
    for (const token of tokens) tokenCount.set(token, (tokenCount.get(token) || 0) + 1);
  }

  const bestPhrase = [...phraseCount.entries()].sort((a, b) => b[1] - a[1])[0];
  if (bestPhrase && bestPhrase[1] > 1) return titleCase(bestPhrase[0]);

  const bestTokens = [...tokenCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([token]) => token)
    .slice(0, 2);

  return bestTokens.length ? titleCase(bestTokens.join(' ')) : 'Sin categoría';
};

const buildCategoryLabelMap = (products) => {
  const grouped = new Map();
  for (const product of products) {
    const categoryIds = Array.isArray(product?.categories) ? product.categories : [];
    for (const categoryId of categoryIds) {
      if (!grouped.has(categoryId)) grouped.set(categoryId, []);
      grouped.get(categoryId).push(cleanText(product?.name));
    }
  }

  const labelMap = {};
  for (const [categoryId, names] of grouped.entries()) {
    labelMap[categoryId] = buildCategoryPhrase(names);
  }
  return labelMap;
};

const buildBrandOptions = (products) => {
  const countMap = new Map();
  for (const product of products) {
    const brand = cleanText(getProductBrand(product));
    if (brand) countMap.set(brand, (countMap.get(brand) || 0) + 1);
  }
  return [...countMap.entries()]
    .sort((a, b) => compareStrings(a[0], b[0]))
    .map(([brand, count]) => ({ id: brand, label: brand, count }));
};

const buildCategoryOptions = (products, categoryLabelMap = {}) => {
  const countMap = new Map();
  for (const product of products) {
    const categories = Array.isArray(product?.categories) ? product.categories : [];
    for (const id of categories) {
      if (id) countMap.set(id, (countMap.get(id) || 0) + 1);
    }
  }
  return [...countMap.entries()]
    .sort((a, b) => compareStrings(a[0], b[0]))
    .map(([id, count], index) => ({
      id,
      label: categoryLabelMap[id] || `Categoría ${index + 1}`,
      count,
    }));
};

const getCategoryParentLabel = (label) => {
  const tokens = normalizeCategoryToken(label).split(/\s+/).filter(Boolean);
  if (!tokens.length) return 'Sin categoría';
  if (tokens.length === 1) return titleCase(tokens[0]);
  return titleCase(tokens[0]);
};

const buildCategoryTree = (categoryOptions) => {
  const parentMap = new Map();
  for (const option of categoryOptions) {
    const parentLabel = getCategoryParentLabel(option.label);
    const parentId = `group:${slugify(parentLabel)}`;
    if (!parentMap.has(parentId)) parentMap.set(parentId, { label: parentLabel, children: [] });
    parentMap.get(parentId).children.push(option);
  }

  return [...parentMap.entries()]
    .map(([id, value]) => ({
      id,
      label: value.label,
      count: value.children.reduce((sum, child) => sum + child.count, 0),
      children: value.children
        .sort((a, b) => b.count - a.count || compareStrings(a.label, b.label))
        .map(child => ({ id: child.id, label: child.label, count: child.count, children: [] })),
    }))
    .sort((a, b) => b.count - a.count || compareStrings(a.label, b.label));
};

const resolveCategorySelectionIds = (selectedCategory, categoryTree) => {
  if (!selectedCategory || selectedCategory === 'all') return [];
  const groupNode = categoryTree.find(node => node.id === selectedCategory);
  if (groupNode) return groupNode.children.map(child => child.id);
  for (const groupNodeCandidate of categoryTree) {
    const childMatch = groupNodeCandidate.children.find(child => child.id === selectedCategory);
    if (childMatch) return [childMatch.id];
  }
  return [selectedCategory];
};

const buildTypeOptions = (products) => {
  const groupedProducts = groupProductsForDisplay(products);
  const variantGroupCount = groupedProducts.filter(product => product?.isVariantGroup).length;
  const uniqueTypes = [...new Set(products.map(product => normalizeKey(product?.type)).filter(Boolean))].sort(compareStrings);
  const typeCounts = new Map();
  for (const product of products) {
    const type = normalizeKey(product?.type);
    if (!type) continue;
    typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
  }
  if (variantGroupCount > 0 || typeCounts.has('variant')) {
    typeCounts.set('variant', variantGroupCount || typeCounts.get('variant') || 0);
    if (!uniqueTypes.includes('variant')) uniqueTypes.push('variant');
  }
  return uniqueTypes.map(type => ({
    id: type,
    label: getProductTypeLabel(type),
    count: type === 'variant' ? (typeCounts.get('variant') || 0) : (typeCounts.get(type) || 0),
  }));
};

const buildStatusOptions = (products) => {
  const countMap = new Map();
  for (const product of products) {
    const status = normalizeStatusKey(product?.state || product?.status);
    if (status) countMap.set(status, (countMap.get(status) || 0) + 1);
  }
  return [...countMap.entries()]
    .sort((a, b) => compareStrings(a[0], b[0]))
    .map(([status, count]) => ({ id: status, label: getProductStatusLabel(status), count }));
};

const buildFacetOptions = (products, pickValue) => {
  const countMap = new Map();

  for (const product of products) {
    const value = cleanText(pickValue(product) || '').trim();
    if (!value) continue;

    const id = normalizeKey(value);
    const existing = countMap.get(id);
    if (existing) {
      existing.count += 1;
      continue;
    }

    countMap.set(id, { id, label: value, count: 1 });
  }

  return [...countMap.values()].sort((left, right) => compareStrings(left.label, right.label));
};

const buildVariantGroupOptions = (products) => {
  const groups = groupProductsForDisplay(products).filter(product => product?.isVariantGroup);

  return groups
    .map(product => {
      const id = cleanText(product?.variantGroupId || getVariantGroupSelectionId(product)).trim();
      if (!id) return null;

      const baseReference = cleanText(product?.baseReference).trim();
      const sku = cleanText(product?.number || product?.sku || '').trim();
      const name = cleanText(product?.name).trim() || baseReference || sku || product?.id;
      const labelSuffix = baseReference && baseReference !== sku ? ` · ${baseReference}` : '';
      const count = Array.isArray(product?.variants) ? product.variants.length + 1 : 1;

      return {
        id,
        label: `${name}${labelSuffix}`,
        count,
      };
    })
    .filter(Boolean)
    .sort((left, right) => compareStrings(left.label, right.label));
};

const buildPriceRange = (products) => {
  const prices = products
    .map(product => (typeof product?.price === 'number' && Number.isFinite(product.price) ? product.price : null))
    .filter(price => typeof price === 'number');

  if (!prices.length) {
    return { min: 0, max: 0 };
  }

  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
  };
};

const filterProducts = (
  products,
  searchTerm,
  selectedName,
  selectedNumber,
  selectedNumberOperator,
  selectedCollection,
  selectedRange,
  selectedVariantGroup,
  selectedPriceMin,
  selectedPriceMax,
  selectedEan,
  selectedFlow,
  selectedFinish,
  selectedAttributeQuery,
  selectedBrand,
  selectedCategoryIds,
  selectedType,
  selectedStatus,
  selectedMediaFilter,
  selectedQuickFilter
) => {
  let next = products;
  const normalizedName = cleanText(selectedName).trim();
  const normalizedNumber = cleanText(selectedNumber).trim();
  const normalizedCollection = cleanText(selectedCollection).trim();
  const normalizedRange = cleanText(selectedRange).trim();
  const normalizedVariantGroup = cleanText(selectedVariantGroup).trim();
  const normalizedEan = cleanText(selectedEan).trim();
  const normalizedFlow = cleanText(selectedFlow).trim();
  const normalizedFinish = cleanText(selectedFinish).trim();
  const normalizedAttributeQuery = cleanText(selectedAttributeQuery).trim();
  const normalizedSearch = cleanText(searchTerm).trim();
  const minPrice = parseNumberish(selectedPriceMin);
  const maxPrice = parseNumberish(selectedPriceMax);

  if (normalizedName) {
    const query = normalizedName.toLowerCase();
    next = next.filter(product => cleanText(product?.name).toLowerCase().includes(query));
  }

  if (normalizedNumber) {
    next = next.filter(product =>
      matchesTextOperator([product?.sku, product?.number, product?.id], normalizedNumber, selectedNumberOperator)
    );
  }

  if (normalizedCollection) {
    next = next.filter(product => matchesStructuredQuery([product?.collection], normalizedCollection));
  }

  if (normalizedRange) {
    next = next.filter(product => matchesStructuredQuery([product?.range], normalizedRange));
  }

  if (normalizedVariantGroup) {
    next = next.filter(product => getVariantGroupSelectionId(product) === normalizedVariantGroup);
  }

  if (normalizedEan) {
    const query = normalizedEan.toLowerCase();
    next = next.filter(product => cleanText(product?.ean).toLowerCase().includes(query));
  }

  if (normalizedFlow) {
    next = next.filter(product => matchesStructuredQuery([product?.flowRate], normalizedFlow));
  }

  if (normalizedFinish) {
    const query = normalizedFinish.toLowerCase();
    next = next.filter(product => {
      const directMatch = cleanText(product?.finish).toLowerCase().includes(query);
      const variantMatch = Array.isArray(product?.variants)
        ? product.variants.some(variant => cleanText(variant?.finish).toLowerCase().includes(query))
        : false;
      return directMatch || variantMatch;
    });
  }

  if (minPrice !== null || maxPrice !== null) {
    next = next.filter(product => {
      const price = parseNumberish(product?.price);
      if (price === null) return false;
      if (minPrice !== null && price < minPrice) return false;
      if (maxPrice !== null && price > maxPrice) return false;
      return true;
    });
  }

  if (normalizedAttributeQuery) {
    next = next.filter(product =>
      matchesStructuredQuery(
        [
          product?.attributeText,
          product?.name,
          product?.description,
          product?.collection,
          product?.range,
          product?.ean,
          product?.flowRate,
          product?.finish,
        ],
        normalizedAttributeQuery
      )
    );
  }

  if (normalizedSearch) {
    const query = normalizedSearch.toLowerCase();
    next = next.filter(product => {
      const haystack = [
        product?.name,
        product?.description,
        product?.sku,
        product?.brand,
        product?.category,
        product?.type,
        ...(Array.isArray(product?.categories) ? product.categories : []),
        ...(Array.isArray(product?.images) ? product.images.map(image => image?.alt || image?.url || '') : []),
        ...(Array.isArray(product?.attachments) ? product.attachments.map(attachment => `${attachment?.name || ''} ${attachment?.type || ''}`) : []),
        product?.attributeText,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }

  if (selectedBrand !== 'all') {
    next = next.filter(product => cleanText(getProductBrand(product)) === selectedBrand);
  }

  if (selectedCategoryIds.length > 0) {
    next = next.filter(product => (Array.isArray(product?.categories) ? product.categories : []).some(categoryId => selectedCategoryIds.includes(categoryId)));
  }

  if (selectedType !== 'all') {
    if (normalizeKey(selectedType) === 'variant') {
      const variantParentIds = new Set(
        next
          .filter(product => normalizeKey(product?.type) === 'variant')
          .map(product => getVariantParentId(product))
          .filter(Boolean)
      );
      next = next.filter(product => {
        const typeKey = normalizeKey(product?.type);
        return typeKey === 'variant' || (typeKey === 'group' && variantParentIds.has(product?.id));
      });
    } else {
      next = next.filter(product => normalizeKey(product?.type) === selectedType);
    }
  }

  if (selectedStatus !== 'all') {
    next = next.filter(product => normalizeStatusKey(product?.state || product?.status) === selectedStatus);
  }

  if (selectedQuickFilter === 'images') next = next.filter(product => hasImages(product));
  if (selectedQuickFilter === 'attachments') next = next.filter(product => hasDocuments(product));
  if (selectedQuickFilter === 'categories') next = next.filter(product => hasCategories(product));
  if (selectedQuickFilter === 'assets') next = next.filter(product => hasAssets(product));

  if (selectedMediaFilter === 'with-assets') next = next.filter(product => hasAssets(product));
  if (selectedMediaFilter === 'without-assets') next = next.filter(product => !hasAssets(product));
  if (selectedMediaFilter === 'images-only') next = next.filter(product => hasImages(product) && !hasDocuments(product));
  if (selectedMediaFilter === 'documents-only') next = next.filter(product => hasDocuments(product) && !hasImages(product));
  if (selectedMediaFilter === 'mixed') next = next.filter(product => hasMixedMedia(product));

  return next;
};

const buildCatalogBaseMeta = (products) => {
  const categoryLabelMap = buildCategoryLabelMap(products);
  const categoryOptions = buildCategoryOptions(products, categoryLabelMap);
  const categoryTree = buildCategoryTree(categoryOptions);
  const visibleCatalogCount = products.filter(product => normalizeKey(product?.type) !== 'variant').length;

  return {
    totalCatalogCount: visibleCatalogCount,
    totalRawProductCount: products.length,
    categoryLabelMap,
    brandOptions: buildBrandOptions(products),
    rangeOptions: buildFacetOptions(products, product => product?.range),
    variantGroupOptions: buildVariantGroupOptions(products),
    flowOptions: buildFacetOptions(products, product => product?.flowRate),
    finishOptions: buildFacetOptions(products, product => product?.finish),
    priceRange: buildPriceRange(products),
    categoryTree,
    typeOptions: buildTypeOptions(products),
    statusOptions: buildStatusOptions(products),
    imageCount: products.reduce((sum, product) => sum + (product?.assets?.length || 0), 0),
    attachmentCount: products.reduce((sum, product) => sum + (product?.attachments?.length || 0), 0),
    assetCount: products.filter(product => hasAssets(product)).length,
    withImagesCount: products.filter(product => hasImages(product)).length,
    withDocumentsCount: products.filter(product => hasDocuments(product)).length,
    mixedMediaCount: products.filter(product => hasMixedMedia(product)).length,
  };
};

const parseCatalogQuery = (searchParams) => ({
  tenantId: searchParams.get('tenant') || DEFAULT_TENANT,
  page: clamp(Number.parseInt(searchParams.get('page') || '1', 10) || 1, 1, Number.MAX_SAFE_INTEGER),
  pageSize: clamp(Number.parseInt(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE),
  sortBy: searchParams.get('sortBy') || 'relevance',
  searchTerm: searchParams.get('searchTerm') || '',
  selectedName: searchParams.get('selectedName') || '',
  selectedNumber: searchParams.get('selectedNumber') || '',
  selectedNumberOperator: ['is', 'starts_with', 'is_not'].includes(searchParams.get('selectedNumberOperator') || '')
    ? searchParams.get('selectedNumberOperator')
    : 'contains',
  selectedCollection: searchParams.get('selectedCollection') || '',
  selectedRange: searchParams.get('selectedRange') || '',
  selectedVariantGroup: searchParams.get('selectedVariantGroup') || '',
  selectedPriceMin: searchParams.get('selectedPriceMin') || '',
  selectedPriceMax: searchParams.get('selectedPriceMax') || '',
  selectedEan: searchParams.get('selectedEan') || '',
  selectedFlow: searchParams.get('selectedFlow') || '',
  selectedFinish: searchParams.get('selectedFinish') || '',
  selectedAttributeQuery: searchParams.get('selectedAttributeQuery') || '',
  selectedBrand: searchParams.get('selectedBrand') || 'all',
  selectedCategory: searchParams.get('selectedCategory') || 'all',
  selectedType: searchParams.get('selectedType') || 'all',
  selectedStatus: searchParams.get('selectedStatus') || 'all',
  selectedMediaFilter: searchParams.get('selectedMediaFilter') || 'all',
  selectedQuickFilter: searchParams.get('selectedQuickFilter') || 'all',
});

const buildCatalogPage = (entry, query) => {
  const selectedCategoryIds = resolveCategorySelectionIds(query.selectedCategory, entry.meta.categoryTree);
  const filteredProducts = filterProducts(
    entry.data,
    query.searchTerm,
    query.selectedName,
    query.selectedNumber,
    query.selectedNumberOperator,
    query.selectedCollection,
    query.selectedRange,
    query.selectedVariantGroup,
    query.selectedPriceMin,
    query.selectedPriceMax,
    query.selectedEan,
    query.selectedFlow,
    query.selectedFinish,
    query.selectedAttributeQuery,
    query.selectedBrand,
    selectedCategoryIds,
    query.selectedType,
    query.selectedStatus,
    query.selectedMediaFilter,
    query.selectedQuickFilter
  );
  const groupedProducts = groupProductsForDisplay(filteredProducts);
  const sortedProducts = sortCatalogProducts(groupedProducts, query.sortBy);
  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / query.pageSize));
  const currentPage = clamp(query.page, 1, totalPages);
  const startIndex = (currentPage - 1) * query.pageSize;
  const pageProducts = sortedProducts.slice(startIndex, startIndex + query.pageSize);
  const cacheAgeMs = Date.now() - entry.fetchedAt;

  return {
    products: pageProducts,
    meta: {
      ...entry.meta,
      currentPage,
      pageSize: query.pageSize,
      totalPages,
      filteredGroupCount: groupedProducts.length,
      imageCount: filteredProducts.reduce((sum, product) => sum + (product?.assets?.length || 0), 0),
      attachmentCount: filteredProducts.reduce((sum, product) => sum + (product?.attachments?.length || 0), 0),
      assetCount: filteredProducts.filter(product => hasAssets(product)).length,
      withImagesCount: filteredProducts.filter(product => hasImages(product)).length,
      withDocumentsCount: filteredProducts.filter(product => hasDocuments(product)).length,
      mixedMediaCount: filteredProducts.filter(product => hasMixedMedia(product)).length,
      cacheAgeMs,
      stale: cacheAgeMs > CATALOG_CACHE_TTL_MS,
    },
  };
};

const buildProductMedia = (assetIds, assetMap) => {
  const images = [];
  const attachments = [];

  assetIds.forEach((assetId, index) => {
    const asset = assetMap.get(assetId);
    if (!asset) return;
    const fileName = asset.fileName || asset.assetId;
    const lower = fileName.toLowerCase();
    if (isImageFileName(fileName)) {
      images.push({
        id: asset.assetId,
        url: asset.presignedUrl,
        downloadUrl: asset.presignedUrl,
        alt: fileName,
        isPrimary: index === 0,
      });
      return;
    }
    attachments.push({
      id: asset.assetId,
      name: fileName,
      url: asset.presignedUrl,
      downloadUrl: asset.presignedUrl,
      type: lower.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
    });
  });

  images.sort((a, b) => scoreImageByFileName(b) - scoreImageByFileName(a));
  return { images, attachments };
};

const getBaseUrl = (env) => (env === 'test' ? 'https://api.test.bluestonepim.com' : 'https://api.bluestonepim.com');
const getTokenUrl = (env) => (env === 'test' ? 'https://idp.test.bluestonepim.com/op/token' : 'https://idp.bluestonepim.com/op/token');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const fetchWithRetry = async (input, init, attempts = 4) => {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(input, init);
      if (response.ok || (response.status !== 429 && response.status < 500)) {
        return response;
      }

      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    if (attempt < attempts) {
      await sleep(400 * attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Request failed after retries');
};

const parseTenantMap = () => {
  const raw = process.env.BLUESTONE_TENANTS_JSON;
  if (!raw) {
    const clientId = process.env.BLUESTONE_CLIENT_ID;
    const clientSecret = process.env.BLUESTONE_CLIENT_SECRET;
    const orgId = process.env.BLUESTONE_ORG_ID;
    const env = process.env.BLUESTONE_ENV || 'test';

    if (!clientId || !clientSecret || !orgId) return {};

    return {
      [DEFAULT_TENANT]: {
        clientId,
        clientSecret,
        orgId,
        env,
        context: process.env.BLUESTONE_CONTEXT || 'en',
      },
    };
  }

  try {
    const parsed = JSON.parse(raw);
    return Object.fromEntries(
      Object.entries(parsed).filter(([, config]) => Boolean(config?.clientId && config?.clientSecret && config?.orgId && config?.env))
    );
  } catch {
    return {};
  }
};

const getTenantConfig = (tenantId) => {
  const tenants = parseTenantMap();
  return tenants[tenantId] || tenants[DEFAULT_TENANT] || null;
};

/**
 * Decodes the JWT payload and returns the tenant_id claim if present.
 * This relies on Supabase's custom JWT hook (auth.jwt()) embedding tenant_id.
 * Falls back to null if the header is absent or the token is malformed.
 */
const extractTenantFromJwt = (req) => {
  const auth = req.headers['authorization'];
  if (!auth?.startsWith('Bearer ')) return null;

  const token = auth.slice(7);
  try {
    const payloadB64 = token.split('.')[1];
    if (!payloadB64) return null;
    const decoded = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    return typeof decoded.tenant_id === 'string' && decoded.tenant_id ? decoded.tenant_id : null;
  } catch {
    return null;
  }
};

const normalizeProductBatch = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.items)) return data.items;
  return [];
};

const chunk = (items, size) => {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
};

const mapWithConcurrency = async (items, concurrency, mapper) => {
  const results = [];
  const queue = [...items].map((item, index) => ({ item, index }));
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (queue.length) {
      const next = queue.shift();
      if (!next) break;
      results[next.index] = await mapper(next.item, next.index);
    }
  });

  await Promise.all(workers);
  return results;
};

const isImageFileName = (fileName) => /\.(png|jpe?g|gif|webp|bmp|svg|avif|tiff?)$/i.test(fileName);

const scoreImageByFileName = (image) => {
  const descriptor = (image.alt || image.url || '').toLowerCase();
  let score = 0;
  const positive = ['foto', 'photo', 'principal', 'main', 'hero', 'producto', 'product', 'real', 'realista', 'lifestyle', 'render'];
  const negative = ['dibujo', 'drawing', 'sketch', 'esquema', 'diagram', 'diagrama', 'technical', 'tecnica', 'plano', 'blueprint', 'lineart', 'dwg', 'cad', 'section', 'vista', 'alzado', 'perfil', 'medida', 'medidas', 'dimension'];
  for (const kw of positive) if (descriptor.includes(kw)) score += 80;
  for (const kw of negative) if (descriptor.includes(kw)) score -= 260;
  return score;
};

const fetchDefinitions = async (tenant, token) => {
  const cacheKey = `${tenant.env}:${tenant.orgId}:${tenant.context || 'en'}`;
  const cached = definitionCache.get(cacheKey);
  if (cached) return cached;

  const promise = (async () => {
    const baseUrl = getBaseUrl(tenant.env);
    const definitions = new Map();
    let page = 0;
    const pageSize = 1000;

    while (true) {
      const response = await fetchWithRetry(`${baseUrl}/pim/definitions?page=${page}&pageSize=${pageSize}`, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${token}`,
          'x-organization-id': tenant.orgId,
          context: tenant.context || 'en',
          'context-fallback': 'true',
        },
      });

      if (!response.ok) {
        throw new Error(`Bluestone definitions request failed (${response.status}): ${await response.text()}`);
      }

      const payload = await response.json();
      const batch = Array.isArray(payload?.data) ? payload.data : [];
      if (!batch.length) break;

      for (const definition of batch) {
        const normalized = normalizeDefinition(definition);
        if (!normalized?.id) continue;
        definitions.set(normalized.id, normalized);
        if (normalized.number) definitions.set(normalized.number, normalized);
      }

      if (batch.length < pageSize) break;
      page += 1;
    }

    return definitions;
  })();

  definitionCache.set(cacheKey, promise);
  return promise;
};

const accessTokenCache = new Map();

const getAccessToken = async (tenant) => {
  const key = `${tenant.env}:${tenant.orgId}`;
  const cached = accessTokenCache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  const response = await fetchWithRetry(getTokenUrl(tenant.env), {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: tenant.clientId,
      client_secret: tenant.clientSecret,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token request failed (${response.status}): ${await response.text()}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error('Bluestone token response did not include an access token');
  }

  accessTokenCache.set(key, { token: data.access_token, expiresAt: Date.now() + 55 * 60 * 1000 });
  return data.access_token;
};

const fetchProducts = async (tenant) => {
  const cacheKey = `${tenant.env}:${tenant.orgId}:${tenant.context || 'en'}`;
  const cached = catalogCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CATALOG_CACHE_TTL_MS) {
    return cached;
  }

  try {
    const token = await getAccessToken(tenant);
    const baseUrl = getBaseUrl(tenant.env);
    const definitionMap = await fetchDefinitions(tenant, token);
    const allProducts = [];
    let cursor = null;

    do {
      const body = cursor
        ? {
            cursor,
            count: 100,
            views: [{ type: 'METADATA' }, { type: 'ATTRIBUTES' }, { type: 'ASSETS' }, { type: 'CATEGORIES' }, { type: 'LABELS' }],
          }
        : {
            count: 100,
            views: [{ type: 'METADATA' }, { type: 'ATTRIBUTES' }, { type: 'ASSETS' }, { type: 'CATEGORIES' }, { type: 'LABELS' }],
          };

      const response = await fetchWithRetry(`${baseUrl}/pim/products/cursor/views/all`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
          'x-organization-id': tenant.orgId,
          context: tenant.context || 'en',
          'context-fallback': 'true',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Bluestone products request failed (${response.status}): ${await response.text()}`);
      }

      const payload = await response.json();
      const batch = normalizeProductBatch(payload);
      allProducts.push(...batch);
      cursor = payload?.nextCursor || payload?.cursor || null;
    } while (cursor);

    const normalizedProducts = allProducts.map(product => {
      const ids = extractPreviewAssetIds(product);
      const rawAttributes = Array.isArray(product?.attributes) ? product.attributes : [];
      const attributes = enrichAttributes(rawAttributes, definitionMap);
      return normalizeCatalogProduct(
        { ...product, __includeAttributes: false, __assetIds: ids },
        { images: [], attachments: [] },
        attributes
      );
    }).filter(product => !isTestProduct(product));

    const entry = {
      data: normalizedProducts,
      meta: buildCatalogBaseMeta(normalizedProducts),
      fetchedAt: Date.now(),
    };

    catalogCache.set(cacheKey, entry);
    void persistCatalogCacheToDisk();

    return entry;
  } catch (error) {
    if (cached) {
      return cached;
    }

    throw error;
  }
};

const fetchProductDetail = async (tenant, productId) => {
  const token = await getAccessToken(tenant);
  const baseUrl = getBaseUrl(tenant.env);
  const response = await fetchWithRetry(`${baseUrl}/pim/products/${encodeURIComponent(productId)}`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
      'x-organization-id': tenant.orgId,
      context: tenant.context || 'en',
    },
  });

  if (!response.ok) {
    throw new Error(`Bluestone product request failed (${response.status}): ${await response.text()}`);
  }

  const product = await response.json();
  const assetIds = Array.isArray(product?.assets) ? product.assets.map(asset => String(asset).trim()).filter(Boolean) : [];
  const definitionMap = await fetchDefinitions(tenant, token);
  const assetMap = new Map();

  if (assetIds.length) {
    const batches = chunk(assetIds, 100);
    const fetchAssetBatch = async (batch) => {
      const batchResponse = await fetchWithRetry(`${baseUrl}/media-bank/assets/download`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
          'x-organization-id': tenant.orgId,
          context: tenant.context || 'en',
          'context-fallback': 'true',
        },
        body: JSON.stringify({ assetIds: batch, expiresInMinutes: 60 }),
      });

      if (!batchResponse.ok) {
        throw new Error(`Bluestone assets request failed (${batchResponse.status}): ${await batchResponse.text()}`);
      }

      const payload = await batchResponse.json();
      for (const asset of payload.assets || []) {
        if (!asset?.assetId || !asset?.presignedUrl) continue;
        assetMap.set(asset.assetId, {
          assetId: asset.assetId,
          presignedUrl: asset.presignedUrl,
          fileName: asset.fileName || asset.assetId,
        });
      }
    };

    await mapWithConcurrency(batches, 4, fetchAssetBatch);
  }

  const attributes = Array.isArray(product?.attributes)
    ? product.attributes.map(attribute => {
        const definitionId = String(attribute?.definitionId || '');
        const definition = definitionMap.get(definitionId);
        const rawValue = attribute?.value ?? attribute?.values;
        const displayValue = formatAttributeValue(rawValue);

        return {
          definitionId,
          definitionNumber: cleanText(definition?.number || attribute?.number || attribute?.definitionNumber || ''),
          definitionName: cleanText(definition?.name || attribute?.definitionName || attribute?.name || attribute?.label || definitionId || 'Atributo'),
          name: cleanText(definition?.name || attribute?.definitionName || attribute?.name || attribute?.label || definitionId || 'Atributo'),
          group: cleanText(definition?.group || attribute?.groupName || attribute?.group || ''),
          dataType: cleanText(definition?.dataType || attribute?.dataType || ''),
          value: displayValue,
          displayValue,
          rawValue,
          readOnly: Boolean(attribute?.readOnly),
        };
      })
    : [];

  return normalizeCatalogProduct(
    { ...product, __includeAttributes: true, __assetIds: assetIds },
    buildProductMedia(assetIds, assetMap),
    attributes
  );
};

const sendJson = (res, statusCode, body) => {
  res.writeHead(statusCode, {
    ...corsHeaders,
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(body));
};

const sendBuffer = (res, statusCode, body, headers = {}) => {
  res.writeHead(statusCode, {
    ...corsHeaders,
    ...headers,
  });
  res.end(body);
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1:3001'}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }

  if (url.pathname === '/api/organization-settings') {
    if (req.method === 'GET') {
      const tenantId = url.searchParams.get('tenant') || DEFAULT_TENANT;
      sendJson(res, 200, {
        tenantId,
        settings: organizationSettingsCache.get(tenantId) || DEFAULT_SETTINGS,
      });
      return;
    }

    if (req.method === 'PATCH' || req.method === 'POST') {
      try {
        const body = await new Promise((resolve, reject) => {
          let raw = '';
          req.on('data', chunk => {
            raw += chunk;
          });
          req.on('end', () => {
            try {
              resolve(raw ? JSON.parse(raw) : {});
            } catch (error) {
              reject(error);
            }
          });
          req.on('error', reject);
        });

        const tenantId = typeof body?.tenantId === 'string' && body.tenantId.trim() ? body.tenantId.trim() : DEFAULT_TENANT;
        const settings = normalizeSettings(body?.settings);
        organizationSettingsCache.set(tenantId, settings);
        await persistOrganizationSettings();

        sendJson(res, 200, { tenantId, settings });
      } catch (error) {
        sendJson(res, 500, {
          error: 'Failed to save organization settings',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
      return;
    }
  }

  if (url.pathname === '/api/organization-assets') {
    if (req.method === 'POST') {
      try {
        const request = new Request(`http://127.0.0.1:3001${url.pathname}`, {
          method: 'POST',
          headers: req.headers,
          body: req,
          duplex: 'half',
        });

        const formData = await request.formData();
        const tenantId = cleanText(String(formData.get('tenantId') || DEFAULT_TENANT)).trim() || DEFAULT_TENANT;
        const kind = cleanText(String(formData.get('kind') || 'asset')).trim() || 'asset';
        const file = formData.get('file');

        if (!(file instanceof File)) {
          sendJson(res, 400, { error: 'Missing file upload' });
          return;
        }

        const safeTenant = tenantId.replace(/[^a-zA-Z0-9._-]+/g, '-');
        const safeKind = kind.replace(/[^a-zA-Z0-9._-]+/g, '-');
        const baseName = path.parse(file.name || 'asset').name.replace(/[^a-zA-Z0-9._-]+/g, '-');
        const extension = (path.extname(file.name || '').replace('.', '') || 'bin').replace(/[^a-zA-Z0-9]+/g, '');
        const fileName = `${Date.now()}-${baseName || 'asset'}.${extension || 'bin'}`;
        const targetDir = path.join(brandingAssetsDir, safeTenant, safeKind);
        const targetPath = path.join(targetDir, fileName);

        await fs.mkdir(targetDir, { recursive: true });
        await fs.writeFile(targetPath, Buffer.from(await file.arrayBuffer()));

        const publicPath = `/api/organization-assets/${safeTenant}/${safeKind}/${fileName}`;
        sendJson(res, 200, { url: `http://127.0.0.1:3001${publicPath}`, path: publicPath });
      } catch (error) {
        sendJson(res, 500, {
          error: 'Failed to upload organization asset',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  if (url.pathname.startsWith('/api/organization-assets/')) {
    try {
      const relativePath = decodeURIComponent(url.pathname.replace('/api/organization-assets/', ''));
      const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
      const assetPath = path.join(brandingAssetsDir, normalized);
      const fileBuffer = await fs.readFile(assetPath);
      const extension = path.extname(assetPath).toLowerCase();
      const contentType =
        extension === '.png' ? 'image/png' :
        extension === '.jpg' || extension === '.jpeg' ? 'image/jpeg' :
        extension === '.webp' ? 'image/webp' :
        extension === '.svg' ? 'image/svg+xml' :
        extension === '.ico' ? 'image/x-icon' :
        'application/octet-stream';

      sendBuffer(res, 200, fileBuffer, {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      });
    } catch (error) {
      sendJson(res, 404, {
        error: 'Organization asset not found',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    return;
  }

  if (url.pathname === '/api/local-products') {
    try {
      const products = await loadLocalProducts();
      sendJson(res, 200, products);
    } catch (error) {
      sendJson(res, 500, {
        error: 'Failed to load local products',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    return;
  }

  if (url.pathname === '/api/asset') {
    const tenantId = url.searchParams.get('tenant') || DEFAULT_TENANT;
    const assetId = (url.searchParams.get('assetId') || '').trim();

    if (!assetId) {
      sendJson(res, 400, { error: 'assetId is required' });
      return;
    }

    const assetTenant = getTenantConfig(tenantId);
    if (!assetTenant) {
      sendJson(res, 400, { error: 'Tenant not configured' });
      return;
    }

    try {
      const assetToken = await getAccessToken(assetTenant);
      const assetBaseUrl = getBaseUrl(assetTenant.env);
      const assetResponse = await fetchWithRetry(`${assetBaseUrl}/media-bank/assets/download`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          authorization: `Bearer ${assetToken}`,
          'x-organization-id': assetTenant.orgId,
          context: assetTenant.context || 'en',
          'context-fallback': 'true',
        },
        body: JSON.stringify({ assetIds: [assetId], expiresInMinutes: 60 }),
      });

      if (!assetResponse.ok) {
        sendJson(res, assetResponse.status, { error: 'Failed to fetch asset' });
        return;
      }

      const assetPayload = await assetResponse.json();
      const asset = assetPayload.assets?.[0];
      if (!asset?.presignedUrl) {
        sendJson(res, 404, { error: 'Asset not found' });
        return;
      }

      res.writeHead(307, {
        ...corsHeaders,
        'Content-Type': 'text/plain',
        Location: asset.presignedUrl,
        'Cache-Control': 'public, max-age=3600',
      });
      res.end();
    } catch (error) {
      sendJson(res, 500, { error: 'Failed to proxy asset', message: error?.message });
    }
    return;
  }

  if (url.pathname !== '/api/catalog') {
    if (url.pathname === '/api/organizations') {
      sendJson(res, 200, { organizations: parsePublicOrganizations() });
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  try {
    const query = parseCatalogQuery(url.searchParams);
    const requestedTenantId = query.tenantId || DEFAULT_TENANT;
    const productId = typeof url.searchParams.get('productId') === 'string' ? url.searchParams.get('productId').trim() : '';
    const jwtTenantId = extractTenantFromJwt(req);

    // If the JWT carries a tenant_id claim, it must match the requested tenant.
    // This prevents a user from requesting another tenant's catalog via query param.
    if (jwtTenantId && requestedTenantId !== DEFAULT_TENANT && requestedTenantId !== jwtTenantId) {
      sendJson(res, 403, { error: 'Forbidden: tenant mismatch' });
      return;
    }

    // Prefer the claim from the JWT; fall back to query param for local dev.
    const tenantId = jwtTenantId ?? requestedTenantId;
    if (!jwtTenantId) {
      console.warn('[security] No tenant_id in JWT — using query param. Configure auth.jwt() hook in Supabase for production.');
    }

    const tenant = getTenantConfig(tenantId);

    if (!tenant) {
      sendJson(res, 400, { error: 'Tenant not configured' });
      return;
    }

    if (productId) {
      const product = await fetchProductDetail(tenant, productId);
      sendJson(res, 200, { data: product });
      return;
    }

    const catalogIndex = await fetchProducts(tenant);
    const page = buildCatalogPage(catalogIndex, query);
    sendJson(res, 200, { data: page.products, meta: page.meta });
  } catch (error) {
    sendJson(res, 500, {
      error: 'Failed to fetch catalog',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

const port = Number(process.env.PORT || 3001);
server.listen(port, '127.0.0.1', () => {
  console.log(`Bluestone proxy listening on http://127.0.0.1:${port}`);
});
