import type { Product } from '../api/productService';

interface ProductTableProps {
  products: Product[];
  tenantId: string;
  categoryLabelMap: Record<string, string>;
  onViewDetails: (product: Product) => void;
}

function getPrimaryCategory(product: Product, categoryLabelMap: Record<string, string>): string {
  const cats = product.categories ?? (product.category ? [product.category] : []);
  if (cats.length === 0) return '—';
  return categoryLabelMap[cats[0]] ?? cats[0];
}

function getTypeBadge(product: Product): { label: string; className: string } {
  if (product.isVariantGroup)
    return { label: 'Variant Group', className: 'bg-violet-100 text-violet-700' };
  if (product.variantParentId)
    return { label: 'Variant', className: 'bg-sky-100 text-sky-700' };
  return { label: 'Single', className: 'bg-slate-100 text-slate-600' };
}

function formatPrice(price: number | undefined, currency: string | undefined): string {
  if (price == null) return '—';
  try {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currency ?? 'EUR',
      minimumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${price}`;
  }
}

export function ProductTable({ products, categoryLabelMap, onViewDetails }: ProductTableProps) {
  return (
    <div className="overflow-x-auto rounded-[20px] border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="sticky top-0 z-10 border-b border-slate-200 bg-white">
            <th scope="col" className="w-14 px-3 py-3" />
            <th scope="col" className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Nombre
            </th>
            <th scope="col" className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              SKU
            </th>
            <th scope="col" className="hidden px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 md:table-cell">
              Categoría
            </th>
            <th scope="col" className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Tipo
            </th>
            <th scope="col" className="hidden px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 lg:table-cell">
              Acabado
            </th>
            <th scope="col" className="hidden px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 lg:table-cell">
              Gama
            </th>
            <th scope="col" className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Precio
            </th>
          </tr>
        </thead>
        <tbody>
          {products.map((product, index) => {
            const thumbUrl =
              product.thumbnailUrl ??
              product.thumbnailDownloadUrl ??
              product.images?.[0]?.url;
            const category = getPrimaryCategory(product, categoryLabelMap);
            const { label: typeLabel, className: typeCls } = getTypeBadge(product);

            return (
              <tr
                key={product.id}
                onClick={() => onViewDetails(product)}
                className={`cursor-pointer border-b border-slate-100 last:border-b-0 transition-colors hover:bg-[color:var(--catalog-accent-soft)]/40 ${
                  index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                }`}
              >
                <td className="px-3 py-2.5">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <svg
                          className="h-5 w-5 text-slate-300"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                </td>
                <td className="max-w-[200px] px-3 py-2.5 xl:max-w-[300px]">
                  <span className="line-clamp-2 font-medium text-slate-900">{product.name}</span>
                </td>
                <td className="px-3 py-2.5">
                  <span className="whitespace-nowrap font-mono text-xs text-slate-600">
                    {product.number ?? product.sku ?? '—'}
                  </span>
                </td>
                <td className="hidden px-3 py-2.5 md:table-cell">
                  <span className="text-slate-600">{category}</span>
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${typeCls}`}
                  >
                    {typeLabel}
                  </span>
                </td>
                <td className="hidden px-3 py-2.5 lg:table-cell">
                  <span className="text-slate-600">{product.finish ?? '—'}</span>
                </td>
                <td className="hidden px-3 py-2.5 lg:table-cell">
                  <span className="text-slate-600">{product.range ?? '—'}</span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="whitespace-nowrap font-medium text-slate-900">
                    {formatPrice(product.price, product.currency)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
