import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  Languages,
  X,
} from 'lucide-react';
import type { Product, ProductImage } from '../api/productService';
import { cleanText, getPrimaryCategoryLabel, getVariantFinishLabel } from '../selectors/catalogSelectors';
import { ProductContentTab } from './ProductContentTab';
import { ProductVariantsPanel } from './ProductVariantsPanel';
import { useConfirm } from '../../../shared/ui/ConfirmDialog';
import {
  DEFAULT_LOCALES,
  TECHNICAL_IMAGE_KEYWORDS,
  STATUS_META,
  STATUS_ORDER,
  buildAttributeLookup,
  extractTextValue,
  fallbackImage,
  firstAvailableBoolean,
  firstAvailableNumber,
  firstAvailableText,
  formatDate,
  getProductStatus,
  isFileLikeAttribute,
  isRenderableValue,
  normalizeKey,
  normalizeText,
} from './productModalUtils';

type SheetTab = 'contenido' | 'variantes';
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
  onAddVariant?: () => void;
  onNavigateBreadcrumb?: (segment: 'catalog' | 'category' | 'product', value?: string) => void;
  catalogProducts?: Product[];
  parentProduct?: Product | null;
  currentUserRole?: 'admin' | 'content_manager' | 'commercial';
  onDirtyChange?: (isDirty: boolean) => void;
  tenantId?: string;
}

const scoreCatalogImage = (image: ProductImage) => {
  const descriptor = normalizeKey([image.alt, image.downloadUrl, image.url].filter(Boolean).join(' '));
  let score = 0;
  for (const keyword of ['foto', 'photo', 'principal', 'main', 'hero', 'producto', 'product', 'real', 'realista', 'lifestyle', 'render']) {
    if (descriptor.includes(keyword)) score += 120;
  }
  for (const keyword of TECHNICAL_IMAGE_KEYWORDS) {
    if (descriptor.includes(keyword)) score -= 500;
  }
  if (image.isPrimary) score += 160;
  if (/\.(jpe?g|png|webp)(\?|$)/i.test(descriptor)) score += 8;
  if (!image.alt || cleanText(image.alt).trim() === 'Imagen') score -= 12;
  return score;
};

const sortCatalogImages = (items: ProductImage[]) =>
  [...items].filter(Boolean).sort((a, b) => scoreCatalogImage(b) - scoreCatalogImage(a));

