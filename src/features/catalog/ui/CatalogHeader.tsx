import { ChevronDown, LogOut, Search, Settings2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CatalogAccessMode, MediaFilter, QuickFilter, TenantOption } from '../model/catalogTypes';

interface CatalogHeaderProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onSearchSubmit: (value: string) => void;
  recentSearches: string[];
  onRecentSearchSelect: (value: string) => void;
  onClearRecentSearches: () => void;
  productsCount: number;
  filteredCount: number;
  imageCount: number;
  attachmentCount: number;
  withImagesCount: number;
  categoryCount: number;
  assetCount: number;
  activeViewName?: string | null;
  logoUrl?: string;
  tenantOptions: TenantOption[];
  selectedTenantId: string;
  accessMode: CatalogAccessMode;
  onTenantChange: (tenantId: string) => void;
  selectedQuickFilter: QuickFilter;
  selectedMediaFilter: MediaFilter;
  onStatFilterClick: (filter: 'images' | 'attachments' | 'images-only' | 'categories' | 'assets') => void;
  onOpenSettings: () => void;
  onSignOut: () => void;
}

export function CatalogHeader({
  searchTerm,
  onSearchTermChange,
  onSearchSubmit,
  recentSearches,
  onRecentSearchSelect,
  onClearRecentSearches,
  productsCount,
  filteredCount,
  imageCount,
  attachmentCount,
  withImagesCount,
  categoryCount,
  assetCount,
  activeViewName,
  logoUrl,
  tenantOptions,
  selectedTenantId,
  accessMode,
  onTenantChange,
  selectedQuickFilter,
  selectedMediaFilter,
  onStatFilterClick,
  onOpenSettings,
  onSignOut,
}: CatalogHeaderProps) {
  const [tenantMenuOpen, setTenantMenuOpen] = useState(false);
  const [tenantSearch, setTenantSearch] = useState('');
  const selectedTenant = tenantOptions.find(option => option.id === selectedTenantId) || tenantOptions[0];

  const filteredTenantOptions = useMemo(() => {
    const query = tenantSearch.trim().toLowerCase();
    if (!query) return tenantOptions;

    return tenantOptions.filter(option => {
      const haystack = [option.label, option.description || '', option.id].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [tenantOptions, tenantSearch]);

  const statButtons = [
    { key: 'images' as const, label: 'imágenes', value: imageCount, active: selectedQuickFilter === 'images' },
    { key: 'attachments' as const, label: 'adjuntos', value: attachmentCount, active: selectedQuickFilter === 'attachments' },
    { key: 'images-only' as const, label: 'con imágenes', value: withImagesCount, active: selectedMediaFilter === 'images-only' },
    { key: 'categories' as const, label: 'categorías', value: categoryCount, active: selectedQuickFilter === 'categories' },
    { key: 'assets' as const, label: 'con archivos', value: assetCount, active: selectedQuickFilter === 'assets' },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <div className="flex w-full flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo del catálogo" className="h-full w-full object-contain p-2" />
              ) : (
                <span className="flex h-full w-full items-center justify-center rounded-[20px] bg-[var(--catalog-accent)] text-sm font-semibold tracking-[0.24em] text-white">
                  CS
                </span>
              )}
            </div>

            <div className="h-10 w-px bg-slate-200" />

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Content Store</p>
              <h1 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-900">Catálogo virtual</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {accessMode === 'admin' ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setTenantMenuOpen(open => !open)}
                  className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <div className="flex flex-col">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Organización</span>
                    <span className="mt-0.5 text-sm font-semibold text-slate-900">{selectedTenant?.label || 'Sin organización'}</span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </button>

                {tenantMenuOpen && (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-40 cursor-default"
                      aria-label="Cerrar selector de organización"
                      onClick={() => setTenantMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[380px] rounded-3xl border border-slate-200 bg-white p-3 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
                      <input
                        type="text"
                        value={tenantSearch}
                        onChange={event => setTenantSearch(event.target.value)}
                        placeholder="Buscar organización..."
                        className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none focus:border-[color:var(--catalog-accent)]"
                      />
                      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                        {filteredTenantOptions.map(option => {
                          const active = option.id === selectedTenantId;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => {
                                onTenantChange(option.id);
                                setTenantMenuOpen(false);
                                setTenantSearch('');
                              }}
                              className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                                active
                                  ? 'border-[color:var(--catalog-accent)] bg-[color:var(--catalog-accent-soft)]'
                                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                              <p className="mt-1 text-xs text-slate-500">{option.description || option.id}</p>
                            </button>
                          );
                        })}
                        {filteredTenantOptions.length === 0 && (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                            No hay organizaciones que coincidan.
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Organización</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">{selectedTenant?.label || 'Organización activa'}</p>
              </div>
            )}

            {activeViewName ? (
              <span className="hidden rounded-full border border-[color:var(--catalog-accent-soft)] bg-[color:var(--catalog-accent-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--catalog-accent)] md:inline">
                Vista: {activeViewName}
              </span>
            ) : null}
            <span className="hidden text-sm text-slate-500 md:inline">admin@demo.com</span>
            <button
              onClick={onOpenSettings}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              <Settings2 className="h-4 w-4" />
              Configuración
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-2 rounded-full bg-[#d90429] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#b70322]"
            >
              <LogOut className="h-4 w-4" />
              Salir
            </button>
          </div>
        </div>
      </header>

      <section className="mb-6 rounded-[28px] border border-slate-200/80 bg-white/90 px-5 py-5 shadow-[0_16px_36px_rgba(15,23,42,0.06)] backdrop-blur">
        <div className="grid gap-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, SKU, categoría o atributo..."
              value={searchTerm}
              onChange={event => onSearchTermChange(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') onSearchSubmit(searchTerm);
              }}
              className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-12 text-[15px] text-slate-900 outline-none transition focus:border-[color:var(--catalog-accent)] focus:ring-4 focus:ring-[color:var(--catalog-accent-soft)]"
            />
            {searchTerm.trim().length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  onSearchTermChange('');
                  onSearchSubmit('');
                }}
                aria-label="Limpiar búsqueda"
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          {recentSearches.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Recientes</span>
              {recentSearches.map(term => (
                <button
                  key={term}
                  type="button"
                  onClick={() => onRecentSearchSelect(term)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-white"
                >
                  {term}
                  <X className="h-3 w-3" />
                </button>
              ))}
              <button
                type="button"
                onClick={onClearRecentSearches}
                className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 transition hover:text-slate-700"
              >
                Limpiar recientes
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              Mostrando <span className="font-semibold text-slate-900">{filteredCount}</span> grupos de{' '}
              <span className="font-semibold text-slate-900">{productsCount}</span> productos
            </p>
            <div className="flex flex-wrap gap-2">
              {statButtons.map(button => (
                <button
                  key={button.key}
                  type="button"
                  onClick={() => onStatFilterClick(button.key)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                    button.active
                      ? 'border-[color:var(--catalog-accent)] bg-[var(--catalog-accent)] text-white shadow-[0_10px_20px_rgba(20,61,107,0.18)]'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  {button.value} {button.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
