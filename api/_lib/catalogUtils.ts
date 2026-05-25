// Catalog utility functions for the API serverless function.
// Copied from src/features/catalog/selectors/catalogSelectors.ts to avoid
// cross-directory ESM resolution issues in Vercel @vercel/node compilation.
// Keep in sync with the source file when logic changes.

type AnyRecord = Record<string, unknown>;

type Product = AnyRecord & {
  id: string;
  name: string;
  sku?: string;
  number?: string;
  type?: string;
  brand?: string;
  category?: string;
  description?: string;
  images?: ProductImage[];
  attributes?: AnyRecord[];
  variants?: Product[];
  variantParentId?: string;
  stock?: number;
  hasImage?: boolean;
  hasDocument?: boolean;
  hasAsset?: boolean;
  assets?: string[];
};

type ProductImage = AnyRecord & {
  id?: string;
  url?: string;
  alt?: string;
  isPrimary?: boolean;
};

type ProductAttachment = AnyRecord & {
  id?: string;
  name?: string;
  url?: string;
  type?: string;
};

export type BrandOption = { id: string; label: string; count: number };
export type CategoryOption = { id: string; label: string; count: number };
export type CategoryTreeNode = { id: string; label: string; count: number; children: CategoryTreeNode[] };
export type StatusOption = { id: string; label: string; count: number };
export type TypeOption = { id: string; label: string; count: number };
export type FacetOption = { id: string; label: string; count: number };

export const cleanText = (value: unknown) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (!/[ÃÂâ]/.test(text)) return text;

  try {
    const bytes = Uint8Array.from(text, char => char.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes) || text;
  } catch {
    return text;
  }
};

export const normalizeKey = (value: unknown) => cleanText(value).trim().toLowerCase();

const tokenizeSearch = (value: unknown) =>
  normalizeKey(value)
    .split(/[^\p{L}\p{N}]+/u)
    .map(token => token.trim())
    .filter(token => token.length > 1);

const matchesStructuredQuery = (values: unknown[], query: string) => {
  const normalizedQuery = normalizeKey(query);
  if (!normalizedQuery) return true;

  const fullHaystack = values.map(value => cleanText(value)).join(' ').toLowerCase();
  if (normalizedQuery.length >= 3 && fullHaystack.includes(normalizedQuery)) return true;

  const hayTokens = values.flatMap(tokenizeSearch);
  const queryTokens = tokenizeSearch(query);
  if (!queryTokens.length) return false;

  return queryTokens.every(queryToken =>
    hayTokens.some(hayToken => hayToken === queryToken || hayToken.startsWith(queryToken))
  );
};