export function ProductModal({
  product,
  categoryLabelMap,
  onClose,
  onPrev,
  onNext,
  onLocaleChange,
  activeLocale,
  locales = DEFAULT_LOCALES,
  onSave: _onSave,
  onAddImage,
  onAddVariant,
  onNavigateBreadcrumb,
  catalogProducts: _catalogProducts,
  parentProduct,
  currentUserRole = 'admin',
  onDirtyChange,
  tenantId,
}: ProductModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [activeVariantIndex, setActiveVariantIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<SheetTab>('contenido');
  const [localLocale, setLocalLocale] = useState<LocaleCode>('ES');
  const [copiedSku, setCopiedSku] = useState('');
  const confirm = useConfirm();
  const hasUnsavedChangesRef = useRef(false);
  const onPrevRef = useRef(onPrev);
  const onNextRef = useRef(onNext);
  const onCloseRef = useRef(onClose);

  const canEditVisibility = currentUserRole === 'admin' || currentUserRole === 'content_manager';
  const canEditStatus = canEditVisibility;
  const isVariantProduct = normalizeKey(product.type) === 'variant';
  const isGroupProduct = normalizeKey(product.type) === 'group' || Boolean((product as any).isVariantGroup);
  const variantSourceProduct = parentProduct && parentProduct.id !== product.id ? parentProduct : product;
  const variantRows = useMemo(
    () => (Array.isArray((variantSourceProduct as any).variants) ? (variantSourceProduct as any).variants : []),
    [variantSourceProduct]
  );
  const showVariantsTab = normalizeKey(product.type) === 'group' || isVariantProduct || Boolean((product as any).isVariantGroup);

  const images = useMemo(() => sortCatalogImages(product.images || []), [product.images]);
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
  const variantLabel = isVariantProduct ? getVariantFinishLabel(product) : '';
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

  const fileAttributes = useMemo(() => attributes.filter((attr: any) => isFileLikeAttribute(attr)), [attributes]);
  const attributeLookup = useMemo(() => buildAttributeLookup(attributes), [attributes]);
  const attributeGroups = useMemo(() => {
    const groups = new Map<string, any[]>();
    for (const attribute of attributes as any[]) {
      if (isFileLikeAttribute(attribute)) continue;
      const value = attribute?.displayValue ?? attribute?.value ?? attribute?.values;
      if (!isRenderableValue(value)) continue;
      const groupName = normalizeText(attribute.group || attribute.groupName || '').trim() || 'Sin grupo';
      const label = normalizeText(attribute.definitionName || attribute.name || attribute.label || attribute.definitionId || 'Atributo');
      if (!groups.has(groupName)) groups.set(groupName, []);
      groups.get(groupName)!.push({ ...attribute, label, group: groupName });
    }
    return Array.from(groups.entries()).map(([groupName, groupAttributes]) => ({ groupName, attributes: groupAttributes }));
  }, [attributes]);

  const attributeSnapshot = useMemo(() => {
    const ean = firstAvailableText(product, attributeLookup, ['ean', 'EAN', 'codigoEAN', 'codigoEan', 'gtin', 'código ean', 'codigo ean'], ['ean', 'EAN', 'codigoEAN', 'codigoEan', 'gtin', 'código ean', 'codigo ean']);
    const baseRef = firstAvailableText(product, attributeLookup, ['baseRef', 'referenciaBaseAcabado', 'referencia base acabado', 'reference', 'ref'], ['referenciaBaseAcabado', 'referencia base acabado', 'base ref', 'referencia', 'ref']);
    const visibleOnWeb = firstAvailableBoolean(product, attributeLookup, ['visibleOnWeb', 'isWebVisible', 'webVisible', 'estaWeb', 'visible en web', 'esta web'], ['visibleOnWeb', 'isWebVisible', 'webVisible', 'estaWeb', 'visible en web', 'esta web']);
    const price = firstAvailableNumber(product, attributeLookup, ['price', 'precio', 'pvp'], ['price', 'precio', 'pvp']);
    const weight = firstAvailableText(product, attributeLookup, ['weight', 'peso', 'peso (kg)'], ['weight', 'peso', 'peso (kg)']);
    const collection = firstAvailableText(product, attributeLookup, ['collection', 'coleccion', 'colección'], ['collection', 'coleccion', 'colección']);
    const range = firstAvailableText(product, attributeLookup, ['range', 'gama'], ['range', 'gama']);
    const technicalSheet = attachments.find((attachment: any) => /pdf|ficha|technical|tecnica|técnica/i.test(cleanText(attachment.name || attachment.fileName || 'Documento')) || /pdf/i.test(String(attachment.type || '')));
    return { ean, baseRef, visibleOnWeb, price, weight, collection, range, technicalSheet };
  }, [attributeLookup, attachments, product]);

  const initialDraft = useMemo(
    () => ({
      description: productDescription,
      ean: attributeSnapshot.ean,
      baseRef: attributeSnapshot.baseRef,
      visibleOnWeb: attributeSnapshot.visibleOnWeb,
      price: attributeSnapshot.price !== undefined ? String(attributeSnapshot.price) : '',
      weight: attributeSnapshot.weight,
      collection: attributeSnapshot.collection,
      range: attributeSnapshot.range,
      status: getProductStatus(product),
    }),
    [attributeSnapshot, product, productDescription]
  );

  const [draft, setDraft] = useState(() => initialDraft);
  const [confirmedDraft, setConfirmedDraft] = useState(() => initialDraft);

  useEffect(() => {
    setCurrentImageIndex(0);
    setActiveVariantIndex(0);
    setActiveTab('contenido');
    setDraft(initialDraft);
    setConfirmedDraft(initialDraft);
  }, [initialDraft, product.id]);

  useEffect(() => {
    if (!variantRows.length) { setActiveVariantIndex(0); return; }
    const matchedIndex = variantRows.findIndex((variant: any) => variant.id === product.id);
    setActiveVariantIndex(matchedIndex >= 0 ? matchedIndex : 0);
  }, [product.id, variantRows]);

  const activeVariant = variants[activeVariantIndex];
  const variantImages = Array.isArray(activeVariant?.images) ? sortCatalogImages(activeVariant.images as ProductImage[]) : [];
  const variantPreviewUrl =
    !variantImages.length && activeVariant && (activeVariant as any).previewImageAssetId && tenantId
      ? `/api/asset?tenant=${encodeURIComponent(tenantId)}&assetId=${encodeURIComponent((activeVariant as any).previewImageAssetId)}`
      : undefined;
  const imageSet = variantImages.length ? variantImages : images;
  const currentImage = imageSet[currentImageIndex] || imageSet[0] || images[0];
  const currentImageUrl = variantPreviewUrl || currentImage?.url || fallbackImage(productName);
  const currentImageFileName = currentImage?.alt || `${productName || 'imagen'}.jpg`;
  const lastUpdate = formatDate((product as any).lastUpdate || (product as any).updatedAt || (product as any).createDate);
  const updatedBy = cleanText((product as any).updatedBy || (product as any).lastUpdatedBy || (product as any).authorEmail || '—');
  const productId = cleanText(product.id);
  const shortId = productId.slice(0, 8) + (productId.length > 8 ? '…' : '');
  const productStatus = STATUS_META[draft.status as ProductStatus];

  const hasUnsavedChanges = useMemo(
    () =>
      draft.description !== confirmedDraft.description ||
      draft.ean !== confirmedDraft.ean ||
      draft.baseRef !== confirmedDraft.baseRef ||
      draft.visibleOnWeb !== confirmedDraft.visibleOnWeb ||
      draft.price !== confirmedDraft.price ||
      draft.weight !== confirmedDraft.weight ||
      draft.collection !== confirmedDraft.collection ||
      draft.range !== confirmedDraft.range ||
      draft.status !== confirmedDraft.status,
    [draft, confirmedDraft]
  );

  const confirmDiscardChanges = async (action: () => void) => {
    if (hasUnsavedChanges) {
      const ok = await confirm({ message: '¿Descartar los cambios? Los datos no guardados se perderán.', confirmLabel: 'Descartar', danger: true });
      if (!ok) return;
    }
    action();
  };

  useEffect(() => { hasUnsavedChangesRef.current = hasUnsavedChanges; }, [hasUnsavedChanges]);
  useEffect(() => { onPrevRef.current = onPrev; onNextRef.current = onNext; onCloseRef.current = onClose; });
  useEffect(() => { onDirtyChange?.(hasUnsavedChanges); }, [hasUnsavedChanges, onDirtyChange]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
      const confirmAndRun = async (action: (() => void) | undefined) => {
        if (!action) return;
        if (hasUnsavedChangesRef.current) {
          const ok = await confirm({ message: '¿Descartar los cambios? Los datos no guardados se perderán.', confirmLabel: 'Descartar', danger: true });
          if (!ok) return;
        }
        action();
      };
      if (event.key === 'ArrowLeft') { void confirmAndRun(onPrevRef.current); return; }
      if (event.key === 'ArrowRight') { void confirmAndRun(onNextRef.current); return; }
      if (event.key === 'Escape') { void confirmAndRun(onCloseRef.current); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []); // stable — all values accessed via refs

  const copySkuToClipboard = async (sku: string) => {
    try {
      await navigator.clipboard.writeText(sku);
      setCopiedSku(sku);
      window.setTimeout(() => setCopiedSku(''), 1200);
    } catch {
      // Clipboard API unavailable in this context — fail silently
    }
  };

  const cycleLocale = () => {
    const currentIndex = locales.findIndex(locale => locale.toUpperCase() === effectiveLocale);
    const nextLocale = locales[(currentIndex + 1) % locales.length] || locales[0] || 'ES';
    if (!activeLocale) setLocalLocale(nextLocale as LocaleCode);
    onLocaleChange?.(nextLocale);
  };

  const StatusIcon = productStatus.icon;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/55 p-3 sm:p-6" onClick={onClose}>
      <div
        className="mx-auto flex h-full w-full flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.28)]"
        onClick={event => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-modal-title"
      >
        {/* Header: breadcrumb + navigation */}
        <div className="border-b border-slate-200 bg-white px-5 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <nav className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-slate-500">
              <button type="button" onClick={() => onNavigateBreadcrumb?.('catalog')} className="truncate font-medium text-slate-700 transition hover:text-slate-900">
                Catálogo
              </button>
              <ChevronRight className="h-4 w-4 text-slate-300" />
              <button type="button" onClick={() => onNavigateBreadcrumb?.('category', categoryIds[0])} className="truncate font-medium text-slate-700 transition hover:text-slate-900">
                {primaryCategory || 'Sin categoría'}
              </button>
              {isVariantProduct && parentProduct ? (
                <>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                  <button type="button" onClick={() => onNavigateBreadcrumb?.('product', parentProduct?.id)} className="truncate font-medium text-slate-700 transition hover:text-slate-900">
                    {parentGroupLabel}
                  </button>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                  <button type="button" onClick={() => setActiveTab('variantes')} className="truncate font-medium text-slate-900 transition hover:text-slate-700">
                    {variantLabel || productName}
                  </button>
                </>
              ) : (
                <>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                  <button type="button" onClick={() => confirmDiscardChanges(() => onNavigateBreadcrumb?.('product', product.id))} className="truncate font-medium text-slate-900 transition hover:text-slate-700" title={productName}>
                    {productName}
                  </button>
                </>
              )}
            </nav>
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => { if (onPrev) confirmDiscardChanges(onPrev); }} disabled={!onPrev} aria-label="Producto anterior" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                <ChevronLeft className="h-3.5 w-3.5" />
                Anterior
              </button>
              <button type="button" onClick={() => { if (onNext) confirmDiscardChanges(onNext); }} disabled={!onNext} aria-label="Producto siguiente" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                Siguiente
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={cycleLocale} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                <Languages className="h-3.5 w-3.5" />
                {effectiveLocale}
              </button>
              <button type="button" onClick={() => confirmDiscardChanges(onClose)} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white p-2 text-slate-700 transition hover:bg-slate-50" aria-label="Cerrar ficha">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Subheader: product info + tabs + toolbar */}
        <div className="border-b border-slate-200 bg-white px-6 py-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                {isVariantProduct && parentProduct ? (
                  <button
                    type="button"
                    onClick={() => confirmDiscardChanges(() => { onNavigateBreadcrumb?.('product', parentProduct.id); setActiveTab('variantes'); })}
                    className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--catalog-accent)] transition hover:opacity-80"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Ver todos los acabados
                  </button>
                ) : null}
                <h1 id="product-modal-title" title={productName} className="max-w-4xl line-clamp-2 text-lg font-medium leading-tight tracking-[-0.02em] text-slate-900 sm:text-xl">
                  {productName}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  SKU representativo: <span className="font-medium text-slate-700">{productSku}</span> · ID:
                  <button type="button" onClick={() => void navigator.clipboard.writeText(productId)} className="ml-1 inline-flex items-center gap-1 font-mono text-slate-600 transition hover:text-slate-900" title={productId}>
                    {shortId}
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </p>
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                {canEditStatus ? (
                  <button
                    type="button"
                    onClick={() => {
                      const currentIndex = STATUS_ORDER.indexOf(draft.status as ProductStatus);
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
                <p className="text-xs text-slate-500">Actualizado {lastUpdate || '—'} · {updatedBy}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: 'contenido', label: 'Contenido' },
                  ...(showVariantsTab ? [{ id: 'variantes', label: 'Variantes', count: variants.length }] : []),
                ].map(tab => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id as SheetTab)}
                      className={`inline-flex items-center gap-2 border-b-2 px-1.5 py-2 text-sm font-medium transition ${isActive ? 'border-slate-800 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
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
                <button type="button" onClick={() => { if (currentImageUrl) window.open(currentImageUrl, '_blank', 'noopener,noreferrer'); }} className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-50">
                  <Eye className="h-4 w-4" />
                  Ver imagen principal
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto bg-[#f3f6fb]">
          {activeTab === 'contenido' ? (
            <ProductContentTab
              productName={productName}
              imageSet={imageSet}
              currentImageIndex={currentImageIndex}
              setCurrentImageIndex={setCurrentImageIndex}
              currentImageUrl={currentImageUrl}
              currentImageFileName={currentImageFileName}
              currentImage={currentImage}
              onAddImage={onAddImage}
              isGroupProduct={isGroupProduct}
              variants={variants}
              activeVariantIndex={activeVariantIndex}
              setActiveVariantIndex={setActiveVariantIndex}
              attachments={attachments}
              attributes={attributes}
              attributeGroups={attributeGroups}
              fileAttributes={fileAttributes}
            />
          ) : activeTab === 'variantes' && showVariantsTab ? (
            <ProductVariantsPanel
              variants={variants}
              activeVariantId={activeVariantId}
              copiedSku={copiedSku}
              onCopySku={copySkuToClipboard}
              onAddVariant={onAddVariant}
              onNavigateBreadcrumb={onNavigateBreadcrumb}
            />
          ) : (
            <div className="p-6">
              <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                Sección en desarrollo
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
