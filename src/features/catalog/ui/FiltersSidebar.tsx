import { ChevronDown, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Product } from '../api/productService';
import type { BrandOption, CategoryTreeNode, MediaFilter, StatusOption, TypeOption } from '../model/catalogTypes';
import { cleanText } from '../selectors/catalogSelectors';

interface FiltersSidebarProps {
  products: Product[];
  brandOptions: BrandOption[];
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
  selectedName: string;
  onNameChange: (value: string) => void;
  selectedNumber: string;
  onNumberChange: (value: string) => void;
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
    <span className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${active ? 'text-[color:var(--catalog-accent)]/80' : 'text-slate-500'}`}>
      {count}
    </span>
  </button>
);

export function FiltersSidebar({
  products = [],
  brandOptions = [],
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
  selectedName,
  onNameChange,
  selectedNumber,
  onNumberChange,
  onClearFilters,
}: FiltersSidebarProps) {
  const hasBrands = brandOptions.length > 0;
  const [categoryQuery, setCategoryQuery] = useState('');
  const [showAllCategories, setShowAllCategories] = useState(false);

  const categories = useMemo(() => flattenTree(categoryTree), [categoryTree]);
  const categoryMap = useMemo(() => Object.fromEntries(categories.map(item => [item.id, item.path])), [categories]);
  const selectedCategoryLabel = selectedCategory === 'all' ? null : cleanText(categoryMap[selectedCategory] ?? selectedCategory);

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

  const typeLookup = useMemo(
    () => Object.fromEntries(typeOptions.map(option => [option.id, option])),
    [typeOptions]
  );

  const statusLookup = useMemo(
    () => Object.fromEntries(statusOptions.map(option => [option.id, option])),
    [statusOptions]
  );
  const activeFilterCount = [
    selectedName.trim(),
    selectedNumber.trim(),
    selectedBrand !== 'all',
    selectedCategory !== 'all',
    selectedType !== 'all',
    selectedStatus !== 'all',
    selectedMediaFilter !== 'all',
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
              Número
            </label>
            <input
              id="number-filter"
              type="text"
              value={selectedNumber}
              onChange={event => onNumberChange(event.target.value)}
              placeholder="Filtrar por número o SKU..."
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[color:var(--catalog-accent)] focus:ring-4 focus:ring-[color:var(--catalog-accent-soft)]/60"
            />
          </div>
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

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Categorías</p>
                  <p className="mt-1 text-xs text-slate-500">Busca por nombre o ruta.</p>
                </div>
                {selectedCategoryLabel && (
                  <button
                    type="button"
                    onClick={() => onCategoryChange('all')}
                    className="max-w-[11rem] truncate rounded-full bg-[color:var(--catalog-accent-soft)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--catalog-accent)]"
                    title={selectedCategoryLabel}
                  >
                    {selectedCategoryLabel}
                  </button>
                )}
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
                {categoryQuery && (
                  <button
                    type="button"
                    onClick={() => setCategoryQuery('')}
                    className="absolute right-3 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Limpiar búsqueda de categorías"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {!categoryQuery.trim() && !showAllCategories ? (
                <div className="grid grid-cols-2 gap-2">
                  {featuredCategories.map(item => {
                    const active = selectedCategory === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onCategoryChange(item.id)}
                        className={`rounded-2xl border px-3 py-3 text-left transition ${
                          active
                            ? 'border-[color:var(--catalog-accent)]/30 bg-[color:var(--catalog-accent-soft)]/80'
                            : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className={`min-w-0 truncate text-sm font-medium ${active ? 'text-[color:var(--catalog-accent)]' : 'text-slate-900'}`}>
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

              {!categoryQuery.trim() && (
                <button
                  type="button"
                  onClick={() => setShowAllCategories(previous => !previous)}
                  className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--catalog-accent)] transition hover:opacity-80"
                >
                  {showAllCategories ? 'Mostrar menos' : `Ver todas las categorías (${categories.length})`}
                </button>
              )}
            </section>

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
            {products.length} productos cargados
            {' · '}
            {products.filter(product => (product.images?.length || 0) > 0).length} con imágenes
          </p>
        </div>
      </div>
    </div>
  );
}
