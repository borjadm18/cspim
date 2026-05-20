import type { Product } from '../api/productService';
import { cleanText, getPrimaryCategoryLabel, getVariantFinishLabel, getVariantSwatchColor } from '../selectors/catalogSelectors';

interface ProductCardProps {
  product: Product;
  categoryLabelMap: Record<string, string>;
  onViewDetails: (product: Product) => void;
}

const fallbackImage = (title: string) => {
  const safeTitle = title.slice(0, 32);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 540" fill="none">
      <rect width="720" height="540" rx="28" fill="#f8fafc"/>
      <rect x="160" y="120" width="400" height="240" rx="18" fill="#e2e8f0"/>
      <rect x="188" y="148" width="344" height="184" rx="14" fill="#ffffff"/>
      <path d="M236 262h248" stroke="#cbd5e1" stroke-width="10" stroke-linecap="round"/>
      <path d="M310 204h100" stroke="#cbd5e1" stroke-width="10" stroke-linecap="round"/>
      <text x="50%" y="434" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#64748b">${safeTitle}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

export function ProductCard({ product, categoryLabelMap, onViewDetails }: ProductCardProps) {
  const primaryImage = product.images?.[0]?.url;
  const variantCount = Array.isArray((product as any).variants) ? (product as any).variants.length : 0;
  const variantSwatches = Array.isArray((product as any).variants) ? (product as any).variants : [];
  const primaryCategory = getPrimaryCategoryLabel(product, categoryLabelMap);
  const brandOrFamily = cleanText(product.brand).trim() || primaryCategory;
  const visibleSwatches = variantSwatches.length > 6 ? variantSwatches.slice(0, 5) : variantSwatches.slice(0, 6);
  const overflowCount = variantSwatches.length > 6 ? variantSwatches.length - 5 : 0;

  return (
    <article
      className="group overflow-hidden rounded-[18px] border border-slate-200/80 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_36px_rgba(15,23,42,0.08)]"
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
        <div className="flex aspect-[4/3] items-center justify-center p-4">
          <img
            src={primaryImage || fallbackImage(product.name)}
            alt={product.name}
            className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
            onError={(event) => {
              (event.target as HTMLImageElement).src = fallbackImage(product.name);
            }}
            loading="lazy"
          />
        </div>

      </div>

      <div className="space-y-3 p-4">
        {variantSwatches.length > 0 ? (
          <div className="flex items-center gap-1.5">
            {visibleSwatches.map((variant: any, index: number) => {
              const finishLabel = getVariantFinishLabel(variant) || `Acabado ${index + 1}`;
              const swatchColor = getVariantSwatchColor(variant, index);
              return (
                <span
                  key={variant.id || variant.sku || variant.number || index}
                  title={finishLabel}
                  className="inline-flex h-[14px] w-[14px] rounded-full border border-white shadow-sm ring-1 ring-slate-200"
                  style={{ backgroundColor: swatchColor }}
                />
              );
            })}
            {overflowCount > 0 ? (
              <span className="inline-flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-slate-100 px-1 text-[9px] font-semibold leading-none text-slate-600">
                +{overflowCount}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            {brandOrFamily}
          </p>
          <h3 className="line-clamp-2 min-h-[3rem] text-[15px] font-semibold tracking-[-0.025em] text-slate-900">
            {product.name}
          </h3>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
            SKU {product.sku || (product as any).number || 'Sin SKU'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-[10px] border border-[color:var(--catalog-accent-soft)] bg-[color:var(--catalog-accent-soft)]/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--catalog-accent)]">
            {primaryCategory}
          </span>
          <span
            className={`rounded-[10px] border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
              variantCount > 0
                ? 'border-amber-200 bg-amber-50 text-amber-700'
                : 'border-slate-200 bg-slate-50 text-slate-600'
            }`}
          >
            {variantCount > 0 ? 'Grupo de acabados' : 'Sin acabados'}
          </span>
          {variantCount > 1 && (
            <span className="rounded-[10px] border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
              {variantCount} acabados
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onViewDetails(product);
          }}
          className="inline-flex h-10 w-full items-center justify-center rounded-[14px] border border-[var(--catalog-accent)] bg-[var(--catalog-accent)] text-sm font-semibold text-white transition-colors hover:opacity-95"
        >
          Ver detalles
        </button>
      </div>
    </article>
  );
}