const parseNumberish = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = cleanText(value).replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  if (!text) return null;
  const parsed = Number.parseFloat(text[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

export const getProductBrand = (product: Product) => {
  const candidates = [
    product.brand,
    (product as AnyRecord).manufacturer,
    (product as AnyRecord).vendor,
    (product as AnyRecord).publisher,
    (product.metadata as AnyRecord | undefined)?.brand,
  ];

  for (const candidate of candidates) {
    const text = cleanText(candidate).trim();
    if (text) return text;
  }

  const attributes = Array.isArray(product.attributes)
    ? product.attributes
    : Object.entries((product.attributes as AnyRecord) || {}).map(([name, value]) => ({ name, value }));

  const brandAttribute = attributes.find((attribute: AnyRecord) => {
    const name = normalizeKey(attribute.name || attribute.label);
    return name.includes('marca') || name.includes('brand') || name.includes('fabricante') || name.includes('vendor');
  });

  return cleanText((brandAttribute?.value ?? (brandAttribute as AnyRecord)?.values) as unknown).trim();
};

export const getProductTypeLabel = (type: unknown) => {
  const normalized = normalizeKey(type);
  if (normalized === 'group') return 'Grupo';
  if (normalized === 'single') return 'Simple';
  if (normalized === 'variant') return 'Con acabados';
  if (normalized === 'bundle') return 'Bundle';
  return cleanText(type).trim() || 'Sin tipo';
};

const FINISH_COLORS: Record<string, string> = {
  'níquel mate': '#C8C8C8',
  'niquel mate': '#C8C8C8',
  'níquel': '#A8A9AD',
  'niquel': '#A8A9AD',
  'oro mate': '#C9A84C',
  'oro': '#D4AF37',
  'negro mate': '#2C2C2C',
  'negro': '#1A1A1A',
  'inox': '#8B8B8B',
  'cromo': '#DBE0E5',
  'cobre': '#B87333',
  'blanco': '#F5F5F5',
};

export const getVariantFinishLabel = (product: Product) => {
  const parentName = normalizeKey(product.name);
  const attributes = Array.isArray(product.attributes)
    ? product.attributes
    : Object.entries((product.attributes as AnyRecord) || {}).map(([key, value]) => ({
        key,
        name: key,
        label: key,
        value,
        displayValue: value,
      }));

  const candidateValues = [
    (product as AnyRecord).finish,
    (product as AnyRecord).color,
    (product as AnyRecord).acabado,
    (product as AnyRecord).finishName,
  ];

  for (const candidate of candidateValues) {
    const text = cleanText(candidate).trim();
    if (text && normalizeKey(text) !== parentName) return text;
  }

  const finishAttribute = attributes.find((attribute: AnyRecord) => {
    const key = normalizeKey(attribute.key || attribute.name || attribute.label || attribute.definitionName || attribute.definitionId || '');
    return ['finish', 'color', 'acabado'].includes(key);
  });

  const finishAttributeValue = cleanText(
    ((finishAttribute?.value ?? (finishAttribute as AnyRecord)?.displayValue ?? (finishAttribute as AnyRecord)?.values) as unknown)
  ).trim();

  if (finishAttributeValue && normalizeKey(finishAttributeValue) !== parentName) {
    return finishAttributeValue;
  }

  const skuFallback = cleanText(product.sku || (product as AnyRecord).number || product.id).trim();
  return skuFallback || finishAttributeValue;
};

export const getVariantSwatchColor = (product: Product, fallbackIndex = 0) => {
  const colorCandidates = [
    (product as AnyRecord).finishColor,
    (product as AnyRecord).colorHex,
    (product as AnyRecord).hex,
    (product as AnyRecord).swatchColor,
  ];

  for (const candidate of colorCandidates) {
    const color = cleanText(candidate).trim();
    if (color) return color;
  }

  const finishLabel = normalizeKey(getVariantFinishLabel(product));
  if (finishLabel && FINISH_COLORS[finishLabel]) return FINISH_COLORS[finishLabel];

  const attributes = Array.isArray(product.attributes)
    ? product.attributes
    : Object.entries((product.attributes as AnyRecord) || {}).map(([name, value]) => ({ name, value }));

  const colorAttribute = attributes.find((attribute: AnyRecord) => {
    const name = normalizeKey(attribute.definitionName || attribute.name || attribute.label || attribute.definitionId || '');
    return name.includes('color') || name.includes('acabado');
  });

  const attributeColor = cleanText(((colorAttribute as AnyRecord)?.displayValue ?? (colorAttribute as AnyRecord)?.value ?? (colorAttribute as AnyRecord)?.values) as unknown).trim();
  if (attributeColor) return attributeColor;

  const palette = Object.values(FINISH_COLORS);
  return palette[fallbackIndex % palette.length] || '#CBD5E1';
};

const normalizeStatusKey = (value: unknown) => {
  const normalized = normalizeKey(value);
  if (!normalized) return '';
  if (normalized.includes('playground') || normalized.includes('sandbox') || normalized.includes('test')) return 'draft';
  if (normalized.includes('draft') || normalized.includes('borrador')) return 'draft';
  if (normalized.includes('publish') || normalized.includes('published') || normalized.includes('public')) return 'published';
  if (normalized.includes('review') || normalized.includes('pending') || normalized.includes('to be published')) return 'to-be-published';
  if (normalized.includes('archive') || normalized.includes('archiv')) return 'archived';
  return normalized;
};

export const getProductStatusLabel = (status: unknown) => {
  const normalized = normalizeStatusKey(status);
  if (normalized === 'draft') return 'Borrador';
  if (normalized === 'to-be-published') return 'Por publicar';
  if (normalized === 'published') return 'Publicado';
  if (normalized === 'archived') return 'Archivado';
  return cleanText(status).trim() || 'Sin estado';
};

export const hasAssets = (product: Product) => {
  if (typeof (product as AnyRecord).hasAsset === 'boolean') return Boolean((product as AnyRecord).hasAsset);
  const images = Array.isArray(product.images) ? product.images.length : 0;
  const attachments = Array.isArray((product as AnyRecord).attachments) ? ((product as AnyRecord).attachments as unknown[]).length : 0;
  const assets = Array.isArray((product as AnyRecord).assets) ? ((product as AnyRecord).assets as unknown[]).length : 0;
  return images > 0 || attachments > 0 || assets > 0;
};

export const hasImages = (product: Product) =>
  typeof (product as AnyRecord).hasImage === 'boolean'
    ? Boolean((product as AnyRecord).hasImage)
    : (product.images?.length || 0) > 0 || Boolean((product as AnyRecord).thumbnailUrl) || Boolean((product as AnyRecord).previewImageAssetId);

export const hasDocuments = (product: Product) =>
  typeof (product as AnyRecord).hasDocument === 'boolean'
    ? Boolean((product as AnyRecord).hasDocument)
    : (Array.isArray((product as AnyRecord).attachments) ? ((product as AnyRecord).attachments as unknown[]).length : 0) > 0;

export const hasMixedMedia = (product: Product) => hasImages(product) && hasDocuments(product);

export const hasCategories = (product: Product) =>
  Array.isArray((product as AnyRecord).categories) ? ((product as AnyRecord).categories as unknown[]).length > 0 : Boolean((product as AnyRecord).category);

const getVariantParentId = (product: Product) =>
  cleanText(((product as AnyRecord).variantParentId || (product.metadata as AnyRecord | undefined)?.variantParentId || '') as unknown).trim();

const getProductTypeKey = (product: Product) =>
  normalizeKey((product as AnyRecord).type || (product.metadata as AnyRecord | undefined)?.type);

export const isTestProduct = (product: Product) => {
  const haystack = [
    product.id,
    product.name,
    product.sku,
    (product as AnyRecord).number,
    (product.metadata as AnyRecord | undefined)?.name,
    (product.metadata as AnyRecord | undefined)?.number,
  ]
    .map(value => normalizeKey(value).toUpperCase())
    .join(' ');

  return /\bTEST[_\s-]|DEBUG|PLAYGROUND\b/i.test(haystack) || /(^|[\s/_-])test($|[\s/_-])/i.test(haystack);
};

const scoreForRepresentative = (product: Product) => {
  let value = 0;
  if (hasImages(product)) value += 200;
  if (hasDocuments(product)) value += 100;
  if (hasAssets(product)) value += 20;
  value += Math.min((product.images?.length || 0) + (Array.isArray((product as AnyRecord).attachments) ? ((product as AnyRecord).attachments as unknown[]).length : 0), 9);
  value += cleanText(product.name).length ? 1 : 0;
  return value;
};

const scoreImageForDisplay = (image: ProductImage) => {
  const descriptor = cleanText([image?.alt, image?.downloadUrl, image?.url].filter(Boolean).join(' ')).toLowerCase();
  let score = 0;

  for (const keyword of ['foto', 'photo', 'principal', 'main', 'hero', 'producto', 'product', 'real', 'realista', 'lifestyle', 'render']) {
    if (descriptor.includes(keyword)) score += 80;
  }

  for (const keyword of ['dibujo', 'drawing', 'sketch', 'esquema', 'diagram', 'diagrama', 'technical', 'tecnica', 'técnica', 'plano', 'blueprint', 'lineart', 'dwg', 'cad', 'section', 'vista', 'alzado', 'perfil', 'medida', 'medidas', 'dimensión', 'dimension']) {
    if (descriptor.includes(keyword)) score -= 260;
  }

  if (/(\.jpe?g|\.png|\.webp)(\?|$)/i.test(descriptor)) score += 5;
  if (!image?.alt || cleanText(image.alt).trim() === 'Imagen') score -= 10;

  return score;
};

const scoreForMediaSource = (product: Product) => {
  const images = Array.isArray(product.images) ? product.images : [];
  const primaryImages = images.filter(image => Boolean(image?.isPrimary)).length;
  const bestImageScore = images.reduce((best: number, image: ProductImage) => Math.max(best, scoreImageForDisplay(image)), Number.NEGATIVE_INFINITY);
  let value = Number.isFinite(bestImageScore) ? bestImageScore * 10 : 0;
  value += primaryImages * 120;
  value += images.length * 25;
  value += hasDocuments(product) ? 10 : 0;
  value += hasAssets(product) ? 5 : 0;
  value += getProductTypeKey(product) === 'group' ? 20 : 0;
  return value;
};

export const groupProductsForDisplay = (products: Product[]) => {
  type GroupBucket = {
    id: string;
    representative: Product | null;
    members: Product[];
    syntheticKey?: string;
  };

  const buckets = new Map<string, GroupBucket>();
  const groupRootsById = new Map<string, Product>();
  const groupRootsByPrefix = new Map<string, Product>();

  const getNumberValue = (product: Product) => cleanText(((product as AnyRecord).number || product.sku || product.id) as unknown).trim();
  const getDisplayName = (product: Product) => cleanText(product.name).trim().toLowerCase();
  const extractVariantPrefix = (value: string) => {
    const normalized = cleanText(value).trim();
    if (!normalized) return '';

    const numericPrefixMatch = normalized.match(/^(\d{4,})/);
    if (numericPrefixMatch) return numericPrefixMatch[1];

    const alphanumericPrefixMatch = normalized.match(/^([A-Za-z0-9]{4,}?)(?:[-_ ]?[A-Za-z]+|\s+[A-Za-z]+)?$/);
    return alphanumericPrefixMatch?.[1] || '';
  };

  for (const product of products) {
    if (getProductTypeKey(product) !== 'group') continue;
    const numberValue = getNumberValue(product);
    const prefix = extractVariantPrefix(numberValue);
    if (!groupRootsById.has(product.id)) {
      groupRootsById.set(product.id, product);
    }
    if (prefix && !groupRootsByPrefix.has(prefix)) {
      groupRootsByPrefix.set(prefix, product);
    }
    if (numberValue && !groupRootsByPrefix.has(numberValue)) {
      groupRootsByPrefix.set(numberValue, product);
    }
  }

  for (const product of products) {
    const typeKey = getProductTypeKey(product);
    const parentId = getVariantParentId(product);
    const numberValue = getNumberValue(product);
    const prefix = extractVariantPrefix(numberValue);
    const matchedRoot =
      (parentId && groupRootsById.get(parentId)) ||
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
          : `single:${product.id}`;

    if (!buckets.has(bucketId)) {
      buckets.set(bucketId, {
        id: bucketId,
        representative: null,
        members: [],
      });
    }

    const bucket = buckets.get(bucketId)!;
    bucket.members.push(product);

    if (typeKey === 'group') {
      bucket.representative = product;
    }
  }

  const orphanSinglesBySignature = new Map<string, Product[]>();
  for (const bucket of buckets.values()) {
    if (bucket.id.startsWith('group:') || bucket.members.length !== 1) continue;

    const [single] = bucket.members;
    const numberValue = getNumberValue(single);
    const prefix = extractVariantPrefix(numberValue);
    if (!prefix) continue;

    const signature = `${prefix}:${getDisplayName(single)}`;
    if (!orphanSinglesBySignature.has(signature)) {
      orphanSinglesBySignature.set(signature, []);
    }
    orphanSinglesBySignature.get(signature)!.push(single);
  }

  for (const [signature, members] of orphanSinglesBySignature.entries()) {
    if (members.length < 2) continue;

    const bucketId = `synthetic:${signature}`;
    buckets.set(bucketId, {
      id: bucketId,
      representative: null,
      members,
      syntheticKey: signature,
    });

    for (const member of members) {
      buckets.delete(`single:${member.id}`);
    }
  }

  return [...buckets.values()]
    .map(bucket => {
      const sortedMembers = [...bucket.members].sort(
        (a, b) => scoreForRepresentative(b) - scoreForRepresentative(a) || cleanText(a.name).localeCompare(cleanText(b.name), 'es')
      );
      const representative = bucket.representative || sortedMembers[0] || null;

      if (!representative) return null;

      const variants = bucket.members
        .filter(product => product.id !== representative.id)
        .sort((a, b) => scoreForRepresentative(b) - scoreForRepresentative(a) || cleanText(a.name).localeCompare(cleanText(b.name), 'es'));
      const mediaSource =
        [...bucket.members]
          .sort((a, b) => scoreForMediaSource(b) - scoreForMediaSource(a) || scoreForRepresentative(b) - scoreForRepresentative(a))[0] ||
        representative;

      return {
        ...representative,
        name: cleanText(representative.name || bucket.members[0]?.name || 'Producto'),
        images: mediaSource?.images || representative.images,
        attachments: mediaSource ? (mediaSource as AnyRecord).attachments || (representative as AnyRecord).attachments : (representative as AnyRecord).attachments,
        assets: mediaSource ? (mediaSource as AnyRecord).assets || (representative as AnyRecord).assets : (representative as AnyRecord).assets,
        variants,
        variantCount: variants.length,
        variantGroupId: bucket.id,
        isVariantGroup: variants.length > 0,
      } as Product & {
        variants: Product[];
        variantCount: number;
        variantGroupId: string;
        isVariantGroup: boolean;
      };
    })
    .filter(Boolean) as Array<
      Product & {
        variants: Product[];
        variantCount: number;
        variantGroupId: string;
        isVariantGroup: boolean;
      }
    >;
};

const CATEGORY_STOP_WORDS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'y', 'o', 'a', 'en', 'para', 'con', 'sin',
  'kit', 'kits', 'compo', 'mndo', 'mundo', 'mn', 'emp', 'empotrado', 'empotrada',
  'empotrados', 'empotradas', 'sal', 'recto', 'caño', 'cano', 'caña', 'cana',
  'repisa', 'completo', 'completa', 'comple', 'grupo', 'single', 'variant',
  'variante', 'dcha', 'izq', 'izquierda', 'derecha', 'solo', 'home', 'standard',
  'playground_only', 'playground',
]);

