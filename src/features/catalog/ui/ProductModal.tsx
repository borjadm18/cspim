import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Languages,
  Layers,
  Plus,
  Tag,
  Upload,
  X,
} from 'lucide-react';
import type { Product, ProductImage } from '../api/productService';
import { cleanText, getPrimaryCategoryLabel, getVariantFinishLabel, getVariantSwatchColor } from '../selectors/catalogSelectors';

type SheetTab = 'contenido' | 'variantes' | 'historial' | 'canales';
type ProductStatus = 'draft' | 'pending' | 'published';
type LocaleCode = 'ES' | 'EN' | 'FR' | 'DE' | 'CA';

interface ProductModalProps {
  product: Product;
  categoryLabelMap: Record<string, string>;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onLocaleChange?: (locale: string) => void;
  activeLocale?: string;
  locales?: string[];
  onSave?: (patch: Partial<Product>) => void;
  onAddImage?: () => void;
  onAddDocument?: () => void;
  onAddVariant?: () => void;
  onNavigateBreadcrumb?: (segment: 'catalog' | 'category' | 'product', value?: string) => void;
  parentProduct?: Product | null;
  currentUserRole?: 'admin' | 'content_manager' | 'commercial';
}

const DEFAULT_LOCALES: LocaleCode[] = ['ES', 'EN', 'FR', 'DE', 'CA'];
const STATUS_META: Record<ProductStatus, { label: string; className: string; icon: typeof CircleDot }> = {
  draft: { label: 'Borrador', className: 'bg-amber-100 text-amber-800', icon: CircleDot },
  pending: { label: 'Por publicar', className: 'bg-blue-100 text-blue-800', icon: Clock3 },
  published: { label: 'Publicado', className: 'bg-green-100 text-green-800', icon: CheckCircle2 },
};

const STATUS_ORDER: ProductStatus[] = ['draft', 'pending', 'published'];

