import { ChevronDown, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CatalogAccessMode, TenantOption } from '../model/catalogTypes';
import { UserMenu } from './UserMenu';

interface CatalogHeaderProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onSearchSubmit: (value: string) => void;
  recentSearches: string[];
  onRecentSearchSelect: (value: string) => void;
  onClearRecentSearches: () => void;
  productsCount: number;
  filteredCount: number;
  activeViewName?: string | null;
  logoUrl?: string;
  tenantOptions: TenantOption[];
  selectedTenantId: string;
  accessMode: CatalogAccessMode;
  onTenantChange: (tenantId: string) => void;
  sortControl?: ReactNode;
  controlsRow?: ReactNode;
  userEmail?: string | null;
  userFullName?: string | null;
  onOpenProfile: () => void;
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
  activeViewName,
  logoUrl,
  tenantOptions,
  selectedTenantId,
  accessMode,
  onTenantChange,
  sortControl,
  controlsRow,
  userEmail,
  userFullName,
  onOpenProfile,
  onOpenSettings,
  onSignOut,
}: CatalogHeaderProps) {
  const [tenantMenuOpen, setTenantMenuOpen] = useState(false);
  const [tenantSearch, setTenantSearch] = useState('');
  const [inputValue, setInputValue] = useState(searchTerm);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setInputValue(searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    setLogoError(false);
  }, [logoUrl]);

  const selectedTenant = tenantOptions.find(option => option.id === selectedTenantId) || tenantOptions[0];

  const filteredTenantOptions = useMemo(() => {
    const query = tenantSearch.trim().toLowerCase();
    if (!query) return tenantOptions;

    return tenantOptions.filter(option => {
      const haystack = [option.label, option.description || '', option.id].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [tenantOptions, tenantSearch]);

  const applySearch = () => {
    const nextValue = inputValue.trim();
    onSearchTermChange(nextValue);
    onSearchSubmit(nextValue);
  };

  return (
    <>
      <div className="mb-5 rounded-[28px] border border-slate-200/80 bg-white/90 px-5 py-4 shadow-[0_16px_36px_rgba(15,23,42,0.06)] backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
              {logoUrl && !logoError ? (
                <img
                  src={logoUrl}
                  alt="Logo del catálogo"
                  className="h-full w-full object-contain p-2"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center rounded-[18px] bg-[var(--catalog-accent)] text-sm font-semibold tracking-[0.24em] text-white">
                  CS
                </span>
              )}
            </div>

            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Content Store</p>
              <p className="truncate text-lg font-semibold tracking-[-0.03em] text-slate-900">Catálogo virtual</p>
            </div>
          </div>

          <UserMenu
            email={userEmail}
            fullName={userFullName}
            onOpenProfile={onOpenProfile}
            onOpenSettings={onOpenSettings}
            onLogout={onSignOut}
            showLabel={false}
            buttonClassName="px-3 py-2"
          />
        </div>

        <div className="mt-4">
          {accessMode === 'admin' ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setTenantMenuOpen(open => !open)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Organización</p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                    {selectedTenant?.label || 'Sin organización'}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
              </button>

              {tenantMenuOpen ? (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-40 cursor-default"
                    aria-label="Cerrar selector de organización"
                    onClick={() => setTenantMenuOpen(false)}
                  />
                  <div className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-full rounded-3xl border border-slate-200 bg-white p-3 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
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
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Organización</p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                {selectedTenant?.label || 'Organización activa'}
              </p>
            </div>
          )}
        </div>
      </div>

      <section className="mb-6 rounded-[28px] border border-slate-200/80 bg-white/90 px-5 py-5 shadow-[0_16px_36px_rgba(15,23,42,0.06)] backdrop-blur lg:sticky lg:top-4 lg:z-30">
        <div className="grid gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, SKU, categoría o atributo..."
                value={inputValue}
                onChange={event => setInputValue(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') applySearch();
                }}
                className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-28 text-[15px] text-slate-900 outline-none transition focus:border-[color:var(--catalog-accent)] focus:ring-4 focus:ring-[color:var(--catalog-accent-soft)]"
              />
              <button
                type="button"
                onClick={applySearch}
                className="absolute right-12 top-1/2 -translate-y-1/2 rounded-xl bg-[color:var(--catalog-accent)] px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:opacity-90"
              >
                Buscar
              </button>
              {inputValue.trim().length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setInputValue('');
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

            {sortControl ? <div className="shrink-0">{sortControl}</div> : null}
          </div>

          {controlsRow ? <div className="flex flex-wrap items-center justify-between gap-3">{controlsRow}</div> : null}

          {recentSearches.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Recientes</span>
              {recentSearches.map(term => (
                <button
                  key={term}
                  type="button"
                  onClick={() => onRecentSearchSelect(term)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-white"
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
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              Mostrando <span className="font-semibold text-slate-900">{filteredCount}</span> grupos de{' '}
              <span className="font-semibold text-slate-900">{productsCount}</span> productos
            </p>

            {activeViewName ? (
              <span className="rounded-full border border-[color:var(--catalog-accent-soft)] bg-[color:var(--catalog-accent-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--catalog-accent)] lg:hidden">
                Vista: {activeViewName}
              </span>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