const titleCase = (value: string) =>
  value
    .toLowerCase()
    .replace(/(^|\s|[-_/])\p{L}/gu, letter => letter.toUpperCase());

const slugify = (value: string) =>
  cleanText(value)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

const normalizeCategoryToken = (value: string) =>
  cleanText(value)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();

const getMeaningfulTokens = (value: string) =>
  normalizeCategoryToken(value)
    .split(/\s+/)
    .filter(token => token.length > 2 && !CATEGORY_STOP_WORDS.has(token));

const buildCategoryPhrase = (productNames: string[]) => {
  const phraseCount = new Map<string, number>();
  const tokenCount = new Map<string, number>();

  for (const name of productNames) {
    const tokens = getMeaningfulTokens(name);
    if (!tokens.length) continue;

    const candidate = tokens.slice(0, 2).join(' ');
    if (candidate) {
      phraseCount.set(candidate, (phraseCount.get(candidate) || 0) + 1);
    }

    for (const token of tokens) {
      tokenCount.set(token, (tokenCount.get(token) || 0) + 1);
    }
  }

  const bestPhrase = [...phraseCount.entries()].sort((a, b) => b[1] - a[1])[0];
  if (bestPhrase && bestPhrase[1] > 1) {
    return titleCase(bestPhrase[0]);
  }

  const bestTokens = [...tokenCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([token]) => token)
    .slice(0, 2);

  if (bestTokens.length) {
    return titleCase(bestTokens.join(' '));
  }

  return 'Sin categoría';
};

