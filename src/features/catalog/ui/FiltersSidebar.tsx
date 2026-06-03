import { ChevronDown, Search, X } from 'lucide-react';
import {
  useEffect,
  useMemo,
  useState,
  type InputHTMLAttributes,
  type KeyboardEventHandler,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import type { Product } from '../api/productService';
import type {
  BrandOption,
  CategoryTreeNode,
  FacetOption,
  MediaFilter,
  PriceRange,
  StatusOption,
  TextMatchOperator,
  TypeOption,
} from '../model/catalogTypes';
import { cleanText } from '../selectors/catalogSelectors';

interface FiltersSidebarProps {
  products: Product[];
  summaryProductsCount?: number;
  summaryWithImagesCount?: number;
  brandOptions: BrandOption[];
  rangeOptions: FacetOption[];
  variantGroupOptions: FacetOption[];
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
  selectedNumberOperator: TextMatchOperator;
  onNumberChange: (value: string) => void;
  onNumberOperatorChange: (value: TextMatchOperator) => void;
  selectedCollection: string;
  onCollectionChange: (value: string) => void;
  selectedRange: string;
  onRangeChange: (value: string) => void;
  selectedVariantGroup: string;
  onVariantGroupChange: (value: string) => void;
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
  embedded?: boolean;
}

type CategoryItem = { id: string; label: string; path: string; count: number };

const flattenTree = (nodes: CategoryTreeNode[], ancestors: string[] = []): CategoryItem[] =>
  nodes.flatMap(node => {
    const label = cleanText(node.label);
    const path = [...ancestors, label];
    return [
      { id: node.id, label, path: cleanText(path.join(' / ')), count: node.count },
      ...flattenTree(node.children, path),
    ];
  });

const matchScore = (item: CategoryItem, term: string) => {
  if (!term) return item.count;
  const l = item.label.toLowerCase(), p = item.path.toLowerCase();
  if (l === term || p === term) return 1000 + item.count;
  if (l.startsWith(term) || p.startsWith(term)) return 500 + item.count;
  if (l.includes(term) || p.includes(term)) return 100 + item.count;
  return 0;
};

const formatPrice = (v: number) =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(Math.round(v));

// ── Primitives ───────────────────────────────────────────────────────────────

const FilterInput = (props: InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={`h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[color:var(--catalog-accent)] focus:ring-2 focus:ring-[color:var(--catalog-accent-soft)]/60 ${props.className ?? ''}`.trim()}
  />
);

const FilterSelect = (props: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    className={`h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-[color:var(--catalog-accent)] focus:ring-2 focus:ring-[color:var(--catalog-accent-soft)]/60 ${props.className ?? ''}`.trim()}
  />
);

const SectionLabel = ({ children }: { children: ReactNode }) => (
  <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-slate-500">{children}</p>
);

// ── Category Tree ────────────────────────────────────────────────────────────

function CategoryTreeItem({
  node,
  depth = 0,
  selectedCategory,
  onCategoryChange,
}: {
  node: CategoryTreeNode;
  depth?: number;
  selectedCategory: string;
  onCategoryChange: (id: string) => void;
}) {
  const isActive = selectedCategory === node.id;
  const hasChildren = node.children.length > 0;
  const childHasActive = hasChildren && (
    node.children.some(c => c.id === selectedCategory || c.children.some(gc => gc.id === selectedCategory))
  );
  const [expanded, setExpanded] = useState(depth === 0 || childHasActive);

  return (
    <div>
      <div
        className={`flex items-center gap-1 rounded-lg transition ${isActive ? 'bg-[color:var(--catalog-accent-soft)]/80' : 'hover:bg-slate-50'}`}
        style={{ paddingLeft: `${depth * 14}px` }}
      >
        <button
          type="button"
          onClick={() => hasChildren && setExpanded(v => !v)}
          className={`flex h-6 w-6 shrink-0 items-center justify-center text-slate-400 transition ${!hasChildren ? 'invisible' : ''}`}
          tabIndex={hasChildren ? 0 : -1}
          aria-label={expanded ? 'Colapsar' : 'Expandir'}
        >
          <ChevronDown className={`h-3 w-3 transition-transform duration-150 ${expanded ? '' : '-rotate-90'}`} />
        </button>
        <button
          type="button"
          onClick={() => onCategoryChange(isActive ? 'all' : node.id)}
          className={`flex flex-1 items-center justify-between py-1.5 pr-2 text-left text-sm transition ${
            isActive ? 'font-semibold text-[color:var(--catalog-accent)]' : 'text-slate-700'
          }`}
        >
          <span className="truncate">{cleanText(node.label)}</span>
          <span className="ml-2 shrink-0 text-[11px] text-slate-400">{node.count}</span>
        </button>
      </div>
      {hasChildren && expanded && (
        <div>
          {node.children.map(child => (
            <CategoryTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedCategory={selectedCategory}
              onCategoryChange={onCategoryChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Collapsible Section ──────────────────────────────────────────────────────

function Section({
  title,
  active,
  defaultOpen = false,
  children,
}: {
  title: string;
  active?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen || active);

  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  return (
    <div className="border-b border-slate-100 last:border-none">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-2 py-3.5 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-slate-700">{title}</span>
          {active && (
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--catalog-accent)]" />
          )}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="pb-4 space-y-3">{children}</div>}
    </div>
  );
}

// ── Checkbox row ─────────────────────────────────────────────────────────────

function CheckRow({
  checked,
  label,
  count,
  onChange,
}: {
  checked: boolean;
  label: string;
  count?: number;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1 transition hover:bg-slate-50">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 rounded border-slate-300 accent-[color:var(--catalog-accent)]"
      />
      <span className="flex-1 text-sm text-slate-700">{label}</span>
      {count !== undefined && (
        <span className="text-[11px] font-medium text-slate-400">{count}</span>
      )}
    </label>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function FiltersSidebar({
  products = [],
  summaryProductsCount,
  summaryWithImagesCount,
  brandOptions = [],
  rangeOptions = [],
  variantGroupOptions = [],
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
  selectedNumberOperator,
  onNumberChange,
  onNumberOperatorChange,
  selectedCollection,
  onCollectionChange,
  selectedRange,
  onRangeChange,
  selectedVariantGroup,
  onVariantGroupChange,
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
  embedded = false,
}: FiltersSidebarProps) {
  // ── Draft state for text inputs (apply on Enter or button) ────────────────
  const [draftName, setDraftName] = useState(selectedName);
  const [draftNumber, setDraftNumber] = useState(selectedNumber);
  const [draftNumberOp, setDraftNumberOp] = useState<TextMatchOperator>(selectedNumberOperator);
  const [draftCollection, setDraftCollection] = useState(selectedCollection);
  const [draftEan, setDraftEan] = useState(selectedEan);
  const [draftAttr, setDraftAttr] = useState(selectedAttributeQuery);
  const [categoryQuery, setCategoryQuery] = useState('');
  const [showAllCategories, setShowAllCategories] = useState(false);

  useEffect(() => setDraftName(selectedName), [selectedName]);
  useEffect(() => setDraftNumber(selectedNumber), [selectedNumber]);
  useEffect(() => setDraftNumberOp(selectedNumberOperator), [selectedNumberOperator]);
  useEffect(() => setDraftCollection(selectedCollection), [selectedCollection]);
  useEffect(() => setDraftEan(selectedEan), [selectedEan]);
  useEffect(() => setDraftAttr(selectedAttributeQuery), [selectedAttributeQuery]);

  const applyDrafts = () => {
    onNameChange(draftName);
    onNumberChange(draftNumber);
    onNumberOperatorChange(draftNumberOp);
    onCollectionChange(draftCollection);
    onEanChange(draftEan);
    onAttributeQueryChange(draftAttr);
  };

  const draftsDirty =
    draftName !== selectedName ||
    draftNumber !== selectedNumber ||
    draftNumberOp !== selectedNumberOperator ||
    draftCollection !== selectedCollection ||
    draftEan !== selectedEan ||
    draftAttr !== selectedAttributeQuery;

  const handleEnter: KeyboardEventHandler<HTMLInputElement> = e => {
    if (e.key === 'Enter') { e.preventDefault(); applyDrafts(); }
  };

  // ── Category logic ────────────────────────────────────────────────────────
  const categories = useMemo(() => flattenTree(categoryTree), [categoryTree]);
  const categoryMap = useMemo(
    () => Object.fromEntries(categories.map(c => [c.id, c.path])),
    [categories]
  );
  const selectedCategoryLabel =
    selectedCategory === 'all' ? null : cleanText(categoryMap[selectedCategory] || selectedCategory);

  const visibleCategories = useMemo(() => {
    const term = categoryQuery.trim().toLowerCase();
    const source = term
      ? categories.filter(c => c.label.toLowerCase().includes(term) || c.path.toLowerCase().includes(term))
      : categories.filter(c => c.count > 0);
    return [...source]
      .sort((a, b) => matchScore(b, term) - matchScore(a, term) || b.count - a.count)
      .slice(0, term ? 12 : showAllCategories ? 40 : 8);
  }, [categoryQuery, categories, showAllCategories]);

  // ── Price slider ──────────────────────────────────────────────────────────
  const sliderMin = Number.isFinite(priceRange?.min) ? priceRange.min : 0;
  const sliderMax = Number.isFinite(priceRange?.max) ? priceRange.max : 0;
  const hasPriceRange = sliderMax > sliderMin;
  const safeMin = Number.isFinite(Number(selectedPriceMin)) && selectedPriceMin.trim()
    ? Math.max(sliderMin, Number(selectedPriceMin)) : sliderMin;
  const safeMax = Number.isFinite(Number(selectedPriceMax)) && selectedPriceMax.trim()
    ? Math.min(sliderMax, Number(selectedPriceMax)) : sliderMax;
  const range = Math.max(sliderMax - sliderMin, 1);
  const leftPct = ((safeMin - sliderMin) / range) * 100;
  const rightPct = ((safeMax - sliderMin) / range) * 100;

  // ── Active filter count ───────────────────────────────────────────────────
  const activeFilterCount = [
    selectedName.trim(), selectedNumber.trim(), selectedCollection.trim(),
    selectedRange.trim(), selectedVariantGroup.trim(), selectedPriceMin.trim(),
    selectedPriceMax.trim(), selectedEan.trim(), selectedFlow.trim(),
    selectedFinish.trim(), selectedAttributeQuery.trim(),
    selectedBrand !== 'all', selectedCategory !== 'all',
    selectedType !== 'all', selectedStatus !== 'all',
    selectedMediaFilter !== 'all', selectedQuickFilter !== 'all',
  ].filter(Boolean).length;

  // ── Content availability helpers ─────────────────────────────────────────
  const contentFilters: { value: MediaFilter; label: string }[] = [
    { value: 'with-assets', label: 'Con imagen' },
    { value: 'without-assets', label: 'Sin imagen' },
    { value: 'documents-only', label: 'Solo documentos' },
    { value: 'images-only', label: 'Solo imágenes' },
    { value: 'mixed', label: 'Imágenes y documentos' },
  ];

  const wrapper = embedded
    ? 'min-w-0'
    : 'sticky top-24 overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.07)]';

  return (
    <div className={wrapper}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-semibold text-slate-800">Filtros</h2>
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-[color:var(--catalog-accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--catalog-accent)]">
              {activeFilterCount}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClearFilters}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        >
          Limpiar
        </button>
      </div>

      {/* ── Summary ── */}
      <div className="border-b border-slate-100 px-5 py-3">
        <p className="text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{summaryProductsCount ?? products.length}</span> productos
          {' · '}
          <span className="font-semibold text-slate-700">
            {summaryWithImagesCount ?? products.filter(p => (p.images?.length || 0) > 0).length}
          </span>{' '}
          con imagen
        </p>
      </div>

      {/* ── Sections ── */}
      <div className="divide-y divide-slate-100 px-5">

        {/* Búsqueda rápida */}
        <Section
          title="Búsqueda rápida"
          defaultOpen
          active={!!(selectedName || selectedNumber || selectedEan)}
        >
          <div className="space-y-3">
            <div>
              <SectionLabel>Nombre</SectionLabel>
              <div className="mt-1.5">
                <FilterInput
                  type="text"
                  value={draftName}
                  onChange={e => setDraftName(e.target.value)}
                  onKeyDown={handleEnter}
                  placeholder="Filtrar por nombre..."
                />
              </div>
            </div>

            <div>
              <SectionLabel>SKU</SectionLabel>
              <div className="mt-1.5 flex gap-2">
                <select
                  value={draftNumberOp}
                  onChange={e => setDraftNumberOp(e.target.value as TextMatchOperator)}
                  className="h-10 w-32 shrink-0 rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-[color:var(--catalog-accent)]"
                >
                  <option value="contains">Contains</option>
                  <option value="is">Is</option>
                  <option value="starts_with">Starts with</option>
                  <option value="is_not">Is not</option>
                </select>
                <FilterInput
                  type="text"
                  value={draftNumber}
                  onChange={e => setDraftNumber(e.target.value)}
                  onKeyDown={handleEnter}
                  placeholder="SKU..."
                />
              </div>
            </div>

            <div>
              <SectionLabel>EAN</SectionLabel>
              <div className="mt-1.5">
                <FilterInput
                  type="text"
                  value={draftEan}
                  onChange={e => setDraftEan(e.target.value)}
                  onKeyDown={handleEnter}
                  placeholder="EAN..."
                />
              </div>
            </div>

            {draftsDirty && (
              <button
                type="button"
                onClick={applyDrafts}
                className="h-9 w-full rounded-lg bg-[color:var(--catalog-accent)] text-xs font-semibold text-white transition hover:opacity-90"
              >
                Aplicar búsqueda
              </button>
            )}
          </div>
        </Section>

        {/* Categorías */}
        <Section title="Categorías" active={selectedCategory !== 'all'} defaultOpen>
          <div className="space-y-1">
            {selectedCategoryLabel && (
              <div className="mb-2 flex items-center justify-between rounded-lg bg-[color:var(--catalog-accent-soft)]/60 px-3 py-2">
                <span className="truncate text-xs font-medium text-[color:var(--catalog-accent)]">
                  {selectedCategoryLabel}
                </span>
                <button
                  type="button"
                  onClick={() => onCategoryChange('all')}
                  className="ml-2 shrink-0 text-[color:var(--catalog-accent)] opacity-70 hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {categoryTree.length > 0 ? (
              categoryTree.map(node => (
                <CategoryTreeItem
                  key={node.id}
                  node={node}
                  depth={0}
                  selectedCategory={selectedCategory}
                  onCategoryChange={onCategoryChange}
                />
              ))
            ) : (
              <p className="px-1 text-xs text-slate-400">No hay categorías disponibles</p>
            )}
          </div>
        </Section>

        {/* Comercial */}
        <Section
          title="Comercial"
          active={!!(selectedCollection || selectedRange || selectedVariantGroup || selectedFlow || selectedFinish || selectedPriceMin || selectedPriceMax)}
        >
          <div className="space-y-4">
            <div>
              <SectionLabel>Colección</SectionLabel>
              <div className="mt-1.5">
                <FilterInput
                  type="text"
                  value={draftCollection}
                  onChange={e => setDraftCollection(e.target.value)}
                  onKeyDown={handleEnter}
                  placeholder="Filtrar por colección..."
                />
              </div>
            </div>

            {rangeOptions.length > 0 && (
              <div>
                <SectionLabel>Gama</SectionLabel>
                <div className="mt-1.5">
                  <FilterSelect value={selectedRange} onChange={e => onRangeChange(e.target.value)}>
                    <option value="">Todas las gamas</option>
                    {rangeOptions.map(o => (
                      <option key={o.id} value={o.id}>{o.label} ({o.count})</option>
                    ))}
                  </FilterSelect>
                </div>
              </div>
            )}

            {finishOptions.length > 0 && (
              <div>
                <SectionLabel>Acabado</SectionLabel>
                <div className="mt-2 space-y-0.5 max-h-48 overflow-y-auto">
                  {finishOptions.map(o => (
                    <CheckRow
                      key={o.id}
                      checked={selectedFinish === o.id}
                      label={o.label}
                      count={o.count}
                      onChange={() => onFinishChange(selectedFinish === o.id ? '' : o.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {flowOptions.length > 0 && (
              <div>
                <SectionLabel>Caudal</SectionLabel>
                <div className="mt-1.5">
                  <FilterSelect value={selectedFlow} onChange={e => onFlowChange(e.target.value)}>
                    <option value="">Todos los caudales</option>
                    {flowOptions.map(o => (
                      <option key={o.id} value={o.id}>{o.label} ({o.count})</option>
                    ))}
                  </FilterSelect>
                </div>
              </div>
            )}

            {variantGroupOptions.length > 0 && (
              <div>
                <SectionLabel>Variant group</SectionLabel>
                <div className="mt-1.5">
                  <FilterSelect value={selectedVariantGroup} onChange={e => onVariantGroupChange(e.target.value)}>
                    <option value="">Todos</option>
                    {variantGroupOptions.map(o => (
                      <option key={o.id} value={o.id}>{o.label} ({o.count})</option>
                    ))}
                  </FilterSelect>
                </div>
              </div>
            )}

            {hasPriceRange && (
              <div>
                <SectionLabel>Precio</SectionLabel>
                <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3.5">
                  <div className="mb-3 flex items-center justify-between text-xs font-semibold text-slate-600">
                    <span>{formatPrice(safeMin)} €</span>
                    <span>{formatPrice(safeMax)} €</span>
                  </div>
                  <div className="relative h-5">
                    <div className="absolute top-1/2 left-0 right-0 h-1.5 -translate-y-1/2 rounded-full bg-slate-200" />
                    <div
                      className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[color:var(--catalog-accent)]"
                      style={{ left: `${leftPct}%`, width: `${Math.max(rightPct - leftPct, 0)}%` }}
                    />
                    <input type="range" min={sliderMin} max={sliderMax} step={1} value={safeMin}
                      onChange={e => onPriceMinChange(String(Math.min(Number(e.target.value), safeMax)))}
                      className="pointer-events-none absolute left-0 top-1/2 h-1.5 w-full -translate-y-1/2 appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[color:var(--catalog-accent)] [&::-webkit-slider-thumb]:shadow-md"
                      aria-label="Precio mínimo"
                    />
                    <input type="range" min={sliderMin} max={sliderMax} step={1} value={safeMax}
                      onChange={e => onPriceMaxChange(String(Math.max(Number(e.target.value), safeMin)))}
                      className="pointer-events-none absolute left-0 top-1/2 h-1.5 w-full -translate-y-1/2 appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[color:var(--catalog-accent)] [&::-webkit-slider-thumb]:shadow-md"
                      aria-label="Precio máximo"
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                    <span>{formatPrice(sliderMin)} €</span>
                    <span>{formatPrice(sliderMax)} €</span>
                  </div>
                </div>
              </div>
            )}

            {draftsDirty && (
              <button
                type="button"
                onClick={applyDrafts}
                className="h-9 w-full rounded-lg bg-[color:var(--catalog-accent)] text-xs font-semibold text-white transition hover:opacity-90"
              >
                Aplicar
              </button>
            )}
          </div>
        </Section>

        {/* Tipo de producto */}
        <Section title="Tipo de producto" active={selectedType !== 'all'}>
          <div className="space-y-0.5">
            {[{ id: 'single', label: 'Simple' }, { id: 'variant', label: 'Con acabados' }, { id: 'bundle', label: 'Bundle' }].map(tile => {
              const opt = typeOptions.find(o => o.id === tile.id);
              return (
                <CheckRow
                  key={tile.id}
                  checked={selectedType === tile.id}
                  label={tile.label}
                  count={opt?.count}
                  onChange={() => onTypeChange(selectedType === tile.id ? 'all' : tile.id)}
                />
              );
            })}
          </div>
        </Section>

        {/* Contenido disponible */}
        <Section title="Contenido disponible" active={selectedMediaFilter !== 'all'}>
          <div className="space-y-0.5">
            {contentFilters.map(f => (
              <CheckRow
                key={f.value}
                checked={selectedMediaFilter === f.value}
                label={f.label}
                onChange={() => onMediaFilterChange(selectedMediaFilter === f.value ? 'all' : f.value)}
              />
            ))}
          </div>
        </Section>

        {/* Estado editorial */}
        <Section title="Estado editorial" active={selectedStatus !== 'all'}>
          <div className="space-y-0.5">
            {[
              { id: 'draft', label: 'Borrador' },
              { id: 'to-be-published', label: 'Por publicar' },
              { id: 'published', label: 'Publicado' },
              { id: 'archived', label: 'Archivado' },
            ].map(tile => {
              const opt = statusOptions.find(o => o.id === tile.id);
              return (
                <CheckRow
                  key={tile.id}
                  checked={selectedStatus === tile.id}
                  label={tile.label}
                  count={opt?.count}
                  onChange={() => onStatusChange(selectedStatus === tile.id ? 'all' : tile.id)}
                />
              );
            })}
          </div>
        </Section>

        {/* Atributos técnicos */}
        <Section title="Atributos técnicos" active={!!selectedAttributeQuery}>
          <div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <FilterInput
                type="text"
                value={draftAttr}
                onChange={e => setDraftAttr(e.target.value)}
                onKeyDown={handleEnter}
                placeholder="Buscar atributo o valor..."
                className="pl-9 pr-8"
              />
              {draftAttr && (
                <button
                  type="button"
                  onClick={() => { setDraftAttr(''); onAttributeQueryChange(''); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {draftAttr !== selectedAttributeQuery && draftAttr.trim() && (
              <button
                type="button"
                onClick={applyDrafts}
                className="mt-2 h-9 w-full rounded-lg bg-[color:var(--catalog-accent)] text-xs font-semibold text-white transition hover:opacity-90"
              >
                Buscar
              </button>
            )}
          </div>
        </Section>

        {/* Marca */}
        {brandOptions.length > 0 && (
          <Section title="Marca" active={selectedBrand !== 'all'}>
            <FilterSelect value={selectedBrand} onChange={e => onBrandChange(e.target.value)}>
              <option value="all">Todas las marcas</option>
              {brandOptions.map(b => (
                <option key={b.id} value={b.id}>{b.label} ({b.count})</option>
              ))}
            </FilterSelect>
          </Section>
        )}

      </div>
    </div>
  );
}