const fallbackImage = (title: string) => {
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

const normalizeText = (value: unknown) => cleanText(value).trim();

const formatValue = (value: unknown): string => {
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

const extractTextValue = (value: unknown): string => {
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

const formatDate = (value?: unknown) => {
  if (!value) return '';
  const date = new Date(typeof value === 'number' ? value : String(value));
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const resolveFileName = (url: string, fallback: string) => {
  try {
    const parsed = new URL(url);
    const lastSegment = parsed.pathname.split('/').filter(Boolean).pop();
    if (!lastSegment) return fallback;
    return decodeURIComponent(lastSegment);
  } catch {
    return fallback;
  }
};

const triggerDownload = async (url?: string, fileName?: string) => {
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

const normalizeKey = (value: string) => normalizeText(value).toLowerCase();

const attributeKeys = (attr: any) =>
  [
    attr.definitionName,
    attr.name,
    attr.label,
    attr.definitionId,
    attr.group,
    attr.groupName,
  ]
    .map(normalizeText)
    .filter(Boolean);

const valueFromAttribute = (attr: any) => formatValue(attr?.displayValue ?? attr?.value ?? attr?.values);

const isRenderableValue = (value: unknown) => {
  if (value === null || value === undefined) return false;
  const text = formatValue(value).trim();
  if (!text) return false;
  const lower = text.toLowerCase();
  return lower !== 'null' && lower !== 'undefined' && lower !== 'n/a';
};

const getProductStatus = (product: Product): ProductStatus => {
  const raw = normalizeKey(product.status || (product as any).state || (product as any).publicationState || '');
  if (raw.includes('publish')) return 'published';
  if (raw.includes('draft')) return 'draft';
  if (raw.includes('pending') || raw.includes('ready')) return 'pending';
  return 'pending';
};

const parseBooleanValue = (value: unknown): boolean | undefined => {
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

const buildAttributeLookup = (attributes: any[]) => {
  const lookup = new Map<string, any>();
  for (const attr of attributes) {
    for (const key of attributeKeys(attr)) {
      lookup.set(key, attr);
    }
  }
  return lookup;
};

const readTopLevelValue = (product: Product, keys: string[]) => {
  for (const key of keys) {
    const direct = (product as any)[key];
    if (isRenderableValue(direct)) return direct;
    const lowerKey = key.toLowerCase();
    const directMatch = Object.entries(product as Record<string, any>).find(([candidate]) => candidate.toLowerCase() === lowerKey);
    if (directMatch && isRenderableValue(directMatch[1])) return directMatch[1];
  }
  return undefined;
};

const readAttributeValue = (lookup: Map<string, any>, keys: string[]) => {
  for (const key of keys) {
    const attr = lookup.get(normalizeKey(key));
    if (!attr) continue;
    const value = valueFromAttribute(attr);
    if (value) return { attr, value };
  }
  return null;
};

const firstAvailableText = (product: Product, lookup: Map<string, any>, topLevelKeys: string[], attributeKeysList: string[]) => {
  const top = readTopLevelValue(product, topLevelKeys);
  if (isRenderableValue(top)) return formatValue(top);
  const attr = readAttributeValue(lookup, attributeKeysList);
  return attr?.value || '';
};

const firstAvailableNumber = (product: Product, lookup: Map<string, any>, topLevelKeys: string[], attributeKeysList: string[]) => {
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

const firstAvailableBoolean = (product: Product, lookup: Map<string, any>, topLevelKeys: string[], attributeKeysList: string[]) => {
  const top = readTopLevelValue(product, topLevelKeys);
  const parsedTop = parseBooleanValue(top);
  if (parsedTop !== undefined) return parsedTop;
  const attr = readAttributeValue(lookup, attributeKeysList);
  return attr ? parseBooleanValue(attr.value) : undefined;
};

const normalizeAttachmentName = (attachment: any) => cleanText(attachment.name || attachment.fileName || 'Documento');

const EditableLabel = ({ children, required = false }: { children: string; required?: boolean }) => (
  <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-gray-400">
    {children}
    {required ? <span className="ml-1 text-red-500">*</span> : null}
  </p>
);

const PlaceholderPanel = ({ text = 'Sección en desarrollo' }: { text?: string }) => (
  <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
    {text}
  </div>
);

export function ProductModal({
  product,
  categoryLabelMap,
  onClose,
  onPrev,
  onNext,
  onLocaleChange,
  activeLocale,
  locales = DEFAULT_LOCALES,
  onSave,
  onAddImage,
  onAddDocument,
  onAddVariant,
  onNavigateBreadcrumb,
  parentProduct,
  currentUserRole = 'admin',
}: ProductModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [activeVariantIndex, setActiveVariantIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<SheetTab>('contenido');
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle');
  const [localLocale, setLocalLocale] = useState<LocaleCode>('ES');
  const [copiedSku, setCopiedSku] = useState('');
  const canEditVisibility = currentUserRole === 'admin' || currentUserRole === 'content_manager';
  const canEditStatus = canEditVisibility;
  const canSave = canEditVisibility;
  const isVariantProduct = normalizeKey(product.type) === 'variant';
  const isGroupProduct = normalizeKey(product.type) === 'group';
  const variantSourceProduct = parentProduct && parentProduct.id !== product.id ? parentProduct : product;
  const variantRows = useMemo(() => (Array.isArray((variantSourceProduct as any).variants) ? (variantSourceProduct as any).variants : []), [
    variantSourceProduct,
  ]);
  const showVariantsTab = normalizeKey(product.type) === 'group' || isVariantProduct;

  const images = (product.images || []).filter(Boolean);
  const attachments = (product as any).attachments || [];
  const variants = variantRows;
  const categoryIds = Array.isArray((product as any).categories) ? (product as any).categories : [];
  const primaryCategory = getPrimaryCategoryLabel(product, categoryLabelMap);
  const productName = cleanText(product.name);
  const productSku = cleanText(product.sku || (product as any).number || 'Sin SKU');
  const productDescription = extractTextValue(product.description).trim();
  const currentLocale = normalizeText(activeLocale || localLocale || locales[0] || 'ES') || 'ES';
  const effectiveLocale = locales.includes(currentLocale.toUpperCase() as LocaleCode)
    ? (currentLocale.toUpperCase() as LocaleCode)
    : (locales[0]?.toUpperCase() as LocaleCode) || 'ES';
  const parentGroupLabel = parentProduct ? cleanText(parentProduct.name) : '';
  const variantLabel = isVariantProduct
    ? cleanText((product as any).finish || (product as any).finishName || (product as any).finishLabel || product.name)
    : '';
  const activeVariantId = isVariantProduct ? product.id : '';

  const attributes = useMemo(() => {
    const rawAttributes = Array.isArray(product.attributes)
      ? product.attributes
      : Object.entries(product.attributes || {}).map(([name, value]) => ({ name, value }));

    return rawAttributes.filter((attr: any) => {
      const attrName = normalizeText(attr.definitionName || attr.name || attr.label || attr.definitionId || '');
      const attrValue = attr.displayValue ?? attr.value ?? attr.values;
      return Boolean(attrName) && isRenderableValue(attrValue);
    });
  }, [product.attributes]);

  const attributeLookup = useMemo(() => buildAttributeLookup(attributes), [attributes]);
  const attributeSnapshot = useMemo(() => {
    const ean = firstAvailableText(
      product,
      attributeLookup,
      ['ean', 'EAN', 'codigoEAN', 'codigoEan', 'gtin', 'código ean', 'codigo ean'],
      ['ean', 'EAN', 'codigoEAN', 'codigoEan', 'gtin', 'código ean', 'codigo ean']
    );
    const baseRef = firstAvailableText(
      product,
      attributeLookup,
      ['baseRef', 'referenciaBaseAcabado', 'referencia base acabado', 'reference', 'ref'],
      ['referencia base acabado', 'base ref', 'referencia', 'ref']
    );
    const visibleOnWeb = firstAvailableBoolean(
      product,
      attributeLookup,
      ['visibleOnWeb', 'isWebVisible', 'webVisible', 'visible en web', 'esta web'],
      ['visibleOnWeb', 'isWebVisible', 'webVisible', 'visible en web', 'esta web']
    );
    const price = firstAvailableNumber(product, attributeLookup, ['price', 'precio', 'pvp'], ['precio', 'pvp']);
    const weight = firstAvailableText(product, attributeLookup, ['weight', 'peso', 'peso (kg)'], ['peso', 'peso (kg)']);
    const collection = firstAvailableText(product, attributeLookup, ['collection', 'coleccion', 'colección'], ['collection', 'coleccion', 'colección']);
    const range = firstAvailableText(product, attributeLookup, ['range', 'gama'], ['range', 'gama']);
    const technicalSheet = attachments.find((attachment: any) => /pdf|ficha|technical|tecnica|técnica/i.test(normalizeAttachmentName(attachment)) || /pdf/i.test(String(attachment.type || '')));

    return {
      ean,
      baseRef,
      visibleOnWeb,
      price,
      weight,
      collection,
      range,
      technicalSheet,
    };
  }, [attributeLookup, attachments, product]);

  const [draft, setDraft] = useState(() => ({
    description: productDescription,
    ean: attributeSnapshot.ean,
    baseRef: attributeSnapshot.baseRef,
    visibleOnWeb: attributeSnapshot.visibleOnWeb,
    price: attributeSnapshot.price !== undefined ? String(attributeSnapshot.price) : '',
    weight: attributeSnapshot.weight,
    collection: attributeSnapshot.collection,
    range: attributeSnapshot.range,
    status: getProductStatus(product),
  }));

  useEffect(() => {
    setCurrentImageIndex(0);
    setActiveVariantIndex(0);
    setActiveTab('contenido');
    setSaveState('idle');
    setDraft({
      description: productDescription,
      ean: attributeSnapshot.ean,
      baseRef: attributeSnapshot.baseRef,
      visibleOnWeb: attributeSnapshot.visibleOnWeb,
      price: attributeSnapshot.price !== undefined ? String(attributeSnapshot.price) : '',
      weight: attributeSnapshot.weight,
      collection: attributeSnapshot.collection,
      range: attributeSnapshot.range,
      status: getProductStatus(product),
    });
  }, [product.id, productDescription, attributeSnapshot, product]);

  useEffect(() => {
    if (!variantRows.length) {
      setActiveVariantIndex(0);
      return;
    }

    const matchedIndex = variantRows.findIndex((variant: any) => variant.id === product.id);
    setActiveVariantIndex(matchedIndex >= 0 ? matchedIndex : 0);
  }, [product.id, variantRows]);

  const activeVariant = variants[activeVariantIndex];
  const variantImages = Array.isArray(activeVariant?.images) ? activeVariant.images.filter(Boolean) : [];
  const imageSet = variantImages.length ? variantImages : images;
  const currentImage = imageSet[currentImageIndex] || imageSet[0] || images[0];
  const currentImageUrl = currentImage?.url || fallbackImage(productName);
  const currentImageFileName = currentImage?.alt || `${productName || 'imagen'}.jpg`;
  const lastUpdate = formatDate((product as any).lastUpdate || (product as any).updatedAt || (product as any).createDate);
  const updatedBy = cleanText((product as any).updatedBy || (product as any).lastUpdatedBy || (product as any).authorEmail || 'admin@demo.com');
  const shortId = cleanText(product.id).slice(0, 12) + (cleanText(product.id).length > 12 ? '…' : '');

  const requiredFieldState = [
    { label: 'EAN', value: draft.ean },
    { label: 'Referencia base acabado', value: draft.baseRef },
    {
      label: 'Visible en web',
      value: draft.visibleOnWeb === undefined || draft.visibleOnWeb === null ? '' : 'present',
    },
    {
      label: 'Precio (€)',
      value: draft.price.trim() && !Number.isNaN(Number(draft.price.replace(',', '.'))) ? draft.price : '',
    },
  ];

  const missingFields = requiredFieldState.filter(item => !String(item.value || '').trim()).map(item => item.label);
  const completeness = Math.round(((requiredFieldState.length - missingFields.length) / requiredFieldState.length) * 100);
  const completenessLabel = `${completeness}%`;
  const productStatus = STATUS_META[draft.status];

  const savePayload = () => ({
    description: draft.description,
    ean: draft.ean,
    baseRef: draft.baseRef,
    visibleOnWeb: draft.visibleOnWeb,
    price: draft.price.trim() ? Number(draft.price.replace(',', '.')) : undefined,
    weight: draft.weight,
    collection: draft.collection,
    range: draft.range,
    status: draft.status,
  });

  const handleSave = () => {
    onSave?.(savePayload());
    setSaveState('saved');
    window.setTimeout(() => setSaveState('idle'), 1800);
  };

  const copySkuToClipboard = async (sku: string) => {
    try {
      await navigator.clipboard.writeText(sku);
      setCopiedSku(sku);
      window.setTimeout(() => setCopiedSku(''), 1200);
    } catch {
      const input = document.createElement('input');
      input.value = sku;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
      setCopiedSku(sku);
      window.setTimeout(() => setCopiedSku(''), 1200);
    }
  };

  const cycleLocale = () => {
    const currentIndex = locales.findIndex(locale => locale.toUpperCase() === effectiveLocale);
    const nextLocale = locales[(currentIndex + 1) % locales.length] || locales[0] || 'ES';
    if (!activeLocale) setLocalLocale(nextLocale as LocaleCode);
    onLocaleChange?.(nextLocale);
  };

  const exportPayload = () => {
    const payload = {
      id: product.id,
      name: product.name,
      sku: productSku,
      description: draft.description,
      status: draft.status,
      visibleOnWeb: draft.visibleOnWeb,
      ean: draft.ean,
      baseRef: draft.baseRef,
      price: draft.price,
      collection: draft.collection,
      range: draft.range,
      images: images.map(image => ({ url: image.url, alt: image.alt })),
      attachments: attachments.map((attachment: any) => ({
        name: normalizeAttachmentName(attachment),
        url: attachment.downloadUrl || attachment.url,
        type: attachment.type,
      })),
      categories: categoryIds.map((categoryId: string) => ({
        id: categoryId,
        label: cleanText(categoryLabelMap[categoryId] || categoryId),
      })),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `${productSku || productName || 'producto'}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  };

  const StatusIcon = productStatus.icon;

  const renderField = (
    label: string,
    value: string,
    onChange: (next: string) => void,
    opts?: { required?: boolean; placeholder?: string; type?: string }
  ) => (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
      <EditableLabel required={opts?.required}>{label}</EditableLabel>
      <input
        type={opts?.type || 'text'}
        value={value}
        placeholder={opts?.placeholder || '—'}
        onChange={event => onChange(event.currentTarget.value)}
        className="mt-2 w-full border-b border-dashed border-slate-300 bg-transparent pb-1 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-800 focus:border-slate-800"
      />
    </div>
  );

  const visibleToggle = (
    <button
      type="button"
      onClick={() => {
        const next = !draft.visibleOnWeb;
        setDraft(previous => ({ ...previous, visibleOnWeb: next }));
      }}
      className={`inline-flex h-[18px] w-8 items-center rounded-full px-[2px] transition ${
        draft.visibleOnWeb ? 'bg-green-600' : 'bg-gray-300'
      }`}
      aria-pressed={Boolean(draft.visibleOnWeb)}
      aria-label="Visible en web"
    >
      <span
        className={`h-3.5 w-3.5 rounded-full bg-white shadow-sm transition ${
          draft.visibleOnWeb ? 'translate-x-3.5' : 'translate-x-0'
        }`}
      />
    </button>
  );

  const contentPanel = (
    <div className="grid gap-0 xl:grid-cols-2">
      <section className="border-r border-slate-200 bg-slate-50 px-5 py-5">
        <div className="space-y-4">
          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-gray-400">Imágenes</p>
              <button
                type="button"
                onClick={onAddImage}
                className="text-xs font-medium text-blue-600 transition hover:text-blue-700"
              >
                + Añadir
              </button>
            </div>

            <div className="relative overflow-hidden rounded-[22px] border border-slate-100 bg-slate-50">
              <div className="group/image relative flex min-h-[440px] aspect-[4/3] items-center justify-center bg-gradient-to-b from-white to-slate-50 p-2">
                <img
                  src={currentImageUrl}
                  alt={productName}
                  className="max-h-full max-w-full object-contain"
                  onError={event => {
                    (event.target as HTMLImageElement).src = fallbackImage(productName);
                  }}
                />

                <button
                  type="button"
                  onClick={() => void triggerDownload(currentImage?.downloadUrl || currentImage?.url, currentImageFileName)}
                  className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 opacity-0 shadow-sm transition hover:bg-white group-hover/image:opacity-100"
                  aria-label="Descargar imagen"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>

                {imageSet.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setCurrentImageIndex(prev => (prev - 1 + imageSet.length) % imageSet.length)}
                      className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-800 opacity-0 shadow-md transition hover:bg-white group-hover/image:opacity-100"
                      aria-label="Imagen anterior"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentImageIndex(prev => (prev + 1) % imageSet.length)}
                      className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-800 opacity-0 shadow-md transition hover:bg-white group-hover/image:opacity-100"
                      aria-label="Imagen siguiente"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-slate-200 bg-white/95 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 shadow-sm">
                      {currentImageIndex + 1} / {imageSet.length}
                    </div>
                  </>
                )}
              </div>

              {imageSet.length > 1 && (
                <div className="border-t border-slate-100 bg-white p-4">
                  <div className="flex flex-wrap gap-2">
                    {imageSet.map((image: ProductImage, index: number) => (
                      <button
                        type="button"
                        key={image.id || image.url || index}
                        onClick={() => setCurrentImageIndex(index)}
                      className={`flex h-[52px] w-[52px] items-center justify-center overflow-hidden rounded-xl border bg-slate-50 p-1 transition ${
                          currentImageIndex === index
                            ? 'border-[color:var(--catalog-accent)] ring-2 ring-[color:var(--catalog-accent-soft)]/70'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <img
                          src={image.url}
                          alt={image.alt || `${productName} ${index + 1}`}
                          className="h-full w-full object-contain"
                          onError={event => {
                            (event.target as HTMLImageElement).src = fallbackImage(productName);
                          }}
                        />
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={onAddImage}
                      className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-slate-400 transition hover:border-slate-400 hover:text-slate-600"
                      aria-label="Añadir imagen"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}

              {isGroupProduct && variants.length > 1 ? (
                <div className="mt-2 flex items-center gap-2 rounded-sm border border-gray-200 bg-white px-3 py-2 text-xs">
                  <div className="pr-2 text-[10px] uppercase tracking-wide text-gray-400">Acabado</div>
                  <div className="flex items-center gap-1.5 border-l border-gray-200 pl-2">
                    {(() => {
                      const visibleVariants = variants.length > 6 ? variants.slice(0, 5) : variants.slice(0, 6);
                      const overflowCount = variants.length > 6 ? variants.length - 5 : 0;
                      return (
                        <>
                          {visibleVariants.map((variant: any, index: number) => {
                            const isActive = activeVariantIndex === index;
                            const label = getVariantFinishLabel(variant) || cleanText(variant.sku || variant.number || variant.id || `Acabado ${index + 1}`);
                            const color = getVariantSwatchColor(variant, index);
                            return (
                              <button
                                key={variant.id || variant.number || index}
                                type="button"
                                title={label}
                                onClick={() => {
                                  setActiveVariantIndex(index);
                                  setCurrentImageIndex(0);
                                }}
                                className={`h-4 w-4 rounded-sm border border-transparent transition ${
                                  isActive ? 'border-[color:var(--catalog-accent)] ring-1 ring-[color:var(--catalog-accent)]' : ''
                                }`}
                                style={{ backgroundColor: color || '#C8C8C8' }}
                              />
                            );
                          })}
                          {overflowCount > 0 ? (
                            <span className="rounded-sm bg-gray-100 px-1.5 text-[10px] text-gray-400">+{overflowCount}</span>
                          ) : null}
                        </>
                      );
                    })()}
                  </div>
                  <div className="min-w-0 border-l border-gray-200 pl-2 text-xs font-medium text-gray-900">
                    {cleanText(getVariantFinishLabel(activeVariant) || activeVariant?.sku || '') || '—'}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-gray-400">Documentos</p>
              <button
                type="button"
                onClick={onAddDocument}
                className="text-xs font-medium text-blue-600 transition hover:text-blue-700"
              >
                + Añadir
              </button>
            </div>

            {attachments.length > 0 ? (
              <div className="space-y-3">
                {attachments.map((attachment: any, index: number) => {
                  const attachmentName = normalizeAttachmentName(attachment);
                  const fileName = resolveFileName(attachment.downloadUrl || attachment.url || '', attachmentName);
                  const actionLabel = String(attachment.type || '').toLowerCase().includes('pdf') || fileName.toLowerCase().endsWith('.pdf')
                    ? 'Descargar PDF'
                    : 'Descargar';

                  return (
                    <div
                      key={attachment.id || attachment.url || index}
                      className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-[color:var(--catalog-accent)]/30 hover:bg-white"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#d90429] text-white">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{attachmentName}</p>
                        <p className="mt-0.5 text-xs uppercase tracking-[0.18em] text-slate-500">
                          {cleanText(attachment.type || 'Documento')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void triggerDownload(attachment.downloadUrl || attachment.url, fileName)}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 transition hover:bg-slate-50"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {actionLabel}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <button
                type="button"
                onClick={onAddDocument}
                className="flex min-h-[120px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center transition hover:border-slate-400 hover:bg-slate-100"
              >
                <Upload className="mb-3 h-7 w-7 text-slate-400" />
                <span className="text-sm font-medium text-slate-900">Añadir ficha técnica</span>
                <span className="mt-1 text-xs text-slate-500">PDF, manuales o documentación de soporte</span>
              </button>
            )}
          </div>

          
          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-gray-400">Descripción comercial</p>
              <span className="text-xs text-slate-500">{draft.description.length} / 500 caracteres</span>
            </div>
            <textarea
              value={draft.description}
              onChange={event => setDraft(previous => ({ ...previous, description: event.currentTarget.value.slice(0, 500) }))}
              placeholder="Escribe una descripción del producto para el canal web…"
              className="min-h-[100px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-800 focus:bg-white"
            />
            {!draft.description.trim() ? (
              <p className="mt-2 text-xs text-red-600">Campo obligatorio para publicar</p>
            ) : (
              <p className="mt-2 text-xs text-slate-400">Texto visible en el canal web y exportaciones internas.</p>
            )}
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-gray-400">Identificación</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {renderField('EAN', draft.ean, next => setDraft(previous => ({ ...previous, ean: next })), {
                required: true,
                placeholder: '—',
              })}
              {renderField('Referencia base acabado', draft.baseRef, next => setDraft(previous => ({ ...previous, baseRef: next })), {
                required: true,
                placeholder: '—',
              })}
              {renderField('Peso (kg)', draft.weight, next => setDraft(previous => ({ ...previous, weight: next })), {
                placeholder: '—',
              })}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                <EditableLabel required>Visible en web</EditableLabel>
                <div className="mt-3 flex items-center gap-3">
                  {canEditVisibility ? (
                    <>
                      {visibleToggle}
                      <span className="text-sm font-medium text-slate-900">
                        {draft.visibleOnWeb ? 'Sí, visible' : 'No, oculto'}
                      </span>
                    </>
                  ) : (
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                        draft.visibleOnWeb ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {draft.visibleOnWeb ? 'Visible' : 'No visible'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-gray-400">Atributos técnicos</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {renderField('Colección', draft.collection, next => setDraft(previous => ({ ...previous, collection: next })), {
                placeholder: '—',
              })}
              {renderField('Gama', draft.range, next => setDraft(previous => ({ ...previous, range: next })), {
                placeholder: '—',
              })}
              {renderField('Precio (€)', draft.price, next => setDraft(previous => ({ ...previous, price: next })), {
                required: true,
                placeholder: '—',
                type: 'number',
              })}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                <EditableLabel>Ficha técnica</EditableLabel>
                {attributeSnapshot.technicalSheet ? (
                  <button
                    type="button"
                    onClick={() =>
                      void triggerDownload(
                        attributeSnapshot.technicalSheet.downloadUrl || attributeSnapshot.technicalSheet.url,
                        normalizeAttachmentName(attributeSnapshot.technicalSheet)
                      )
                    }
                    className="mt-3 inline-flex items-center gap-2 rounded-full border border-[color:var(--catalog-accent)]/20 bg-[color:var(--catalog-accent-soft)]/45 px-3 py-1.5 text-xs font-semibold text-[color:var(--catalog-accent)] transition hover:border-[color:var(--catalog-accent)]/35 hover:bg-[color:var(--catalog-accent-soft)]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir documento
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onAddDocument}
                    className="mt-3 inline-flex items-center gap-2 rounded-full border border-dashed border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-400"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Añadir ficha técnica
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-gray-400">Categorías</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {categoryIds.length > 0 ? (
                categoryIds.map((categoryId: string, index: number) => (
                  <span
                    key={categoryId}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700"
                    title={categoryId}
                  >
                    <Tag className="h-3.5 w-3.5 text-slate-400" />
                    {cleanText(categoryLabelMap[categoryId] || `Categoría ${index + 1}`)}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500">Sin categorías vinculadas</span>
              )}
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-500 transition hover:border-slate-400 hover:text-slate-700"
                onClick={() => onNavigateBreadcrumb?.('category', categoryIds[0])}
              >
                <Plus className="h-3.5 w-3.5" />
                Añadir
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  const variantsPanel = (
    <div className="px-6 py-6">
      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900">{variants.length} acabados</p>
          </div>
          <button
            type="button"
            onClick={() => onAddVariant?.()}
            className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" />
            Añadir acabado
          </button>
        </div>

        {variants.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-white">
                <tr className="border-b border-gray-100">
                  <th className="px-4 pb-2 text-left text-[10px] font-medium uppercase tracking-widest text-gray-400">Acabado</th>
                  <th className="px-4 pb-2 text-left text-[10px] font-medium uppercase tracking-widest text-gray-400">SKU</th>
                  <th className="px-4 pb-2 text-left text-[10px] font-medium uppercase tracking-widest text-gray-400">EAN</th>
                  <th className="px-4 pb-2 text-left text-[10px] font-medium uppercase tracking-widest text-gray-400">Precio (€)</th>
                  <th className="px-4 pb-2 text-left text-[10px] font-medium uppercase tracking-widest text-gray-400">Peso (kg)</th>
                  <th className="px-4 pb-2 text-left text-[10px] font-medium uppercase tracking-widest text-gray-400">Estado</th>
                  <th className="px-4 pb-2 text-left text-[10px] font-medium uppercase tracking-widest text-gray-400">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((variant: any, index: number) => {
                  const variantSku = cleanText(variant.sku || variant.number || variant.id || '—');
                  const finishLabel = getVariantFinishLabel(variant) || `Acabado ${index + 1}`;
                  const finishColor = getVariantSwatchColor(variant, index);
                  const variantEan = cleanText(
                    variant.ean ||
                      variant.EAN ||
                      variant.attributes?.ean ||
                      variant.attributes?.EAN ||
                      variant.attributes?.gtin ||
                      ''
                  ).trim();
                  const variantPriceRaw = variant.price ?? variant.attributes?.price ?? variant.attributes?.precio;
                  const variantWeightRaw = variant.weight ?? variant.attributes?.weight ?? variant.attributes?.peso;
                  const variantPrice =
                    variantPriceRaw === null || variantPriceRaw === undefined || String(variantPriceRaw).trim() === ''
                      ? '—'
                      : formatValue(variantPriceRaw);
                  const variantWeight =
                    variantWeightRaw === null || variantWeightRaw === undefined || String(variantWeightRaw).trim() === ''
                      ? '—'
                      : formatValue(variantWeightRaw);
                  const variantStatus = STATUS_META[getProductStatus(variant as Product)];
                  const isCurrentVariant = activeVariantId === variant.id;

                  return (
                    <tr
                      key={variant.id || variantSku || index}
                      className={`border-b border-gray-50 transition-colors hover:bg-gray-50 ${isCurrentVariant ? 'bg-blue-50' : 'bg-white'}`}
                    >
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-3.5 w-3.5 rounded-full border border-white shadow-sm ring-1 ring-slate-200"
                            style={{ backgroundColor: finishColor || 'var(--catalog-accent)' }}
                          />
                          <span className="text-sm font-medium text-slate-900">{finishLabel}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <button
                          type="button"
                          onClick={() => void copySkuToClipboard(variantSku)}
                          className="group inline-flex items-center gap-1 font-mono text-sm text-slate-700 transition hover:text-slate-900"
                          title={copiedSku === variantSku ? 'Copiado' : 'Copiar SKU'}
                        >
                          <span>{variantSku}</span>
                          <Copy className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
                        </button>
                      </td>
                      <td className="px-4 py-3 align-middle text-sm text-slate-700">{variantEan || '—'}</td>
                      <td className="px-4 py-3 align-middle text-sm text-slate-700">{variantPrice}</td>
                      <td className="px-4 py-3 align-middle text-sm text-slate-700">{variantWeight}</td>
                      <td className="px-4 py-3 align-middle">
                        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${variantStatus.className}`}>
                          <variantStatus.icon className="h-3.5 w-3.5" />
                          {variantStatus.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <button
                          type="button"
                          onClick={() => onNavigateBreadcrumb?.('product', variant.id)}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Abrir
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex min-h-[260px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 text-center">
            <Layers className="h-10 w-10 text-slate-400" />
            <p className="mt-4 text-sm font-medium text-slate-900">Sin acabados registrados</p>
            <button
              type="button"
              onClick={() => onAddVariant?.()}
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-50"
            >
              <Plus className="h-4 w-4" />
            Añadir acabado
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const placeholderPanel = (
    <div className="p-6">
      <PlaceholderPanel />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/55 p-3 sm:p-6" onClick={onClose}>
      <div
        className="mx-auto flex h-full w-full flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.28)]"
        onClick={event => event.stopPropagation()}
      >
        <div className="border-b border-slate-200 bg-white px-5 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <nav className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-slate-500">
              <button
                type="button"
                onClick={() => onNavigateBreadcrumb?.('catalog')}
                className="truncate font-medium text-slate-700 transition hover:text-slate-900"
              >
                Catálogo
              </button>
              <ChevronRight className="h-4 w-4 text-slate-300" />
              <button
                type="button"
                onClick={() => onNavigateBreadcrumb?.('category', categoryIds[0])}
                className="truncate font-medium text-slate-700 transition hover:text-slate-900"
              >
                {primaryCategory || 'Sin categoría'}
              </button>
              {isVariantProduct && parentProduct ? (
                <>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                  <button
                    type="button"
                    onClick={() => onNavigateBreadcrumb?.('product', parentProduct?.id)}
                    className="truncate font-medium text-slate-700 transition hover:text-slate-900"
                  >
                    {parentGroupLabel}
                  </button>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                  <button
                    type="button"
                    onClick={() => setActiveTab('variantes')}
                    className="truncate font-medium text-slate-900 transition hover:text-slate-700"
                  >
                    {variantLabel || productName}
                  </button>
                </>
              ) : (
                <>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                  <button
                    type="button"
                    onClick={() => onNavigateBreadcrumb?.('product', product.id)}
                    className="truncate font-medium text-slate-900 transition hover:text-slate-700"
                  >
                    {productName}
                  </button>
                </>
              )}
            </nav>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onPrev}
                disabled={!onPrev}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Anterior
              </button>
              <button
                type="button"
                onClick={onNext}
                disabled={!onNext}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Siguiente
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  cycleLocale();
                }}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Languages className="h-3.5 w-3.5" />
                {effectiveLocale}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
                aria-label="Cerrar ficha"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="border-b border-slate-200 bg-white px-6 py-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                {isVariantProduct && parentProduct ? (
                  <button
                    type="button"
                    onClick={() => {
                      onNavigateBreadcrumb?.('product', parentProduct.id);
                      setActiveTab('variantes');
                    }}
                    className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--catalog-accent)] transition hover:opacity-80"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Ver todos los acabados
                  </button>
                ) : null}
                <h1 className="max-w-4xl truncate text-lg font-medium tracking-[-0.02em] text-slate-900 sm:text-xl">
                  {productName}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  SKU representativo: <span className="font-medium text-slate-700">{productSku}</span> · ID:{' '}
                  <span className="font-mono text-slate-600">{shortId}</span>
                </p>
              </div>

              <div className="flex flex-col items-start gap-2 sm:items-end">
              {canEditStatus ? (
                <button
                  type="button"
                  onClick={() => {
                    const currentIndex = STATUS_ORDER.indexOf(draft.status);
                    const nextStatus = STATUS_ORDER[(currentIndex + 1) % STATUS_ORDER.length] || 'pending';
                    setDraft(previous => ({ ...previous, status: nextStatus }));
                  }}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${productStatus.className}`}
                >
                  <StatusIcon className="h-3.5 w-3.5" />
                  {productStatus.label}
                </button>
              ) : (
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${productStatus.className}`}>
                  <StatusIcon className="h-3.5 w-3.5" />
                  {productStatus.label}
                </span>
              )}
                <p className="text-xs text-slate-500">
                  Actualizado {lastUpdate || '—'} · {updatedBy}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Completitud</span>
                <div className="h-1 flex-1 rounded-full bg-gray-200">
                  <div className="h-1 rounded-full bg-green-600 transition-all" style={{ width: `${completeness}%` }} />
                </div>
                <span className="text-xs font-medium text-green-700">{completenessLabel}</span>
                {missingFields.length > 0 ? (
                  <span className="text-xs text-red-600">· Falta: {missingFields.join(', ')}</span>
                ) : (
                  <span className="text-xs text-slate-500">• Todo completo</span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: 'contenido', label: 'Contenido' },
                  ...(showVariantsTab ? [{ id: 'variantes', label: 'Variantes', count: variants.length }] : []),
                  { id: 'historial', label: 'Historial' },
                  { id: 'canales', label: 'Canales' },
                ].map(tab => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id as SheetTab)}
                      className={`inline-flex items-center gap-2 border-b-2 px-1.5 py-2 text-sm font-medium transition ${
                        isActive
                          ? 'border-slate-800 text-slate-900'
                          : 'border-transparent text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <span>{tab.label}</span>
                      {typeof tab.count === 'number' ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{tab.count}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (currentImageUrl) window.open(currentImageUrl, '_blank', 'noopener,noreferrer');
                  }}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-50"
                >
                  <Eye className="h-4 w-4" />
                  Vista previa
                </button>
                <button
                  type="button"
                  onClick={exportPayload}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-50"
                >
                  <Download className="h-4 w-4" />
                  Exportar
                </button>
                {canSave ? (
                  <button
                    type="button"
                    onClick={handleSave}
                    className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium text-white transition ${
                      saveState === 'saved' ? 'bg-green-800 hover:bg-green-700' : 'bg-slate-800 hover:bg-slate-700'
                    }`}
                  >
                    <Check className="h-4 w-4" />
                    {saveState === 'saved' ? 'Guardado' : 'Guardar'}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#f3f6fb]">
          {activeTab === 'contenido'
            ? contentPanel
            : activeTab === 'variantes' && showVariantsTab
              ? variantsPanel
              : placeholderPanel}
        </div>
      </div>
    </div>
  );
}
