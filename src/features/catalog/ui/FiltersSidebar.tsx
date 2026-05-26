import { ChevronDown, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Product } from '../api/productService';
import type { BrandOption, CategoryTreeNode, FacetOption, MediaFilter, PriceRange, StatusOption, TypeOption } from '../model/catalogTypes';
import { cleanText } from '../selectors/catalogSelectors';

interface FiltersSidebarProps {
  products: Product[];
  summaryProductsCount?: number;
  summaryWithImagesCount?: number;
  brandOptions: BrandOption[];
  rangeOptions: FacetOption[];
  flowOptions: FacetOption[];
  finishOptions: FacetOption[];
  priceRange: PriceRange;
  selectedBrand: string;
  onBrandChange: (brand: string) => void;
  categoryTree: CategoryTreeNode[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  typeOptions: TypeOption[];
  selectedType: string;
  onTypeChange: (type: string) => void;
  statusOptions: StatusOption[];
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  selectedMediaFilter: MediaFilter;
  onMediaFilterChange: (filter: MediaFilter) => void;
  selectedQuickFilter: string;
  selectedName: string;
  onNameChange: (value: string) => void;
  selectedNumber: string;
  onNumberChange: (value: string) => void;
  selectedCollection: string;
  onCollectionChange: (value: string) => void;
  selectedRange: string;
  onRangeChange: (value: string) => void;
  selectedPriceMin: string;
  onPriceMinChange: (value: string) => void;
  selectedPriceMax: string;
  onPriceMaxChange: (value: string) => void;
  selectedEan: string;
  onEanChange: (value: string) => void;
  selectedFlow: string;
  onFlowChange: (value: string) => void;
  selectedFinish: string;
  onFinishChange: (value: string) => void;
  selectedAttributeQuery: string;
  onAttributeQueryChange: (value: string) => void;
  onClearFilters: () => void;
}

type CategoryItem = {
  id: string;
  label: string;
  path: string;
  count: number;
};

const TYPE_TILES = [
  { id: 'single', label: 'Simple' },
  { id: 'variant', label: 'Con acabados' },
  { id: 'bundle', label: 'Bundle' },
];

const STATUS_TILES = [
  { id: 'draft', label: 'Borrador' },
  { id: 'to-be-published', label: 'Por publicar' },
  { id: 'published', label: 'Publicado' },
  { id: 'archived', label: 'Archivado' },
];

const formatPriceValue = (value: number) =>
  new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: 0,
  }).format(Math.round(value));

const flattenTree = (nodes: CategoryTreeNode[], ancestors: string[] = []): CategoryItem[] =>
  nodes.flatMap(node => {
    const label = cleanText(node.label);
    const path = [...ancestors, label];
    const current = {
      id: node.id,
      label,
      path: cleanText(path.join(' / ')),
      count: node.count,
    };

    return [current, ...flattenTree(node.children, path)];
  });

const matchScore = (item: CategoryItem, term: string) => {
  if (!term) return item.count;
  const label = item.label.toLowerCase();
  const path = item.path.toLowerCase();
  if (label === term || path === term) return 1000 + item.count;
  if (label.startsWith(term) || path.startsWith(term)) return 500 + item.count;
  if (label.includes(term) || path.includes(term)) return 100 + item.count;
  return 0;
};

const FilterTile = ({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex min-h-[4.1rem] flex-col items-start justify-between rounded-2xl border px-3 py-3 text-left transition ${
      active
        ? 'border-[color:var(--catalog-accent)]/35 bg-[color:var(--catalog-accent-soft)]/80 text-[color:var(--catalog-accent)] shadow-[0_8px_22px_rgba(20,61,107,0.08)]'
        : 'border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300 hover:bg-white'
    }`}
  >
    <span className="text-sm font-medium">{label}</span>
    <span
      className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${active ? 'text-[color:var(--catalog-accent)]/80' : 'text-slate-500'}`}
    >
      {count}
    </span>
  </button>
);

