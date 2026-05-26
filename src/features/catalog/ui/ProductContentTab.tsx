import { AlertCircle, ChevronLeft, ChevronRight, Download, ExternalLink, FileText, Plus } from 'lucide-react';
import type { ProductImage } from '../api/productService';
import { cleanText, getVariantFinishLabel, getVariantSwatchColor } from '../selectors/catalogSelectors';
import {
  fallbackImage,
  formatValue,
  getAttributeFileKind,
  getAttributeFileName,
  getAttributeHref,
  getAttributeLabel,
  normalizeAttachmentName,
  parseBooleanValue,
  resolveFileName,
  triggerDownload,
} from './productModalUtils';

interface ProductContentTabProps {
  productName: string;
  imageSet: ProductImage[];
  currentImageIndex: number;
  setCurrentImageIndex: (idx: number) => void;
  currentImageUrl: string;
  currentImageFileName: string;
  currentImage: ProductImage | undefined;
  onAddImage?: () => void;
  isGroupProduct: boolean;
  variants: any[];
  activeVariantIndex: number;
  setActiveVariantIndex: (idx: number) => void;
  attachments: any[];
  attributes: any[];
  attributeGroups: Array<{ groupName: string; attributes: any[] }>;
  fileAttributes: any[];
}

function renderAttributeValueNode(attr: any) {
  const rawValue = attr?.displayValue ?? attr?.value ?? attr?.values;
  const boolValue = parseBooleanValue(rawValue);
  const textValue = formatValue(rawValue).trim();

  if (boolValue !== undefined) {
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
          boolValue ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
        }`}
      >
        {boolValue ? 'Sí' : 'No'}
      </span>
    );
  }

  if (!textValue) return null;

  if (/^https?:\/\//i.test(textValue)) {
    const href = textValue;
    try {
      const parsed = new URL(href);
      const host = parsed.hostname.replace(/^www\./i, '');
      const lastSegment = parsed.pathname.split('/').filter(Boolean).pop();
      const friendlyLabel = lastSegment
        ? (decodeURIComponent(lastSegment).length > 42
            ? `${host} · ${decodeURIComponent(lastSegment).slice(0, 39)}…`
            : `${host} · ${decodeURIComponent(lastSegment)}`)
        : host;
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[color:var(--catalog-accent-soft)] bg-[color:var(--catalog-accent-soft)] px-3 py-1.5 text-sm font-medium text-[color:var(--catalog-accent-ink)] transition hover:border-[color:var(--catalog-accent)] hover:bg-white"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span className="truncate">{friendlyLabel}</span>
        </a>
      );
    } catch {
      return <p className="text-sm font-medium text-slate-900">{textValue}</p>;
    }
  }

  return <p className="text-sm font-medium text-slate-900">{textValue}</p>;
}

export function ProductContentTab({
  productName,
  imageSet,
  currentImageIndex,
  setCurrentImageIndex,
  currentImageUrl,
  currentImageFileName,
  currentImage,
  onAddImage,
  isGroupProduct,
  variants,
  activeVariantIndex,
  setActiveVariantIndex,
  attachments,
  attributes,
  attributeGroups,
  fileAttributes,
}: ProductContentTabProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Left column: images + documents */}
      <section className="space-y-4 border-r border-slate-200 bg-slate-50 px-5 py-5">
        {/* Images card */}
        <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-gray-400">Imágenes</p>
            <button type="button" onClick={onAddImage} className="text-xs font-medium text-blue-600 transition hover:text-blue-700">
              + Añadir
            </button>
          </div>

          <div className="relative overflow-hidden rounded-[22px] border border-slate-100 bg-slate-50">
            <div className="group/image relative flex min-h-[500px] aspect-[4/3] items-center justify-center bg-gradient-to-b from-white to-slate-50 p-3">
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
                    onClick={() => setCurrentImageIndex((currentImageIndex - 1 + imageSet.length) % imageSet.length)}
                    className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-800 opacity-0 shadow-md transition hover:bg-white group-hover/image:opacity-100"
                    aria-label="Imagen anterior"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentImageIndex((currentImageIndex + 1) % imageSet.length)}
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
              <div className="mt-2 flex items-center gap-3 rounded-sm border border-gray-200 bg-white px-4 py-2.5 text-xs">
                <div className="pr-2 text-[11px] uppercase tracking-wide text-gray-400">Acabado</div>
                <div className="flex items-center gap-2 border-l border-gray-200 pl-3">
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
                              className={`h-8 w-8 rounded-md border-2 border-transparent transition ${
                                isActive ? 'border-[color:var(--catalog-accent)] ring-2 ring-[color:var(--catalog-accent)]' : 'hover:scale-110'
                              }`}
                              style={{ backgroundColor: color || '#C8C8C8' }}
                            />
                          );
                        })}
                        {overflowCount > 0 ? (
                          <span className="rounded-sm bg-gray-100 px-2 py-0.5 text-[11px] text-gray-400">+{overflowCount}</span>
                        ) : null}
                      </>
                    );
                  })()}
                </div>
                <div className="min-w-0 border-l border-gray-200 pl-3 text-sm font-medium text-gray-900">
                  {cleanText(getVariantFinishLabel(variants[activeVariantIndex]) || variants[activeVariantIndex]?.sku || '') || '—'}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Documents card — only shown when attachments exist */}
        {attachments.length > 0 && (
          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
            <div className="mb-4 flex items-center gap-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-gray-400">Documentos</p>
            </div>
            <div className="space-y-3">
              {attachments.map((attachment: any, index: number) => {
                const attachmentName = normalizeAttachmentName(attachment);
                const fileName = resolveFileName(attachment.downloadUrl || attachment.url || '', attachmentName);
                const actionLabel =
                  String(attachment.type || '').toLowerCase().includes('pdf') || fileName.toLowerCase().endsWith('.pdf')
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
          </div>
        )}
      </section>

      {/* Right column: attributes */}
      <section className="space-y-4 bg-white px-5 py-5">
        {/* File attributes — shown first for visibility */}
        {fileAttributes.length > 0 ? (
          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-gray-400">Documentos y archivos</p>
                <p className="mt-1 text-xs text-slate-500">{fileAttributes.length} ficheros vinculados</p>
              </div>
            </div>
            <div className="grid gap-3 xl:grid-cols-2">
              {fileAttributes.map((attr: any, index: number) => {
                const href = getAttributeHref(attr);
                const label = getAttributeLabel(attr);
                const availability = parseBooleanValue(attr?.displayValue ?? attr?.value ?? attr?.values);
                const title = href
                  ? getAttributeFileName(attr, href)
                  : availability === true ? 'Disponible (sin enlace)' : 'Sin enlace';
                const kind = getAttributeFileKind(attr, href);
                const isExternalUrl = kind === 'Enlace';
                const isDownloadable = Boolean(href) && !isExternalUrl;

                if (!href && availability === false) return null;

                return (
                  <div
                    key={attr.definitionId || attr.name || `${label}-${index}`}
                    className="flex h-full min-h-[112px] flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-[color:var(--catalog-accent)]/30 hover:bg-white"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--catalog-accent-soft)] text-[color:var(--catalog-accent)]">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-slate-900">{label}</p>
                          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            {kind}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-500">{title}</p>
                      </div>
                    </div>
                    {href ? (
                      <div className="mt-3 flex items-center gap-2">
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 transition hover:bg-slate-50"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Abrir
                        </a>
                        {isDownloadable ? (
                          <button
                            type="button"
                            onClick={() => void triggerDownload(href, title)}
                            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 transition hover:bg-slate-50"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Descargar
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <span className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {title}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Bluestone attributes */}
        <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-gray-400">Atributos de Bluestone</p>
              <p className="mt-1 text-xs text-slate-500">
                {attributes.length} atributos con valor · {attributeGroups.length} grupos
              </p>
            </div>
          </div>
          {attributeGroups.length > 0 ? (
            <div className="space-y-4">
              {attributeGroups.map(group => (
                <div key={group.groupName} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
                    <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-gray-400">{group.groupName}</p>
                    <span className="text-xs text-slate-400">{group.attributes.length}</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {group.attributes.map((attr: any) => (
                      <div
                        key={attr.definitionId || attr.name || `${group.groupName}-${attr.label || attr.definitionName || 'attribute'}`}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
                      >
                        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
                          {attr.label || attr.definitionName || attr.name || 'Atributo'}
                        </p>
                        <div className="mt-2 min-h-[22px]">
                          {renderAttributeValueNode(attr) || <span className="text-sm text-slate-400">—</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[160px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
              No hay atributos con valor en este producto
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
