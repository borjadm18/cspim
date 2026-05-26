import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Package, SlidersHorizontal, X } from 'lucide-react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '../shared/ui/LoadingSpinner';
import { ErrorMessage } from '../shared/ui/ErrorMessage';
import { ErrorBoundary } from '../shared/ui/ErrorBoundary';
import { FiltersSidebar } from '../features/catalog/ui/FiltersSidebar';
import { ProductCard } from '../features/catalog/ui/ProductCard';
import { CatalogHeader } from '../features/catalog/ui/CatalogHeader';
import { CatalogSidebar } from '../features/catalog/ui/CatalogSidebar';
import { CatalogSettingsModal } from '../features/catalog/ui/CatalogSettingsModal';
import { UserProfileModal } from '../features/catalog/ui/UserProfileModal';
import { useCatalog } from '../features/catalog/state/useCatalog';
import { useAuth } from '../hooks/useAuth';
import { useTenantBranding } from '../hooks/useTenantBranding';
import type { CatalogSortKey } from '../features/catalog/model/catalogTypes';
import { fetchProductDetail, type Product } from '../features/catalog/api/productService';
import { resolveCatalogTheme } from '../shared/theme/catalogThemes';
import { ToastProvider, useToast } from '../shared/ui/toast';
import { ConfirmDialogProvider, useConfirm } from '../shared/ui/ConfirmDialog';
import { CATALOG_ACCESS_MODE } from '../shared/config/catalogTenant';