export function FiltersSidebar({
  products = [],
  summaryProductsCount,
  summaryWithImagesCount,
  brandOptions = [],
  rangeOptions = [],
  flowOptions = [],
  finishOptions = [],
  priceRange,
  selectedBrand,
  onBrandChange,
  categoryTree = [],
  selectedCategory,
  onCategoryChange,
  typeOptions = [],
  selectedType,
  onTypeChange,
  statusOptions = [],
  selectedStatus,
  onStatusChange,
  selectedMediaFilter,
  onMediaFilterChange,
  selectedQuickFilter,
  selectedName,
  onNameChange,
  selectedNumber,
  onNumberChange,
  selectedCollection,
  onCollectionChange,
  selectedRange,
  onRangeChange,
  selectedPriceMin,
  onPriceMinChange,
  selectedPriceMax,
  onPriceMaxChange,
  selectedEan,
  onEanChange,
  selectedFlow,
  onFlowChange,
  selectedFinish,
  onFinishChange,
  selectedAttributeQuery,
  onAttributeQueryChange,
  onClearFilters,
}: FiltersSidebarProps) {
  const hasBrands = brandOptions.length > 0;
  const hasRangeOptions = rangeOptions.length > 0;
  const hasFlowOptions = flowOptions.length > 0;
  const hasFinishOptions = finishOptions.length > 0;
  const [categoryQuery, setCategoryQuery] = useState('');
  const [showAllCategories, setShowAllCategories] = useState(false);

  const categories = useMemo(() => flattenTree(categoryTree), [categoryTree]);
  const categoryMap = useMemo(() => Object.fromEntries(categories.map(item => [item.id, item.path])), [categories]);
  const selectedCategoryLabel = selectedCategory === 'all' ? null : cleanText(categoryMap[selectedCategory] || selectedCategory);

  const visibleCategories = useMemo(() => {
    const term = categoryQuery.trim().toLowerCase();
    const source = term
      ? categories.filter(item => item.label.toLowerCase().includes(term) || item.path.toLowerCase().includes(term))
      : categories.filter(item => item.count > 0);

    return [...source]
      .sort((a, b) => matchScore(b, term) - matchScore(a, term) || b.count - a.count || a.path.localeCompare(b.path, 'es'))
      .slice(0, term ? 12 : showAllCategories ? 32 : 8);
  }, [categoryQuery, categories, showAllCategories]);

  const featuredCategories = useMemo(
    () =>
      categories
        .filter(item => item.count > 0)
        .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path, 'es'))
        .slice(0, 6),
    [categories]
  );

  const typeLookup = useMemo(() => Object.fromEntries(typeOptions.map(option => [option.id, option])), [typeOptions]);
  const statusLookup = useMemo(() => Object.fromEntries(statusOptions.map(option => [option.id, option])), [statusOptions]);
  const sliderMin = Number.isFinite(priceRange?.min) ? priceRange.min : 0;
  const sliderMax = Number.isFinite(priceRange?.max) ? priceRange.max : 0;
  const hasPriceRange = sliderMax > sliderMin;
  const selectedPriceMinNumber = selectedPriceMin.trim() ? Number(selectedPriceMin.replace(',', '.')) : sliderMin;
  const selectedPriceMaxNumber = selectedPriceMax.trim() ? Number(selectedPriceMax.replace(',', '.')) : sliderMax;
  const safePriceMin = Number.isFinite(selectedPriceMinNumber) ? Math.max(sliderMin, Math.min(selectedPriceMinNumber, selectedPriceMaxNumber || sliderMax)) : sliderMin;
  const safePriceMax = Number.isFinite(selectedPriceMaxNumber) ? Math.min(sliderMax, Math.max(selectedPriceMaxNumber, selectedPriceMinNumber || sliderMin)) : sliderMax;
  const sliderRange = Math.max(sliderMax - sliderMin, 1);
  const leftPercent = ((safePriceMin - sliderMin) / sliderRange) * 100;
  const rightPercent = ((safePriceMax - sliderMin) / sliderRange) * 100;
  const activeTrackWidth = Math.max(rightPercent - leftPercent, 0);
  const activeFilterCount = [
    selectedName.trim(),
    selectedNumber.trim(),
    selectedCollection.trim(),
    selectedRange.trim(),
    selectedPriceMin.trim(),
    selectedPriceMax.trim(),
    selectedEan.trim(),
    selectedFlow.trim(),
    selectedFinish.trim(),
    selectedAttributeQuery.trim(),
    selectedBrand !== 'all',
    selectedCategory !== 'all',
    selectedType !== 'all',
    selectedStatus !== 'all',
    selectedMediaFilter !== 'all',
    selectedQuickFilter !== 'all',
  ].filter(Boolean).length;

  return (
    <div className="sticky top-24 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-700">Filtros</h2>
            {activeFilterCount > 0 ? (
              <span className="rounded-full bg-[color:var(--catalog-accent-soft)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--catalog-accent)]">
                {activeFilterCount} activos
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-slate-500">Acota por nombre, número, tipo, estado y más.</p>
        </div>
        <button
          onClick={onClearFilters}
          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 transition hover:bg-slate-100"
        >
          Limpiar
        </button>
      </div>

      <div className="space-y-5 p-5">
        <section className="space-y-3">
          <div className="space-y-2">
            <label htmlFor="name-filter" className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Nombre
            </label>
            <input
              id="name-filter"
              type="text"
              value={selectedName}
              onChange={event => onNameChange(event.target.value)}
              placeholder="Filtrar por nombre..."
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[color:var(--catalog-accent)] focus:ring-4 focus:ring-[color:var(--catalog-accent-soft)]/60"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="number-filter" className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              SKU
            </label>
            <input
              id="number-filter"
              type="text"
              value={selectedNumber}
              onChange={event => onNumberChange(event.target.value)}
              placeholder="Filtrar por SKU..."
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[color:var(--catalog-accent)] focus:ring-4 focus:ring-[color:var(--catalog-accent-soft)]/60"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="collection-filter" className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Colección
            </label>
            <input
              id="collection-filter"
              type="text"
              value={selectedCollection}
              onChange={event => onCollectionChange(event.target.value)}
              placeholder="Filtrar por colección..."
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[color:var(--catalog-accent)] focus:ring-4 focus:ring-[color:var(--catalog-accent-soft)]/60"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="range-filter" className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Gama
            </label>
            <select
              id="range-filter"
              value={selectedRange}
              onChange={event => onRangeChange(event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[color:var(--catalog-accent)] focus:ring-4 focus:ring-[color:var(--catalog-accent-soft)]/60"
              disabled={!hasRangeOptions}
            >
              <option value="">{hasRangeOptions ? 'Todas las gamas' : 'Sin gamas disponibles'}</option>
              {rangeOptions.map(option => (
                <option key={option.id} value={option.id}>
                  {option.label} ({option.count})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Rango de precio
            </label>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
              <div className="mb-4 flex items-center justify-between gap-3 text-sm font-semibold text-slate-700">
                <div className="rounded-full bg-white px-3 py-1.5 shadow-sm">
                  Desde {formatPriceValue(safePriceMin)} €
                </div>
                <div className="rounded-full bg-white px-3 py-1.5 shadow-sm">
                  Hasta {formatPriceValue(safePriceMax)} €
                </div>
              </div>

              {hasPriceRange ? (
                <div className="relative py-4">
                  <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-200" />
                  <div
                    className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-[color:var(--catalog-accent)]"
                    style={{ left: `${leftPercent}%`, width: `${activeTrackWidth}%` }}
                  />
                  <input
                    type="range"
                    min={sliderMin}
                    max={sliderMax}
                    step={1}
                    value={safePriceMin}
                    onChange={event => {
                      const nextValue = Math.min(Number(event.target.value), safePriceMax);
                      onPriceMinChange(String(nextValue));
                    }}
                    className="pointer-events-none absolute left-0 top-1/2 h-2 w-full -translate-y-1/2 appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:mt-[-6px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[color:var(--catalog-accent)] [&::-webkit-slider-thumb]:shadow-[0_8px_18px_rgba(20,61,107,0.28)] [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[color:var(--catalog-accent)] [&::-moz-range-thumb]:shadow-[0_8px_18px_rgba(20,61,107,0.28)]"
                    aria-label="Precio mínimo"
                  />
                  <input
                    type="range"
                    min={sliderMin}
                    max={sliderMax}
                    step={1}
                    value={safePriceMax}
                    onChange={event => {
                      const nextValue = Math.max(Number(event.target.value), safePriceMin);
                      onPriceMaxChange(String(nextValue));
                    }}
                    className="pointer-events-none absolute left-0 top-1/2 h-2 w-full -translate-y-1/2 appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:mt-[-6px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[color:var(--catalog-accent)] [&::-webkit-slider-thumb]:shadow-[0_8px_18px_rgba(20,61,107,0.28)] [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[color:var(--catalog-accent)] [&::-moz-range-thumb]:shadow-[0_8px_18px_rgba(20,61,107,0.28)]"
                    aria-label="Precio máximo"
                  />
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
                  No hay suficientes precios para construir el rango.
                </div>
              )}

              <div className="mt-2 flex items-center justify-between text-xs font-medium text-slate-500">
                <span>{formatPriceValue(sliderMin)} €</span>
                <span>{formatPriceValue(sliderMax)} €</span>
              </div>
            </div>

            <div className="hidden grid-cols-2 gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={selectedPriceMin}
                onChange={event => onPriceMinChange(event.target.value)}
                placeholder="Desde €"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[color:var(--catalog-accent)] focus:ring-4 focus:ring-[color:var(--catalog-accent-soft)]/60"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={selectedPriceMax}
                onChange={event => onPriceMaxChange(event.target.value)}
                placeholder="Hasta €"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[color:var(--catalog-accent)] focus:ring-4 focus:ring-[color:var(--catalog-accent-soft)]/60"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="ean-filter" className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              EAN
            </label>
            <input
              id="ean-filter"
              type="text"
              value={selectedEan}
              onChange={event => onEanChange(event.target.value)}
              placeholder="Filtrar por EAN..."
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[color:var(--catalog-accent)] focus:ring-4 focus:ring-[color:var(--catalog-accent-soft)]/60"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="flow-filter" className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Caudal
            </label>
            <select
              id="flow-filter"
              value={selectedFlow}
              onChange={event => onFlowChange(event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[color:var(--catalog-accent)] focus:ring-4 focus:ring-[color:var(--catalog-accent-soft)]/60"
              disabled={!hasFlowOptions}
            >
              <option value="">{hasFlowOptions ? 'Todos los caudales' : 'Sin caudales disponibles'}</option>
              {flowOptions.map(option => (
                <option key={option.id} value={option.id}>
                  {option.label} ({option.count})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="finish-filter" className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Acabado
            </label>
            <select
              id="finish-filter"
              value={selectedFinish}
              onChange={event => onFinishChange(event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[color:var(--catalog-accent)] focus:ring-4 focus:ring-[color:var(--catalog-accent-soft)]/60"
              disabled={!hasFinishOptions}
            >
              <option value="">{hasFinishOptions ? 'Todos los acabados' : 'Sin acabados disponibles'}</option>
              {finishOptions.map(option => (
                <option key={option.id} value={option.id}>
                  {option.label} ({option.count})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="attribute-filter" className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Atributo
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="attribute-filter"
                type="text"
                value={selectedAttributeQuery}
                onChange={event => onAttributeQueryChange(event.target.value)}
                placeholder="Buscar por atributo o valor completo..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-9 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[color:var(--catalog-accent)] focus:ring-4 focus:ring-[color:var(--catalog-accent-soft)]/60"
              />
              {selectedAttributeQuery ? (
                <button
                  type="button"
                  onClick={() => onAttributeQueryChange('')}
                  className="absolute right-3 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Limpiar búsqueda de atributos"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Categorías</p>
              <p className="mt-1 text-xs text-slate-500">Busca por nombre o ruta.</p>
            </div>
            {selectedCategoryLabel ? (
              <button
                type="button"
                onClick={() => onCategoryChange('all')}
                className="max-w-[11rem] truncate rounded-full bg-[color:var(--catalog-accent-soft)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--catalog-accent)]"
                title={selectedCategoryLabel}
              >
                {selectedCategoryLabel}
              </button>
            ) : null}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={categoryQuery}
              onChange={event => setCategoryQuery(event.target.value)}
              placeholder="Buscar categoría..."
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-9 text-sm text-slate-900 outline-none transition focus:border-[color:var(--catalog-accent)] focus:ring-4 focus:ring-[color:var(--catalog-accent-soft)]/60"
            />
            {categoryQuery ? (
              <button
                type="button"
                onClick={() => setCategoryQuery('')}
                className="absolute right-3 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Limpiar búsqueda de categorías"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          {!categoryQuery.trim() && !showAllCategories ? (
            <div className="grid grid-cols-2 gap-2">
              {featuredCategories.map(item => {
                const active = selectedCategory === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.label}
                    onClick={() => onCategoryChange(item.id)}
                    className={`rounded-2xl border px-3 py-3 text-left transition ${
                      active
                        ? 'border-[color:var(--catalog-accent)]/30 bg-[color:var(--catalog-accent-soft)]/80'
                        : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className={`min-w-0 break-words text-sm font-medium ${active ? 'text-[color:var(--catalog-accent)]' : 'text-slate-900'}`}>
                        {item.label}
                      </span>
                      <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        {item.count}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}

          {showAllCategories || categoryQuery.trim() ? (
            <div className="space-y-2">
              {visibleCategories.length > 0 ? (
                visibleCategories.map(item => {
                  const active = selectedCategory === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onCategoryChange(item.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        active
                          ? 'border-[color:var(--catalog-accent)]/30 bg-[color:var(--catalog-accent-soft)]/80'
                          : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`truncate text-sm font-medium ${active ? 'text-[color:var(--catalog-accent)]' : 'text-slate-900'}`}>
                            {item.label}
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-500">{item.path}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                          {item.count}
                        </span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                  No hay categorías que coincidan con esa búsqueda.
                </div>
              )}
            </div>
          ) : null}

          {!categoryQuery.trim() ? (
            <button
              type="button"
              onClick={() => setShowAllCategories(previous => !previous)}
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--catalog-accent)] transition hover:opacity-80"
            >
              {showAllCategories ? 'Mostrar menos' : `Ver todas las categorías (${categories.length})`}
            </button>
          ) : null}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Tipo de producto</p>
              <p className="mt-1 text-xs text-slate-500">Selecciona un tipo de producto.</p>
            </div>
            <button
              type="button"
              onClick={() => onTypeChange('all')}
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--catalog-accent)] transition hover:opacity-80"
            >
              Restablecer
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {TYPE_TILES.map(tile => {
              const option = typeLookup[tile.id];
              const count = option?.count || 0;
              const active = selectedType === tile.id;
              return (
                <FilterTile
                  key={tile.id}
                  active={active}
                  label={tile.label}
                  count={count}
                  onClick={() => onTypeChange(active ? 'all' : tile.id)}
                />
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Estado</p>
              <p className="mt-1 text-xs text-slate-500">Filtra por estado editorial.</p>
            </div>
            <button
              type="button"
              onClick={() => onStatusChange('all')}
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--catalog-accent)] transition hover:opacity-80"
            >
              Restablecer
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {STATUS_TILES.map(tile => {
              const option = statusLookup[tile.id];
              const count = option?.count || 0;
              const active = selectedStatus === tile.id;
              return (
                <FilterTile
                  key={tile.id}
                  active={active}
                  label={tile.label}
                  count={count}
                  onClick={() => onStatusChange(active ? 'all' : tile.id)}
                />
              );
            })}
          </div>
        </section>

        <details className="group rounded-3xl border border-slate-200 bg-slate-50/60 px-4 py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-700">
            <span>Más filtros</span>
            <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
          </summary>

          <div className="mt-4 space-y-5">
            <div className="space-y-2">
              <label htmlFor="brand-filter" className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Marca
              </label>
              <select
                id="brand-filter"
                value={selectedBrand}
                onChange={event => onBrandChange(event.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[color:var(--catalog-accent)] focus:ring-4 focus:ring-[color:var(--catalog-accent-soft)]/60 disabled:cursor-not-allowed disabled:bg-slate-100"
                disabled={!hasBrands}
              >
                <option value="all">{hasBrands ? 'Todas las marcas' : 'Sin marcas en el feed'}</option>
                {brandOptions.map(brand => (
                  <option key={brand.id} value={brand.id}>
                    {brand.label} ({brand.count})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="media-filter" className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Archivos y medios
              </label>
              <select
                id="media-filter"
                value={selectedMediaFilter}
                onChange={event => onMediaFilterChange(event.target.value as MediaFilter)}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[color:var(--catalog-accent)] focus:ring-4 focus:ring-[color:var(--catalog-accent-soft)]/60"
              >
                <option value="all">Todos</option>
                <option value="with-assets">Con archivos</option>
                <option value="without-assets">Sin archivos</option>
                <option value="images-only">Solo imágenes</option>
                <option value="documents-only">Solo documentos</option>
                <option value="mixed">Imágenes y documentos</option>
              </select>
            </div>
          </div>
        </details>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Resumen</p>
          <p className="mt-2 text-sm text-slate-700">
            {summaryProductsCount ?? products.length} productos cargados
            {' · '}
            {summaryWithImagesCount ?? products.filter(product => (product.images?.length || 0) > 0).length} con imágenes
          </p>
        </div>
      </div>
    </div>
  );
}
