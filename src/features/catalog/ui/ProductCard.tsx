import React, { useState } from 'react';
import { Package, Paperclip } from 'lucide-react';
import type { Product } from '../api/productService';
import { cleanText, getPrimaryCategoryLabel, getVariantFinishLabel, getVariantSwatchColor } from '../selectors/catalogSelectors';

interface ProductCardProps {
  product: Product;
  tenantId: string;
  categoryLabelMap: Record<string, string>;
  onViewDetails: (product: Product) => void;
}

const fallbackImage = () => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 540" fill="none">
      <rect width="720" height="540" rx="28" fill="#f5f5f5"/>
      <rect x="170" y="118" width="380" height="226" rx="20" fill="#e5e7eb"/>
      <rect x="206" y="154" width="308" height="154" rx="14" fill="#fafafa"/>
      <path d="M250 252h220" stroke="#cbd5e1" stroke-width="10" stroke-linecap="round"/>
      <path d="M304 214h112" stroke="#cbd5e1" stroke-width="10" stroke-linecap="round"/>
      <circle cx="360" cy="398" r="24" fill="#e2e8f0"/>
      <path d="M348 398h24" stroke="#94a3b8" stroke-width="8" stroke-linecap="round"/>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

export const ProductCard = React.memo(function ProductCard({ product, tenantId, categoryLabelMap, onViewDetails }: ProductCardProps) {
  const primaryImage =
    product.images?.find(image => image?.url)?.url ||
    (product.previewImageAssetId
      ? `/api/asset?tenant=${encodeURIComponent(tenantId)}&assetId=${encodeURIComponent(product.previewImageAssetId)}`
      : undefined);
  const hasPrimaryImage = Boolean(primaryImage);
  // Derive initial state from props synchronously — avoids a double-render useEffect
  const [imageStatus, setImageStatus] = useState<'loading' | 'ready' | 'empty'>(
    () => hasPrimaryImage ? 'loading' : 'empty'
  );
  const variantCount = product.variants?.length ?? 0;
  const variantSwatches = product.variants ?? [];
  const primaryCategory = getPrimaryCategoryLabel(product, categoryLabelMap);
  const brandOrFamily = cleanText(product.brand).trim() || primaryCategory;
  const visibleSwatches = variantSwatches.length > 6 ? variantSwatches.slice(0, 5) : variantSwatches.slice(0, 6);
  const overflowCount = variantSwatches.length > 6 ? variantSwatches.length - 5 : 0;
  const hasDocuments = ((product as any).attachments?.length ?? 0) > 0;

  return (
    <article
      className="group relative flex h-[34rem] flex-col overflow-hidden rounded-[18px] border border-slate-200/80 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_36px_rgba(15,23,42,0.08)]"
      role="button"
      tabIndex={0}
      onClick={() => onViewDetails(product)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onViewDetails(product);
        }
      }}
      >
      <div className="relative border-b border-slate-100 bg-gradient-to-b from-white to-slate-50/70">
        {hasDocuments && (
          <div className="absolute left-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white/90 shadow-sm" title="Tiene documentos adjuntos">
            <Paperclip className="h-3 w-3 text-slate-500" />
          </div>
        )}
        <div className="flex aspect-[4/3] items-center justify-center p-4">
          {hasPrimaryImage ? (
            <>
              {imageStatus === 'loading' ? (
                <div className="absolute inset-0 animate-pulse bg-slate-100" aria-hidden="true" />
              ) : null}
              <img
                src={primaryImage || fallbackImage()}
                alt={product.name}
                className="relative z-10 max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                onLoad={() => setImageStatus('ready')}
                onError={event => {
                  setImageStatus('empty');
                  (event.target as HTMLImageElement).src = fallbackImage();
                }}
                loading="lazy"
              />
            </>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center rounded-[22px] border border-dashed border-slate-200 bg-[#f5f5f5] text-center">
              <Package className="h-10 w-10 text-slate-400" />
              <span className="mt-3 text-sm font-medium text-slate-500">Sin imagen</span>
              <span className="mt-1 text-xs text-slate-400">A la espera de un archivo principal</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col space-y-3 p-4 pb-20">
        {variantSwatches.length > 0 ? (
          <div className="flex items-center gap-1.5">
            {visibleSwatches.map((variant: any, index: number) => {
              const finishLabel = getVariantFinishLabel(variant) || `Acabado ${index + 1}`;
              const swatchColor = getVariantSwatchColor(variant, index);
              return (
                <span
                  key={variant.id || variant.sku || variant.number || index}
                  title={finishLabel}
                  className="inline-flex h-5 w-5 rounded-full border border-white shadow-sm ring-1 ring-slate-200"
                  style={{ backgroundColor: swatchColor }}
                />
              );
            })}
            {overflowCount > 0 ? (
              <span
                className="inline-flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-slate-100 px-1 text-[9px] font-semibold leading-none text-slate-600"
                title={variantSwatches.slice(5).map((v: any, i: number) => getVariantFinishLabel(v) || `Acabado ${i + 6}`).join(', ')}
              >
                +{overflowCount}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            {brandOrFamily}
          </p>
          <h3 title={product.name} className="line-clamp-2 min-h-[3rem] text-[15px] font-semibold tracking-[-0.025em] text-slate-900">
            {product.name}
          </h3>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
            SKU {product.sku || product.number || 'Sin SKU'}
          </p>
        </div>

        <div className="flex min-h-[2.75rem] flex-wrap gap-2">
          <span className="rounded-[4px] border border-[color:var(--catalog-accent-soft)] bg-[color:var(--catalog-accent-soft)]/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--catalog-accent)]">
            {primaryCategory}
          </span>
          {variantCount > 1 && (
            <span className="rounded-[4px] border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
              {variantCount} acabados
            </span>
          )}
        </div>

        <div className="mt-auto pt-4">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onViewDetails(product);
            }}
            className="inline-flex h-10 w-auto items-center justify-center rounded-[4px] border border-[var(--catalog-accent)] bg-[var(--catalog-accent)] px-4 text-sm font-semibold text-white transition-colors hover:opacity-95"
          >
            Ver detalles
          </button>
        </div>
      </div>
    </article>
  );
});