export const buildCategoryLabelMap = (products: Product[]) => {
  const grouped = new Map<string, string[]>();

  for (const product of products) {
    const categoryIds = Array.isArray((product as AnyRecord).categories) ? (product as AnyRecord).categories as string[] : [];
    for (const categoryId of categoryIds) {
      if (!grouped.has(categoryId)) grouped.set(categoryId, []);
      grouped.get(categoryId)!.push(cleanText(product.name));
    }
  }

  const labelMap: Record<string, string> = {};
  for (const [categoryId, names] of grouped.entries()) {
    labelMap[categoryId] = buildCategoryPhrase(names);
  }

  return labelMap;
};

export const buildBrandOptions = (products: Product[]): BrandOption[] => {
  const countMap = new Map<string, number>();
  for (const product of products) {
    const brand = cleanText(getProductBrand(product));
    if (brand) countMap.set(brand, (countMap.get(brand) ?? 0) + 1);
  }
  return [...countMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'es'))
    .map(([brand, count]) => ({ id: brand, label: brand, count }));
};

export const buildCategoryOptions = (products: Product[], categoryLabelMap: Record<string, string> = {}): CategoryOption[] => {
  const countMap = new Map<string, number>();
  for (const product of products) {
    const categories: string[] = Array.isArray((product as AnyRecord).categories) ? (product as AnyRecord).categories as string[] : [];
    for (const id of categories) {
      if (id) countMap.set(id, (countMap.get(id) ?? 0) + 1);
    }
  }
  return [...countMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'es'))
    .map(([id, count], index) => ({
      id,
      label: categoryLabelMap[id] || `Categoría ${index + 1}`,
      count,
    }));
};

