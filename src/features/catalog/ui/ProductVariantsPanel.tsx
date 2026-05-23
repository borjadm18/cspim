import { Copy, ExternalLink, Layers, Plus } from 'lucide-react';
import type { Product } from '../api/productService';
import { cleanText, getVariantFinishLabel, getVariantSwatchColor } from '../selectors/catalogSelectors';
import { formatValue, getProductStatus, STATUS_META } from './productModalUtils';

interface ProductVariantsPanelProps {
  variants: any[];
  activeVariantId: string;
  copiedSku: string;
  onCopySku: (sku: string) => Promise<void>;
  onAddVariant?: () => void;
  onNavigateBreadcrumb?: (segment: 'catalog' | 'category' | 'product', value?: string) => void;
}

export function ProductVariantsPanel({
  variants,
  activeVariantId,
  copiedSku,
  onCopySku,
  onAddVariant,
  onNavigateBreadcrumb,
}: ProductVariantsPanelProps) {
  return (
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
                  {['Acabado', 'SKU', 'EAN', 'Precio (€)', 'Peso (kg)', 'Estado', 'Acciones'].map(header => (
                    <th key={header} className="px-4 pb-2 text-left text-[10px] font-medium uppercase tracking-widest text-gray-400">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {variants.map((variant: any, index: number) => {
                  const variantSku = cleanText(variant.sku || variant.number || variant.id || '?');
                  const finishLabel = getVariantFinishLabel(variant) || `Acabado ${index + 1}`;
                  const finishColor = getVariantSwatchColor(variant, index);
                  const variantEan = cleanText(
                    variant.ean || variant.EAN || variant.attributes?.ean ||
                    variant.attributes?.EAN || variant.attributes?.gtin || ''
                  ).trim();
                  const variantPriceRaw = variant.price ?? variant.attributes?.price ?? variant.attributes?.precio;
                  const variantWeightRaw = variant.weight ?? variant.attributes?.weight ?? variant.attributes?.peso;
                  const variantPrice =
                    variantPriceRaw === null || variantPriceRaw === undefined || String(variantPriceRaw).trim() === ''
                      ? '—' : `${formatValue(variantPriceRaw)} €`;
                  const variantWeight =
                    variantWeightRaw === null || variantWeightRaw === undefined || String(variantWeightRaw).trim() === ''
                      ? '—' : `${formatValue(variantWeightRaw)} Kg`;
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
                          onClick={() => void onCopySku(variantSku)}
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
}