const LoginPage = lazy(() => import('../pages/LoginPage'));
const SuperadminPage = lazy(() => import('../pages/SuperadminPage'));
const ProductModal = lazy(() =>
  import('../features/catalog/ui/ProductModal').then(m => ({ default: m.ProductModal }))
);

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--catalog-accent-soft)] bg-[color:var(--catalog-accent-soft)]/60 px-3 py-1 text-xs font-medium text-[color:var(--catalog-accent)]">
      {label}
      <button type="button" onClick={onRemove} aria-label={`Quitar filtro ${label}`} className="ml-0.5 rounded-full p-0.5 opacity-70 transition hover:opacity-100">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function CatalogPage() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const branding = useTenantBranding(profile?.tenantId);
  const currentUserRole =
    profile?.role === 'superadmin' || profile?.role === 'admin'
      ? 'admin'
      : profile?.role === 'content_manager'
        ? 'content_manager'
        : profile?.role === 'comercial'
          ? 'commercial'
          : (import.meta.env.VITE_CATALOG_USER_ROLE as 'admin' | 'content_manager' | 'commercial' | undefined) ??
            (CATALOG_ACCESS_MODE === 'client' ? 'commercial' : 'admin');
  const {
    products,
    loading,
    error,
    selectedTenantId,
    setSelectedTenantId,
    tenantOptions,
    selectedProduct,
    setSelectedProduct,
    searchTerm,
    selectedName,
    selectedNumber,
    selectedCollection,
    selectedRange,
    selectedPriceMin,
    selectedPriceMax,
    selectedEan,
    selectedFlow,
    selectedFinish,
    setSearchTerm,
    setSelectedName,
    setSelectedNumber,
    setSelectedCollection,
    setSelectedRange,
    setSelectedPriceMin,
    setSelectedPriceMax,
    setSelectedEan,
    setSelectedFlow,
    setSelectedFinish,
    selectedBrand,
    setSelectedBrand,
    selectedCategory,
    setSelectedCategory,
    selectedType,
    setSelectedType,
    selectedStatus,
    setSelectedStatus,
    selectedMediaFilter,
    setSelectedMediaFilter,
    selectedQuickFilter,
    selectedAttributeQuery,
    setSelectedAttributeQuery,
    sortBy,
    setSortBy,
    currentPage,
    setCurrentPage,
    isSettingsOpen,
    setIsSettingsOpen,
    brandOptions,
    rangeOptions,
    flowOptions,
    finishOptions,
    priceRange,
    categoryTree,
    categoryLabelMap,
    typeOptions,
    statusOptions,
    displayProducts,
    handleClearFilters,
    totalPages,
    paginatedProducts,
    reloadProducts,
    settings,
    setSettings,
    savedViews,
    savedViewName,
    setSavedViewName,
    saveCurrentView,
    applySavedView,
    deleteSavedView,
    restoreDefaultSettings,
    activeSavedView,
    shareableLink,
    shareMessage,
    shareError,
    copyShareableLink,
    recentSearches,
    commitSearchTerm,
    clearRecentSearches,
    updateProduct,
    filteredGroupCount,
    totalCatalogCount,
    withImagesCount,
    cacheIsSlim,
  } = useCatalog();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [activeLocale, setActiveLocale] = useState('ES');
  const [isProductDirty, setIsProductDirty] = useState(false);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [isSavedViewsOpen, setIsSavedViewsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const activeFilterCount = [
    searchTerm.trim(),
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
  ].filter(Boolean).length;
  const closingProductIdRef = useRef<string | null>(null);
  const visibleCatalogCount = totalCatalogCount;
  const queryParams = new URLSearchParams(location.search);
  const productIdFromUrl = queryParams.get('producto');
  const selectedDisplayProductId = selectedProduct?.variantParentId || selectedProduct?.id || '';
  const selectedProductIndex = selectedProduct
    ? displayProducts.findIndex(product => product.id === selectedDisplayProductId)
    : -1;
  const updateProductUrl = useCallback((productId: string | null) => {
    const nextParams = new URLSearchParams(location.search);
    if (productId) {
      nextParams.set('producto', productId);
    } else {
      nextParams.delete('producto');
    }

    const nextSearch = nextParams.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true, preventScrollReset: true }
    );
  }, [location.search, location.pathname, navigate]);

  const handleOpenProduct = useCallback((product: Product) => {
    setSelectedProduct(product);
    updateProductUrl(product.id);
  }, [setSelectedProduct, updateProductUrl]);

  const handleCloseProduct = useCallback(() => {
    if (selectedProduct) closingProductIdRef.current = selectedProduct.id;
    setSelectedProduct(null);
    updateProductUrl(null);
  }, [selectedProduct, setSelectedProduct, updateProductUrl]);

  const handlePrevProduct = () => {
    if (selectedProductIndex <= 0) return;
    const previousProduct = displayProducts[selectedProductIndex - 1] || null;
    if (!previousProduct) return;
    handleOpenProduct(previousProduct);
  };

  const handleNextProduct = () => {
    if (selectedProductIndex < 0 || selectedProductIndex >= displayProducts.length - 1) return;
    const nextProduct = displayProducts[selectedProductIndex + 1] || null;
    if (!nextProduct) return;
    handleOpenProduct(nextProduct);
  };
  const handleSaveProduct = (patch: Partial<Product>) => {
    if (!selectedProduct) return;
    updateProduct(selectedProduct.id, patch);
    showToast('Cambios guardados', 'success');
  };

  const handleTenantChange = async (tenantId: string) => {
    if (isProductDirty && selectedProduct) {
      const ok = await confirm({
        message: 'Hay cambios sin guardar en el producto abierto. ¿Cambiar de tenant de todas formas?',
        confirmLabel: 'Cambiar',
        danger: true,
      });
      if (!ok) return;
    }
    setSelectedTenantId(tenantId);
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  const productById = useMemo(
    () => new Map(products.map(p => [p.id, p])),
    [products]
  );

  useEffect(() => {
    if (!productIdFromUrl || selectedProduct) return;
    if (closingProductIdRef.current === productIdFromUrl) {
      closingProductIdRef.current = null;
      return;
    }

    const target =
      productById.get(productIdFromUrl) ||
      displayProducts.find(product => product.id === productIdFromUrl) ||
      (() => {
        for (const [, p] of productById) {
          if (Array.isArray(p.variants) && p.variants.some((v: { id?: string }) => v.id === productIdFromUrl)) {
            return p;
          }
        }
        return undefined;
      })();

    if (target) {
      setSelectedProduct(target);
      return;
    }

    let cancelled = false;
    const loadDirectProduct = async () => {
      try {
        const detail = await fetchProductDetail(selectedTenantId, productIdFromUrl);
        if (!cancelled) setSelectedProduct(detail);
      } catch {
        // keep current page visible if deep-link load fails
      }
    };

    void loadDirectProduct();
    return () => {
      cancelled = true;
    };
  }, [displayProducts, productById, productIdFromUrl, selectedProduct, selectedTenantId, setSelectedProduct]);

  useEffect(() => {
    if (!selectedProduct?.id) return;

    let cancelled = false;
    const selectedId = selectedProduct.id;

    const loadProductDetail = async () => {
      try {
        const detail = await fetchProductDetail(selectedTenantId, selectedId);
        if (cancelled) return;
        setSelectedProduct(prev =>
          prev && prev.id === selectedId
            ? {
                ...prev,
                ...detail,
                variants: prev.variants,
              }
            : prev
        );
      } catch {
        // keep lightweight catalog version if detail fetch fails
      }
    };

    void loadProductDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedProduct?.id, selectedTenantId, setSelectedProduct]);

  useEffect(() => {
    if (!cacheIsSlim) return;
    const id = setInterval(() => { void reloadProducts(); }, 60_000);
    return () => clearInterval(id);
  }, [cacheIsSlim, reloadProducts]);

  const gridGapClass = settings.density === 'compact' ? 'gap-4' : 'gap-6';
  const theme = resolveCatalogTheme(settings.paletteId, settings.customAccentHex);
  const sortControl = (
    <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Ordenar por</span>
      <select
        value={sortBy}
        onChange={event => setSortBy(event.target.value as CatalogSortKey)}
        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 outline-none transition focus:border-[color:var(--catalog-accent)] focus:ring-4 focus:ring-[color:var(--catalog-accent-soft)]"
      >
        <option value="relevance">Relevancia</option>
        <option value="name_asc">{'Nombre A→Z'}</option>
        <option value="name_desc">{'Nombre Z→A'}</option>
        <option value="sku_asc">SKU ascendente</option>
        <option value="updated_desc">{'Actualizado más reciente'}</option>
        <option value="variants_desc">{'Más acabados primero'}</option>
      </select>
    </div>
  );
  const appStyle = {
    '--catalog-accent': theme.accent,
    '--catalog-accent-strong': theme.accentStrong,
    '--catalog-accent-soft': theme.accentSoft,
    '--catalog-accent-ink': theme.accentInk,
    '--catalog-page-start': theme.pageStart,
    '--catalog-page-end': theme.pageEnd,
  } as React.CSSProperties;

  useEffect(() => {
    const faviconHref = settings.faviconUrl || branding?.logoUrl;
    if (typeof document === 'undefined' || !faviconHref) return;

    let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.head.appendChild(favicon);
    }

    favicon.href = faviconHref;
  }, [branding?.logoUrl, settings.faviconUrl]);

  return (
    <div
      className="min-h-screen bg-[linear-gradient(180deg,var(--catalog-page-start)_0%,var(--catalog-page-end)_100%)] text-slate-900"
      style={appStyle}
    >
      {isMobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filtros">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setIsMobileFiltersOpen(false)} />
          <div className="absolute left-0 top-0 flex h-full w-[min(100vw-3rem,24rem)] flex-col overflow-hidden bg-white shadow-2xl">
            <div className="flex-1 overflow-y-auto p-4">
              <FiltersSidebar
                products={products}
                summaryProductsCount={totalCatalogCount}
                summaryWithImagesCount={withImagesCount}
                brandOptions={brandOptions}
                rangeOptions={rangeOptions}
                flowOptions={flowOptions}
                finishOptions={finishOptions}
                priceRange={priceRange}
                selectedBrand={selectedBrand}
                onBrandChange={setSelectedBrand}
                categoryTree={categoryTree}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                typeOptions={typeOptions}
                selectedType={selectedType}
                onTypeChange={setSelectedType}
                statusOptions={statusOptions}
                selectedStatus={selectedStatus}
                onStatusChange={setSelectedStatus}
                selectedMediaFilter={selectedMediaFilter}
                onMediaFilterChange={setSelectedMediaFilter}
                selectedQuickFilter={selectedQuickFilter}
                selectedName={selectedName}
                onNameChange={setSelectedName}
                selectedNumber={selectedNumber}
                onNumberChange={setSelectedNumber}
                selectedCollection={selectedCollection}
                onCollectionChange={setSelectedCollection}
                selectedRange={selectedRange}
                onRangeChange={setSelectedRange}
                selectedPriceMin={selectedPriceMin}
                onPriceMinChange={setSelectedPriceMin}
                selectedPriceMax={selectedPriceMax}
                onPriceMaxChange={setSelectedPriceMax}
                selectedEan={selectedEan}
                onEanChange={setSelectedEan}
                selectedFlow={selectedFlow}
                onFlowChange={setSelectedFlow}
                selectedFinish={selectedFinish}
                onFinishChange={setSelectedFinish}
                selectedAttributeQuery={selectedAttributeQuery}
                onAttributeQueryChange={setSelectedAttributeQuery}
                onClearFilters={handleClearFilters}
              />
            </div>
            <div className="border-t border-slate-200 bg-white p-4">
              <button
                type="button"
                onClick={() => setIsMobileFiltersOpen(false)}
                className="w-full rounded-2xl bg-[color:var(--catalog-accent)] py-3 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Ver {filteredGroupCount} productos
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsMobileFiltersOpen(true)}
        className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 inline-flex items-center gap-2 rounded-full bg-[color:var(--catalog-accent)] px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-90 lg:hidden"
        aria-label="Abrir filtros"
      >
        <SlidersHorizontal className="h-4 w-4" />
        Filtros
        {activeFilterCount > 0 && (
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-[color:var(--catalog-accent)]">
            {activeFilterCount}
          </span>
        )}
      </button>

      <main className="w-full px-4 py-4 sm:px-6 sm:py-6 xl:px-8">
        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorMessage message={error} onRetry={reloadProducts} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[clamp(310px,21vw,360px)_minmax(0,1fr)]">
            <aside className="hidden lg:block">
              <CatalogSidebar
                logoUrl={branding?.logoUrl ?? settings.logoUrl}
                activeViewName={activeSavedView?.name ?? null}
                tenantOptions={tenantOptions}
                selectedTenantId={selectedTenantId}
                accessMode={CATALOG_ACCESS_MODE}
                onTenantChange={handleTenantChange}
                userEmail={user?.email ?? null}
                userFullName={profile?.fullName ?? null}
                onOpenProfile={() => setIsProfileOpen(true)}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onSignOut={signOut}
              >
                <FiltersSidebar
                  products={products}
                  summaryProductsCount={totalCatalogCount}
                  summaryWithImagesCount={withImagesCount}
                  brandOptions={brandOptions}
                  rangeOptions={rangeOptions}
                  flowOptions={flowOptions}
                  finishOptions={finishOptions}
                  priceRange={priceRange}
                  selectedBrand={selectedBrand}
                  onBrandChange={setSelectedBrand}
                  categoryTree={categoryTree}
                  selectedCategory={selectedCategory}
                  onCategoryChange={setSelectedCategory}
                  typeOptions={typeOptions}
                  selectedType={selectedType}
                  onTypeChange={setSelectedType}
                  statusOptions={statusOptions}
                  selectedStatus={selectedStatus}
                  onStatusChange={setSelectedStatus}
                  selectedMediaFilter={selectedMediaFilter}
                  onMediaFilterChange={setSelectedMediaFilter}
                  selectedQuickFilter={selectedQuickFilter}
                  selectedName={selectedName}
                  onNameChange={setSelectedName}
                  selectedNumber={selectedNumber}
                  onNumberChange={setSelectedNumber}
                  selectedCollection={selectedCollection}
                  onCollectionChange={setSelectedCollection}
                  selectedRange={selectedRange}
                  onRangeChange={setSelectedRange}
                  selectedPriceMin={selectedPriceMin}
                  onPriceMinChange={setSelectedPriceMin}
                  selectedPriceMax={selectedPriceMax}
                  onPriceMaxChange={setSelectedPriceMax}
                  selectedEan={selectedEan}
                  onEanChange={setSelectedEan}
                  selectedFlow={selectedFlow}
                  onFlowChange={setSelectedFlow}
                  selectedFinish={selectedFinish}
                  onFinishChange={setSelectedFinish}
                  selectedAttributeQuery={selectedAttributeQuery}
                  onAttributeQueryChange={setSelectedAttributeQuery}
                  onClearFilters={handleClearFilters}
                  embedded
                />
              </CatalogSidebar>
            </aside>

            <section className="min-w-0">
              <CatalogHeader
                searchTerm={searchTerm}
                onSearchTermChange={setSearchTerm}
                onSearchSubmit={commitSearchTerm}
                recentSearches={recentSearches}
                onRecentSearchSelect={commitSearchTerm}
                onClearRecentSearches={clearRecentSearches}
                productsCount={visibleCatalogCount}
                filteredCount={filteredGroupCount}
                activeViewName={activeSavedView?.name ?? null}
                logoUrl={branding?.logoUrl ?? settings.logoUrl}
                tenantOptions={tenantOptions}
                selectedTenantId={selectedTenantId}
                accessMode={CATALOG_ACCESS_MODE}
                onTenantChange={handleTenantChange}
                sortControl={sortControl}
                userEmail={user?.email ?? null}
                userFullName={profile?.fullName ?? null}
                onOpenProfile={() => setIsProfileOpen(true)}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onSignOut={signOut}
              />

              {activeFilterCount > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {searchTerm.trim() ? <FilterChip label={`"${searchTerm}"`} onRemove={() => { setSearchTerm(''); commitSearchTerm(''); }} /> : null}
                  {selectedName.trim() ? <FilterChip label={`Nombre: ${selectedName}`} onRemove={() => setSelectedName('')} /> : null}
                  {selectedNumber.trim() ? <FilterChip label={`SKU: ${selectedNumber}`} onRemove={() => setSelectedNumber('')} /> : null}
                  {selectedCollection.trim() ? <FilterChip label={`Colección: ${selectedCollection}`} onRemove={() => setSelectedCollection('')} /> : null}
                  {selectedRange.trim() ? <FilterChip label={`Gama: ${rangeOptions.find(option => option.id === selectedRange)?.label ?? selectedRange}`} onRemove={() => setSelectedRange('')} /> : null}
                  {selectedPriceMin.trim() ? <FilterChip label={`Precio mín.: ${selectedPriceMin} €`} onRemove={() => setSelectedPriceMin('')} /> : null}
                  {selectedPriceMax.trim() ? <FilterChip label={`Precio máx.: ${selectedPriceMax} €`} onRemove={() => setSelectedPriceMax('')} /> : null}
                  {selectedEan.trim() ? <FilterChip label={`EAN: ${selectedEan}`} onRemove={() => setSelectedEan('')} /> : null}
                  {selectedFlow.trim() ? <FilterChip label={`Caudal: ${flowOptions.find(option => option.id === selectedFlow)?.label ?? selectedFlow}`} onRemove={() => setSelectedFlow('')} /> : null}
                  {selectedFinish.trim() ? <FilterChip label={`Acabado: ${finishOptions.find(option => option.id === selectedFinish)?.label ?? selectedFinish}`} onRemove={() => setSelectedFinish('')} /> : null}
                  {selectedAttributeQuery.trim() ? <FilterChip label={`Atributo: ${selectedAttributeQuery}`} onRemove={() => setSelectedAttributeQuery('')} /> : null}
                  {selectedBrand !== 'all' ? <FilterChip label={brandOptions.find(b => b.id === selectedBrand)?.label ?? selectedBrand} onRemove={() => setSelectedBrand('all')} /> : null}
                  {selectedCategory !== 'all' ? <FilterChip label={categoryLabelMap[selectedCategory] ?? selectedCategory} onRemove={() => setSelectedCategory('all')} /> : null}
                  {selectedType !== 'all' ? <FilterChip label={typeOptions.find(t => t.id === selectedType)?.label ?? selectedType} onRemove={() => setSelectedType('all')} /> : null}
                  {selectedStatus !== 'all' ? <FilterChip label={statusOptions.find(s => s.id === selectedStatus)?.label ?? selectedStatus} onRemove={() => setSelectedStatus('all')} /> : null}
                  {selectedMediaFilter !== 'all' ? <FilterChip label={selectedMediaFilter} onRemove={() => setSelectedMediaFilter('all')} /> : null}
                  <button type="button" onClick={handleClearFilters} className="text-xs font-semibold text-slate-500 underline transition hover:text-slate-700">
                    Limpiar todo
                  </button>
                </div>
              )}

              <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
                <div className="flex items-center gap-2">
                  {savedViews.length > 0 && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsSavedViewsOpen(prev => !prev)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        Vistas ({savedViews.length})
                      </button>
                      {isSavedViewsOpen && (
                        <div className="absolute right-0 top-full z-30 mt-1 min-w-[180px] rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lg">
                          {(savedViews as any[]).map(view => (
                            <button
                              key={view.name}
                              type="button"
                              onClick={() => {
                                applySavedView(view.name);
                                setIsSavedViewsOpen(false);
                              }}
                              className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                              {view.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsSettingsOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--catalog-accent-soft)] bg-[color:var(--catalog-accent-soft)]/60 px-3 py-1.5 text-xs font-semibold text-[color:var(--catalog-accent)] transition hover:bg-[color:var(--catalog-accent-soft)]"
                    >
                      Guardar vista
                    </button>
                  )}
                </div>
              </div>

              {displayProducts.length === 0 ? (
                <div className="rounded-[28px] border border-slate-200 bg-white px-8 py-16 text-center shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
                  <div className="mx-auto mb-5 inline-flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
                    <Package className="h-10 w-10 text-slate-400" />
                  </div>
                  <h3 className="mb-2 text-xl font-semibold text-slate-900">No se encontraron productos</h3>
                  <p className="text-slate-600">
                    {searchTerm ||
                    selectedName ||
                    selectedNumber ||
                    selectedCollection ||
                    selectedRange ||
                    selectedPriceMin ||
                    selectedPriceMax ||
                    selectedEan ||
                    selectedFlow ||
                    selectedFinish ||
                    selectedAttributeQuery ||
                    selectedBrand !== 'all' ||
                    selectedCategory !== 'all' ||
                    selectedType !== 'all' ||
                    selectedStatus !== 'all' ||
                    selectedMediaFilter !== 'all'
                      ? 'Intenta ajustar la búsqueda o limpiar los filtros activos.'
                      : 'No hay productos disponibles en este momento.'}
                  </p>
                </div>
              ) : (
                <>
                  {cacheIsSlim && (
                    <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
                      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                      Vista preliminar — el catálogo completo se carga en segundo plano y se actualizará automáticamente.
                    </div>
                  )}
                  <div className={`grid grid-cols-1 ${gridGapClass} md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4`}>
                    {paginatedProducts.map(product => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        tenantId={selectedTenantId}
                        categoryLabelMap={categoryLabelMap}
                        onViewDetails={handleOpenProduct}
                      />
                    ))}
                  </div>

                  {totalPages > 1 && (
                    <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                      <p className="w-full text-center text-sm text-slate-500">
                        Página {currentPage} de {totalPages}
                      </p>
                      <button
                        onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                        disabled={currentPage === 1}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Página anterior"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Anterior
                      </button>

                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                          const visible =
                            page === 1 || page === totalPages || (page >= currentPage - 2 && page <= currentPage + 2);
                          if (!visible) return null;

                          return (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              aria-label={currentPage === page ? 'Página actual' : `Ir a la página ${page}`}
                              aria-current={currentPage === page ? 'page' : undefined}
                              className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                              currentPage === page
                                  ? 'bg-[var(--catalog-accent)] text-white shadow-[0_8px_18px_rgba(20,61,107,0.22)]'
                                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              {page}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
                        disabled={currentPage === totalPages}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Página siguiente"
                      >
                        Siguiente
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </main>

      {selectedProduct && (
        <ErrorBoundary>
        <Suspense fallback={<LoadingSpinner />}>
        <ProductModal
          product={selectedProduct}
          categoryLabelMap={categoryLabelMap}
          catalogProducts={products}
          onClose={handleCloseProduct}
          onPrev={selectedProductIndex > 0 ? handlePrevProduct : undefined}
          onNext={selectedProductIndex >= 0 && selectedProductIndex < displayProducts.length - 1 ? handleNextProduct : undefined}
          activeLocale={activeLocale}
          onLocaleChange={setActiveLocale}
          onSave={handleSaveProduct}
          parentProduct={
            selectedProduct?.variantParentId
              ? products.find(product => product.id === selectedProduct.variantParentId) || null
              : null
          }
          currentUserRole={currentUserRole}
          tenantId={selectedTenantId}
          onDirtyChange={setIsProductDirty}
          onAddVariant={() => {
            if (!selectedProduct) return;
            const parent = selectedProduct?.variantParentId
              ? products.find(product => product.id === selectedProduct.variantParentId)
              : selectedProduct;
            if (parent) handleOpenProduct(parent);
          }}
          onNavigateBreadcrumb={(segment, value) => {
            if (segment === 'catalog') {
              handleCloseProduct();
              return;
            }

            if (segment === 'category' && value) {
              setSelectedCategory(value);
              handleCloseProduct();
              return;
            }

            if (segment === 'product' && value) {
              const target =
                products.find(product => product.id === value) ||
                selectedProduct?.variants?.find((variant: any) => variant.id === value);
              if (target) {
                handleOpenProduct(target as Product);
              }
            }
          }}
        />
        </Suspense>
        </ErrorBoundary>
      )}

      <CatalogSettingsModal
        open={isSettingsOpen}
        settings={settings}
        onChange={setSettings}
        onClose={() => setIsSettingsOpen(false)}
        onReset={restoreDefaultSettings}
        savedViews={savedViews}
        savedViewName={savedViewName}
        onSavedViewNameChange={setSavedViewName}
        onSaveView={saveCurrentView}
        onApplyView={applySavedView}
        onDeleteView={deleteSavedView}
        onCopyCurrentViewLink={copyShareableLink}
        shareableLink={shareableLink}
        shareMessage={shareMessage}
        shareError={shareError}
      />
      <UserProfileModal
        open={isProfileOpen}
        email={user?.email ?? null}
        fullName={profile?.fullName ?? null}
        role={profile?.role ?? null}
        organizationName={tenantOptions.find(option => option.id === selectedTenantId)?.label ?? null}
        onClose={() => setIsProfileOpen(false)}
      />
    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,var(--catalog-page-start)_0%,var(--catalog-page-end)_100%)] text-slate-900">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function RequireRole({
  role,
  children,
}: {
  role: 'superadmin';
  children: React.ReactNode;
}) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,var(--catalog-page-start)_0%,var(--catalog-page-end)_100%)] text-slate-900">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (profile?.role !== role) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
      <ConfirmDialogProvider>
      <Routes>
        <Route
          path="/login"
          element={
            <Suspense fallback={<LoadingSpinner />}>
              <LoginPage />
            </Suspense>
          }
        />
        <Route
          path="/superadmin"
          element={
            <Suspense fallback={<LoadingSpinner />}>
              <RequireRole role="superadmin">
                <SuperadminPage />
              </RequireRole>
            </Suspense>
          }
        />
        <Route
          path="*"
          element={
            <PrivateRoute>
              <CatalogPage />
            </PrivateRoute>
          }
        />
      </Routes>
      </ConfirmDialogProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