const getCategoryParentLabel = (label: string) => {
  const tokens = normalizeCategoryToken(label).split(/\s+/).filter(Boolean);
  if (!tokens.length) return 'Sin categoría';
  return titleCase(tokens[0]);
};

export const buildCategoryTree = (categoryOptions: CategoryOption[]): CategoryTreeNode[] => {
  const parentMap = new Map<string, { label: string; children: CategoryOption[] }>();

  for (const option of categoryOptions) {
    const parentLabel = getCategoryParentLabel(option.label);
    const parentId = `group:${slugify(parentLabel)}`;

    if (!parentMap.has(parentId)) {
      parentMap.set(parentId, { label: parentLabel, children: [] });
    }

    parentMap.get(parentId)!.children.push(option);
  }

  return [...parentMap.entries()]
    .map(([id, value]) => ({
      id,
      label: value.label,
      count: value.children.reduce((sum, child) => sum + child.count, 0),
      children: value.children
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'es'))
        .map((child: CategoryOption) => ({
          id: child.id,
          label: child.label,
          count: child.count,
          children: [],
        })),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'es'));
};

export const resolveCategorySelectionIds = (selectedCategory: string, categoryTree: CategoryTreeNode[]) => {
  if (!selectedCategory || selectedCategory === 'all') return [];

  const groupNode = categoryTree.find(node => node.id === selectedCategory);
  if (groupNode) {
    return groupNode.children.map(child => child.id);
  }

  for (const groupNodeCandidate of categoryTree) {
    const childMatch = groupNodeCandidate.children.find(child => child.id === selectedCategory);
    if (childMatch) {
      return [childMatch.id];
    }
  }

  return [selectedCategory];
};

