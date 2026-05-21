import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Package } from 'lucide-react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '../shared/ui/LoadingSpinner';
import { ErrorMessage } from '../shared/ui/ErrorMessage';
import { FiltersSidebar } from '../features/catalog/ui/FiltersSidebar';
import { ProductCard } from '../features/catalog/ui/ProductCard';
import { ProductModal } from '../features/catalog/ui/ProductModal';
import { CatalogHeader } from '../features/catalog/ui/CatalogHeader';
import { CatalogSettingsModal } from '../features/catalog/ui/CatalogSettingsModal';
import { useCatalog } from '../features/catalog/state/useCatalog';
import { useAuth } from '../hooks/useAuth';
import { useTenantBranding } from '../hooks/useTenantBranding';
import type { CatalogSortKey, QuickFilter } from '../features/catalog/model/catalogTypes';
import type { Product } from '../features/catalog/api/productService';
import LoginPage from '../pages/LoginPage';
import SuperadminPage from '../pages/SuperadminPage';
import { normalizeKey } from '../features/catalog/selectors/catalogSelectors';
import { resolveCatalogTheme } from '../shared/theme/catalogThemes';
import { CATALOG_ACCESS_MODE } from '../shared/config/catalogTenant';

function CatalogPage() {
  const { profile, signOut } = useAuth();
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
    setSearchTerm,
    setSelectedName,
    setSelectedNumber,
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
    setSelectedQuickFilter,
    sortBy,
    setSortBy,
    currentPage,
    setCurrentPage,
    isSettingsOpen,
    setIsSettingsOpen,
    brandOptions,
    categoryOptions,
    categoryTree,
    categoryLabelMap,
    typeOptions,
    statusOptions,
    displayProducts,
    handleClearFilters,
    totalPages,
    paginatedProducts,
    imageCount,
    attachmentCount,
    assetCount,
    withImagesCount,
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
  } = useCatalog();
  const [activeLocale, setActiveLocale] = useState('ES');
  const visibleCatalogCount = products.filter(product => normalizeKey(product.type) !== 'variant').length;
  const queryParams = new URLSearchParams(location.search);
  const productIdFromUrl = queryParams.get('producto');
  const selectedDisplayProductId = selectedProduct?.variantParentId || selectedProduct?.id || '';
  const selectedProductIndex = selectedProduct
    ? displayProducts.findIndex(product => product.id === selectedDisplayProductId)
    : -1;
  const updateProductUrl = (productId: string | null) => {
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
  };

  const handleOpenProduct = (product: Product) => {
    setSelectedProduct(product);
    updateProductUrl(product.id);
  };

  const handleCloseProduct = () => {
    setSelectedProduct(null);
    updateProductUrl(null);
  };

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
  const handleSaveProduct = (patch: Record<string, unknown>) => {
    if (!selectedProduct) return;
    updateProduct(selectedProduct.id, patch as any);
  };

  useEffect(() => {
    if (!productIdFromUrl || selectedProduct) return;

    const target =
      products.find(product => product.id === productIdFromUrl) ||
      displayProducts.find(product => product.id === productIdFromUrl) ||
      products.find(product => Array.isArray((product as any).variants) && (product as any).variants.some((variant: any) => variant.id === productIdFromUrl));

    if (target) {
      setSelectedProduct(target);
    }
  }, [productIdFromUrl, products, displayProducts, selectedProduct, setSelectedProduct]);

  const gridGapClass = settings.density === 'compact' ? 'gap-4' : 'gap-6';
  const theme = resolveCatalogTheme(settings.paletteId);
  const appStyle = {
    '--catalog-accent': theme.accent,
    '--catalog-accent-strong': theme.accentStrong,
    '--catalog-accent-soft': theme.accentSoft,
    '--catalog-accent-ink': theme.accentInk,
    '--catalog-page-start': theme.pageStart,
    '--catalog-page-end': theme.pageEnd,
  } as React.CSSProperties;

  const handleStatFilterClick = (filter: 'images' | 'attachments' | 'images-only' | 'categories' | 'assets') => {
    if (filter === 'images-only') {
      setSelectedQuickFilter('all');
      setSelectedMediaFilter(selectedMediaFilter === 'images-only' ? 'all' : 'images-only');
      return;
    }

    const nextQuickFilter: QuickFilter = filter === 'images'
      ? 'images'
      : filter === 'attachments'
        ? 'attachments'
        : filter === 'categories'
          ? 'categories'
          : 'assets';

    const isActive =
      (nextQuickFilter === 'images' && selectedQuickFilter === 'images') ||
      (nextQuickFilter === 'attachments' && selectedQuickFilter === 'attachments') ||
      (nextQuickFilter === 'categories' && selectedQuickFilter === 'categories') ||
      (nextQuickFilter === 'assets' && selectedQuickFilter === 'assets');

    setSelectedMediaFilter('all');
    setSelectedQuickFilter(isActive ? 'all' : nextQuickFilter);
  };

  return (
    <div
      className="min-h-screen bg-[linear-gradient(180deg,var(--catalog-page-start)_0%,var(--catalog-page-end)_100%)] text-slate-900"
      style={appStyle}
    >
      <CatalogHeader
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        onSearchSubmit={commitSearchTerm}
        recentSearches={recentSearches}
        onRecentSearchSelect={commitSearchTerm}
        onClearRecentSearches={clearRecentSearches}
        productsCount={visibleCatalogCount}
        filteredCount={displayProducts.length}
        imageCount={imageCount}
        attachmentCount={attachmentCount}
        withImagesCount={withImagesCount}
        categoryCount={categoryOptions.length}
        assetCount={assetCount}
        activeViewName={activeSavedView?.name ?? null}
        logoUrl={branding?.logoUrl ?? settings.logoUrl}
        tenantOptions={tenantOptions}
        selectedTenantId={selectedTenantId}
        accessMode={CATALOG_ACCESS_MODE}
        onTenantChange={setSelectedTenantId}
        selectedQuickFilter={selectedQuickFilter}
        selectedMediaFilter={selectedMediaFilter}
        onStatFilterClick={handleStatFilterClick}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onSignOut={signOut}
      />

      <main className="w-full px-4 py-4 sm:px-6 sm:py-6 xl:px-8">
        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorMessage message={error} onRetry={reloadProducts} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[clamp(300px,20vw,360px)_minmax(0,1fr)]">
            <aside className="hidden lg:block">
              <FiltersSidebar
                products={products}
                brandOptions={brandOptions}
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
                selectedName={selectedName}
                onNameChange={setSelectedName}
                selectedNumber={selectedNumber}
                onNumberChange={setSelectedNumber}
                onClearFilters={handleClearFilters}
              />
            </aside>

            <section className="min-w-0">
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
                  <div className="mb-4 flex items-center justify-end">
                    <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-sm">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Ordenar por
                      </span>
                      <select
                        value={sortBy}
                        onChange={event => setSortBy(event.target.value as CatalogSortKey)}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 outline-none transition focus:border-[color:var(--catalog-accent)] focus:ring-4 focus:ring-[color:var(--catalog-accent-soft)]"
                      >
                        <option value="relevance">Relevancia</option>
                        <option value="name_asc">Nombre A→Z</option>
                        <option value="name_desc">Nombre Z→A</option>
                        <option value="sku_asc">SKU ascendente</option>
                        <option value="updated_desc">Actualizado más reciente</option>
                        <option value="variants_desc">Más acabados primero</option>
                      </select>
                    </div>
                  </div>

                  <div className={`grid grid-cols-1 ${gridGapClass} md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4`}>
                    {paginatedProducts.map(product => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        categoryLabelMap={categoryLabelMap}
                        onViewDetails={handleOpenProduct}
                      />
                    ))}
                  </div>

                  {totalPages > 1 && (
                    <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                      <button
                        onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                        disabled={currentPage === 1}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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
        <ProductModal
          product={selectedProduct}
          categoryLabelMap={categoryLabelMap}
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
              const target = products.find(product => product.id === value) || selectedProduct?.variants?.find((variant: any) => variant.id === value);
              if (target) {
                handleOpenProduct(target);
              }
            }
          }}
        />
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
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/superadmin"
          element={
            <RequireRole role="superadmin">
              <SuperadminPage />
            </RequireRole>
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
    </BrowserRouter>
  );
}

export default App;
