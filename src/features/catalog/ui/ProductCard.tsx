import React, { useState } from 'react';
import { Package } from 'lucide-react';
import type { Product } from '../api/productService';
import { getPrimaryCategoryLabel } from '../selectors/catalogSelectors';

interface ProductCardProps {
  product: Product;
  tenantId: string;
  categoryLabelMap: Record<string, string>;
  onViewDetails: (product: Product) => void;
}

const fallbackSvg = () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 540" fill="none"><rect width="720" height="540" rx="28" fill="#f5f5f5"/><rect x="170" y="118" width="380" height="226" rx="20" fill="#e5e7eb"/><rect x="206" y="154" width="308" height="154" rx="14" fill="#fafafa"/><path d="M250 252h220" stroke="#cbd5e1" stroke-width="10" stroke-linecap="round"/><path d="M304 214h112" stroke="#cbd5e1" stroke-width="10" stroke-linecap="round"/><circle cx="360" cy="398" r="24" fill="#e2e8f0"/><path d="M348 398h24" stroke="#94a3b8" stroke-width="8" stroke-linecap="round"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

type ProductKind = 'Single' | 'Variant Group' | 'Variant';

function getProductKind(product: Product): ProductKind {
  if (product.variantParentId) return 'Variant';
  if (product.isVariantGroup || (Array.isArray(product.variants) && product.variants.length > 0)) return 'Variant Group';
  return 'Single';
}

const KIND_LABEL: Record<ProductKind, string> = {
  Single: 'Single',
  'Variant Group': 'Variant Group',
  Variant: 'Variant',
};

const KIND_CLASS: Record<ProductKind, string> = {
  Single: 'bg-slate-100 text-slate-600',
  'Variant Group': 'bg-blue-50 text-blue-700 ring-1 ring-blue-100',
  Variant: 'bg-violet-50 text-violet-700 ring-1 ring-violet-100',
};

export const ProductCard = React.memo(function ProductCard({
  product,
  tenantId,
  categoryLabelMap,
  onViewDetails,
}: ProductCardProps) {
  const primaryImage =
    product.images?.find(img => img?.url)?.url ||
    product.thumbnailUrl ||
    (product.previewImageAssetId
      ? `/api/asset?tenant=${encodeURIComponent(tenantId)}&assetId=${encodeURIComponent(product.previewImageAssetId)}`
      : undefined);

  const hasPrimaryImage = Boolean(primaryImage);
  const [imgStatus, setImgStatus] = useState<'loading' | 'ready' | 'empty'>(() =>
    hasPrimaryImage ? 'loading' : 'empty'
  );

  const category = getPrimaryCategoryLabel(product, categoryLabelMap);
  const kind = getProductKind(product);

  return (
    <article
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_14px_30px_rgba(15,23,42,0.09)]"
      role="button"
      tabIndex={0}
      onClick={() => onViewDetails(product)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onViewDetails(product); } }}
    >
      {/* Image */}
      <div className="relative border-b border-slate-100 bg-gradient-to-b from-white to-slate-50/60">
        <div className="flex aspect-[4/3] items-center justify-center p-4">
          {hasPrimaryImage ? (
            <>
              {imgStatus === 'loading' && (
                <div className="absolute inset-0 animate-pulse rounded-t-2xl bg-slate-100" aria-hidden="true" />
              )}
              <img
                src={primaryImage || fallbackSvg()}
                alt={product.name}
                className="relative z-10 max-h-full max-w-full object-contain transition-transform duration-200 group-hover:scale-[1.02]"
                onLoad={() => setImgStatus('ready')}
                onError={e => { setImgStatus('empty'); (e.target as HTMLImageElement).src = fallbackSvg(); }}
                loading="lazy"
              />
            </>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-[#f5f5f5]">
              <Package className="h-9 w-9 text-slate-300" />
              <span className="mt-2 text-xs font-medium text-slate-400">Sin imagen</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* Category */}
        <p className="truncate text-[10.5px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          {category || 'Sin categoría'}
        </p>

        {/* Name */}
        <h3
          title={product.name}
          className="line-clamp-2 flex-1 text-[14px] font-semibold leading-snug tracking-tight text-slate-900"
        >
          {product.name}
        </h3>

        {/* Type badge + button row */}
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] ${KIND_CLASS[kind]}`}>
            {KIND_LABEL[kind]}
          </span>

          <button
            type="button"
            onClick={e => { e.stopPropagation(); onViewDetails(product); }}
            className="inline-flex h-8 items-center justify-center rounded-lg border border-[var(--catalog-accent)] bg-[var(--catalog-accent)] px-3 text-xs font-semibold text-white transition hover:opacity-90"
          >
            Ver detalles
          </button>
        </div>
      </div>
    </article>
  );
});