export const buildTypeOptions = (products: Product[]): TypeOption[] => {
  const groupedProducts = groupProductsForDisplay(products);
  const variantGroupCount = groupedProducts.filter(product => (product as AnyRecord).isVariantGroup).length;
  const uniqueTypes = [...new Set(products.map(product => normalizeKey(product.type)).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'es')
  );

  const typeCounts = new Map<string, number>();
  for (const product of products) {
    const type = normalizeKey(product.type);
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

export const buildStatusOptions = (products: Product[]): StatusOption[] => {
  const countMap = new Map<string, number>();
  for (const product of products) {
    const status = normalizeStatusKey((product as AnyRecord).state || (product as AnyRecord).status);
    if (status) countMap.set(status, (countMap.get(status) ?? 0) + 1);
  }
  return [...countMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'es'))
    .map(([status, count]) => ({
      id: status,
      label: getProductStatusLabel(status),
      count,
    }));
};

export const buildFacetOptions = (products: Product[], selector: (product: Product) => unknown): FacetOption[] => {
  const countMap = new Map<string, number>();
  for (const product of products) {
    const value = cleanText(selector(product)).trim();
    if (value) countMap.set(value, (countMap.get(value) ?? 0) + 1);
  }
  return [...countMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'es'))
    .map(([id, count]) => ({ id, label: id, count }));
};

export const buildPriceRange = (products: Product[]): { min: number; max: number } => {
  let min = Infinity;
  let max = -Infinity;
  for (const product of products) {
    const price = parseNumberish((product as AnyRecord).price);
    if (price === null) continue;
    if (price < min) min = price;
    if (price > max) max = price;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 0 };
  return { min, max };
};

export const filterProducts = (
  products: Product[],
  searchTerm: string,
  selectedName: string,
  selectedNumber: string,
  selectedCollection: string,
  selectedRange: string,
  selectedPriceMin: string,
  selectedPriceMax: string,
  selectedEan: string,
  selectedFlow: string,
  selectedFinish: string,
  selectedAttributeQuery: string,
  selectedBrand: string,
  selectedCategoryIds: string[],
  selectedType: string,
  selectedStatus: string,
  selectedMediaFilter: string,
  selectedQuickFilter: string
) => {
  let next = products;

  const normalizedName = cleanText(selectedName).trim();
  const normalizedNumber = cleanText(selectedNumber).trim();
  const normalizedCollection = cleanText(selectedCollection).trim();
  const normalizedRange = cleanText(selectedRange).trim();
  const normalizedEan = cleanText(selectedEan).trim();
  const normalizedFlow = cleanText(selectedFlow).trim();
  const normalizedFinish = cleanText(selectedFinish).trim();
  const normalizedAttributeQuery = cleanText(selectedAttributeQuery).trim();
  const normalizedSearch = cleanText(searchTerm).trim();
  const minPrice = parseNumberish(selectedPriceMin);
  const maxPrice = parseNumberish(selectedPriceMax);

  if (normalizedName) {
    const query = normalizedName.toLowerCase();
    next = next.filter(product => cleanText(product.name).toLowerCase().includes(query));
  }

  if (normalizedNumber) {
    const query = normalizedNumber.toLowerCase();
    next = next.filter(product => {
      const haystack = [
        product.sku,
        (product as AnyRecord).number,
        product.id,
      ]
        .map(value => cleanText(value).toLowerCase())
        .join(' ');
      return haystack.includes(query);
    });
  }

  if (normalizedCollection) {
    next = next.filter(product => matchesStructuredQuery([(product as AnyRecord).collection], normalizedCollection));
  }

  if (normalizedRange) {
    next = next.filter(product => matchesStructuredQuery([(product as AnyRecord).range], normalizedRange));
  }

  if (normalizedEan) {
    next = next.filter(product => matchesStructuredQuery([(product as AnyRecord).ean], normalizedEan));
  }

  if (normalizedFlow) {
    next = next.filter(product => matchesStructuredQuery([(product as AnyRecord).flowRate], normalizedFlow));
  }

  if (normalizedFinish) {
    next = next.filter(product =>
      matchesStructuredQuery(
        [
          (product as AnyRecord).finish,
          ...(Array.isArray(product.variants) ? product.variants.map(variant => getVariantFinishLabel(variant as Product)) : []),
        ],
        normalizedFinish
      )
    );
  }

  if (minPrice !== null || maxPrice !== null) {
    next = next.filter(product => {
      const price = parseNumberish((product as AnyRecord).price);
      if (price === null) return false;
      if (minPrice !== null && price < minPrice) return false;
      if (maxPrice !== null && price > maxPrice) return false;
      return true;
    });
  }

  if (normalizedAttributeQuery) {
    next = next.filter(product => {
      if (matchesStructuredQuery([(product as AnyRecord).attributeText], normalizedAttributeQuery)) return true;

      const attributes = Array.isArray(product.attributes)
        ? product.attributes
        : Object.entries((product.attributes as AnyRecord) || {}).map(([name, value]) => ({ name, value }));

      return attributes.some((attribute: AnyRecord) => {
        return matchesStructuredQuery([
          attribute.definitionName,
          attribute.name,
          attribute.label,
          attribute.definitionId,
          attribute.group,
          attribute.groupName,
          attribute.displayValue,
          attribute.value,
          attribute.values,
        ], normalizedAttributeQuery);
      });
    });
  }

  if (normalizedSearch) {
    const query = normalizedSearch.toLowerCase();
    next = next.filter(product => {
      const haystack = [
        product.name,
        product.description,
        product.sku,
        product.brand,
        product.category,
        product.type,
        ...(Array.isArray((product as AnyRecord).categories) ? (product as AnyRecord).categories as string[] : []),
        ...(Array.isArray(product.images) ? product.images.map((image: ProductImage) => image.alt || image.url || '') : []),
        ...(Array.isArray((product as AnyRecord).attachments)
          ? ((product as AnyRecord).attachments as ProductAttachment[]).map((attachment: ProductAttachment) => `${attachment.name || ''} ${attachment.type || ''}`)
          : []),
        (product as AnyRecord).attributeText,
        ...(Array.isArray(product.attributes)
          ? product.attributes.map((attr: AnyRecord) => `${attr.definitionName || attr.name || attr.label || ''} ${attr.displayValue ?? attr.value ?? attr.values ?? ''}`)
          : Object.entries((product.attributes as AnyRecord) || {}).map(([name, value]) => `${name} ${value}`)),
      ]
        .join(' ')
        .toLowerCase();

      const tokens = query.split(/\s+/).filter(Boolean);
      return tokens.every(token => haystack.includes(token));
    });
  }

  if (selectedBrand !== 'all') {
    next = next.filter(product => cleanText(getProductBrand(product)) === selectedBrand);
  }

  if (selectedCategoryIds.length > 0) {
    next = next.filter(product =>
      (Array.isArray((product as AnyRecord).categories) ? (product as AnyRecord).categories as string[] : []).some((categoryId: string) =>
        selectedCategoryIds.includes(categoryId)
      )
    );
  }

  if (selectedType !== 'all') {
    if (normalizeKey(selectedType) === 'variant') {
      const variantParentIds = new Set(
        next
          .filter(product => normalizeKey(product.type) === 'variant')
          .map(product => getVariantParentId(product))
          .filter(Boolean)
      );

      next = next.filter(product => {
        const typeKey = normalizeKey(product.type);
        return typeKey === 'variant' || (typeKey === 'group' && variantParentIds.has(product.id));
      });
    } else {
      next = next.filter(product => normalizeKey(product.type) === selectedType);
    }
  }

  if (selectedStatus !== 'all') {
    next = next.filter(product => normalizeStatusKey((product as AnyRecord).state || (product as AnyRecord).status) === selectedStatus);
  }

  if (selectedQuickFilter === 'images') {
    next = next.filter(product => hasImages(product));
  }

  if (selectedQuickFilter === 'attachments') {
    next = next.filter(product => hasDocuments(product));
  }

  if (selectedQuickFilter === 'categories') {
    next = next.filter(product => hasCategories(product));
  }

  if (selectedQuickFilter === 'assets') {
    next = next.filter(product => hasAssets(product));
  }

  if (selectedMediaFilter === 'with-assets') {
    next = next.filter(product => hasAssets(product));
  }

  if (selectedMediaFilter === 'without-assets') {
    next = next.filter(product => !hasAssets(product));
  }

  if (selectedMediaFilter === 'images-only') {
    next = next.filter(product => hasImages(product) && !hasDocuments(product));
  }

  if (selectedMediaFilter === 'documents-only') {
    next = next.filter(product => hasDocuments(product) && !hasImages(product));
  }

  if (selectedMediaFilter === 'mixed') {
    next = next.filter(product => hasMixedMedia(product));
  }

  return next;
};
