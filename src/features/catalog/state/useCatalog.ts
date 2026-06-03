import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CATALOG_ACCESS_MODE,
  CATALOG_DEFAULT_TENANT_ID,
  CATALOG_TENANT_OPTIONS,
  type CatalogTenantOption,
} from '../../../shared/config/catalogTenant';
import type {
  CatalogQueryParams,
  CatalogSortKey,
  CategoryOption,
  MediaFilter,
  QuickFilter,
  SavedViewSnapshot,
} from '../model/catalogTypes';
import type { Product } from '../api/productService';
import { cleanText } from '../selectors/catalogSelectors';
import { useCatalogSettings } from './useCatalogSettings';
import { decodeShareableState, useSavedViews } from './useSavedViews';
import { useProductFetcher } from './useProductFetcher';

const SELECTED_TENANT_KEY = 'content-store.selected-tenant.v1';
const RECENT_SEARCHES_KEY = 'content-store.recent-searches.v1';
const SHAREABLE_VIEW_QUERY_KEY = 'view';
const MAX_RECENT_SEARCHES = 6;
const DEFAULT_SORT_BY: CatalogSortKey = 'relevance';

const loadSelectedTenant = (): string => {
  if (typeof window === 'undefined') return CATALOG_DEFAULT_TENANT_ID;
  try {
    const raw = window.localStorage.getItem(SELECTED_TENANT_KEY);
    if (raw && CATALOG_TENANT_OPTIONS.some(option => option.id === raw)) return raw;
  } catch {
    return CATALOG_DEFAULT_TENANT_ID;
  }
  return CATALOG_DEFAULT_TENANT_ID;
};

const loadRecentSearches = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item => typeof item === 'string' && item.trim());
  } catch {
    return [];
  }
};

const flattenCategoryTree = (tree: Array<{ id: string; label: string; count: number; children: CategoryOption[] }>): CategoryOption[] =>
  tree.flatMap(node => node.children.map(child => ({ id: child.id, label: child.label, count: child.count })));

const buildCurrentSnapshot = (
  searchTerm: string,
  selectedName: string,
  selectedNumber: string,
  selectedNumberOperator: 'contains' | 'is' | 'starts_with' | 'is_not',
  selectedCollection: string,
  selectedRange: string,
  selectedVariantGroup: string,
  selectedPriceMin: string,
  selectedPriceMax: string,
  selectedEan: string,
  selectedFlow: string,
  selectedFinish: string,
  selectedAttributeQuery: string,
  selectedBrand: string,
  selectedCategory: string,
  selectedType: string,
  selectedStatus: string,
  selectedMediaFilter: MediaFilter,
  selectedQuickFilter: QuickFilter,
  tenantId: string,
  settings: ReturnType<typeof useCatalogSettings>['settings']
): SavedViewSnapshot => ({
  tenantId,
  searchTerm,
  selectedName,
  selectedNumber,
  selectedNumberOperator,
  selectedCollection,
  selectedRange,
  selectedVariantGroup,
  selectedPriceMin,
  selectedPriceMax,
  selectedEan,
  selectedFlow,
  selectedFinish,
  selectedAttributeQuery,
  selectedBrand,
  selectedCategory,
  selectedType,
  selectedStatus,
  selectedMediaFilter,
  selectedQuickFilter,
  settings: { ...settings },
});

export function useCatalog() {
  const [selectedTenantId, setSelectedTenantId] = useState<string>(() => loadSelectedTenant());
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [selectedNumber, setSelectedNumber] = useState('');
  const [selectedNumberOperator, setSelectedNumberOperator] = useState<'contains' | 'is' | 'starts_with' | 'is_not'>('contains');
  const [selectedCollection, setSelectedCollection] = useState('');
  const [selectedRange, setSelectedRange] = useState('');
  const [selectedVariantGroup, setSelectedVariantGroup] = useState('');
  const [selectedPriceMin, setSelectedPriceMin] = useState('');
  const [selectedPriceMax, setSelectedPriceMax] = useState('');
  const [selectedEan, setSelectedEan] = useState('');
  const [selectedFlow, setSelectedFlow] = useState('');
  const [selectedFinish, setSelectedFinish] = useState('');
  const [selectedAttributeQuery, setSelectedAttributeQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedMediaFilter, setSelectedMediaFilter] = useState<MediaFilter>('all');
  const [selectedQuickFilter, setSelectedQuickFilter] = useState<QuickFilter>('all');
  const [sortBy, setSortBy] = useState<CatalogSortKey>(DEFAULT_SORT_BY);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => loadRecentSearches());
  const [currentPage, setCurrentPage] = useState(1);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hasAppliedSharedView, setHasAppliedSharedView] = useState(false);
  const [tenantOptions, setTenantOptions] = useState<CatalogTenantOption[]>(() => CATALOG_TENANT_OPTIONS);
  const hasFetchedOrganizationsRef = useRef(false);

  const { settings, setSettings, setSettingsForTenant, restoreDefaultSettings, saveSettings, saveState } =
    useCatalogSettings(selectedTenantId);

  const catalogQuery = useMemo<CatalogQueryParams>(
    () => ({
      tenantId: selectedTenantId,
      page: currentPage,
      pageSize: settings.pageSize,
      sortBy,
      searchTerm,
      selectedName,
      selectedNumber,
      selectedNumberOperator,
      selectedCollection,
      selectedRange,
      selectedVariantGroup,
      selectedPriceMin,
      selectedPriceMax,
      selectedEan,
      selectedFlow,
      selectedFinish,
      selectedAttributeQuery,
      selectedBrand,
      selectedCategory,
      selectedType,
      selectedStatus,
      selectedMediaFilter,
      selectedQuickFilter,
    }),
    [
      currentPage,
      searchTerm,
      selectedAttributeQuery,
      selectedBrand,
      selectedCategory,
      selectedMediaFilter,
      selectedName,
      selectedNumber,
      selectedNumberOperator,
      selectedCollection,
      selectedRange,
      selectedVariantGroup,
      selectedPriceMin,
      selectedPriceMax,
      selectedEan,
      selectedFlow,
      selectedFinish,
      selectedQuickFilter,
      selectedStatus,
      selectedTenantId,
      selectedType,
      settings.pageSize,
      sortBy,
    ]
  );

  const { products, meta, loading, error, reloadProducts, updateProduct: fetcherUpdateProduct } =
    useProductFetcher(catalogQuery);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedProduct(null);
  }, [selectedTenantId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SELECTED_TENANT_KEY, selectedTenantId);
  }, [selectedTenantId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recentSearches));
  }, [recentSearches]);

  useEffect(() => {
    let cancelled = false;

    const loadOrganizations = async () => {
      try {
        const response = await fetch('/api/organizations', { headers: { accept: 'application/json' } });
        if (!response.ok) return;
        const data = await response.json();
        const organizations = Array.isArray(data?.organizations)
          ? data.organizations
          : Array.isArray(data)
            ? data
            : [];
        const nextOptions = organizations
          .map((item: { id?: unknown; label?: unknown; description?: unknown }) => ({
            id: typeof item.id === 'string' ? item.id.trim() : '',
            label: cleanText(item.label ?? '').trim(),
            description:
              typeof item.description === 'string' ? cleanText(item.description).trim() : undefined,
          }))
          .filter((item: CatalogTenantOption) => Boolean(item.id && item.label));
        if (cancelled || nextOptions.length === 0) return;
        setTenantOptions(nextOptions);
      } catch {
        // keep env fallback
      }
    };

    const shouldHydrateOrganizations =
      CATALOG_ACCESS_MODE === 'admin' ||
      (tenantOptions.length === 1 && tenantOptions[0]?.id === CATALOG_DEFAULT_TENANT_ID);

    if (shouldHydrateOrganizations && !hasFetchedOrganizationsRef.current) {
      hasFetchedOrganizationsRef.current = true;
      void loadOrganizations();
    }

    return () => {
      cancelled = true;
    };
  }, [tenantOptions]);

  useEffect(() => {
    if (!tenantOptions.some(option => option.id === selectedTenantId)) {
      setSelectedTenantId(tenantOptions[0]?.id || CATALOG_DEFAULT_TENANT_ID);
    }
  }, [tenantOptions, selectedTenantId]);

  useEffect(() => {
    if (typeof window === 'undefined' || hasAppliedSharedView) return;
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get(SHAREABLE_VIEW_QUERY_KEY);
    if (!encoded) return;
    const nextView = decodeShareableState(encoded);
    if (!nextView) return;

    setSelectedTenantId(nextView.tenantId || CATALOG_DEFAULT_TENANT_ID);
    setSearchTerm(nextView.searchTerm);
    setSelectedName(nextView.selectedName || '');
    setSelectedNumber(nextView.selectedNumber || '');
    setSelectedNumberOperator(nextView.selectedNumberOperator || 'contains');
    setSelectedCollection(nextView.selectedCollection || '');
    setSelectedRange(nextView.selectedRange || '');
    setSelectedVariantGroup(nextView.selectedVariantGroup || '');
    setSelectedPriceMin(nextView.selectedPriceMin || '');
    setSelectedPriceMax(nextView.selectedPriceMax || '');
    setSelectedEan(nextView.selectedEan || '');
    setSelectedFlow(nextView.selectedFlow || '');
    setSelectedFinish(nextView.selectedFinish || '');
    setSelectedAttributeQuery(nextView.selectedAttributeQuery || '');
    setSelectedBrand(nextView.selectedBrand);
    setSelectedCategory(nextView.selectedCategory);
    setSelectedType(nextView.selectedType);
    setSelectedStatus(nextView.selectedStatus || 'all');
    setSelectedMediaFilter(nextView.selectedMediaFilter);
    setSelectedQuickFilter(nextView.selectedQuickFilter || 'all');
    setSettingsForTenant(nextView.tenantId || CATALOG_DEFAULT_TENANT_ID, nextView.settings);
    setCurrentPage(1);
    setHasAppliedSharedView(true);
  }, [hasAppliedSharedView, setSettingsForTenant]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    selectedName,
    selectedNumber,
    selectedNumberOperator,
    selectedCollection,
    selectedRange,
    selectedVariantGroup,
    selectedPriceMin,
    selectedPriceMax,
    selectedEan,
    selectedFlow,
    selectedFinish,
    selectedAttributeQuery,
    selectedBrand,
    selectedCategory,
    selectedType,
    selectedStatus,
    selectedMediaFilter,
    selectedQuickFilter,
    sortBy,
    settings.pageSize,
  ]);

  useEffect(() => {
    if (meta.totalPages > 0 && currentPage > meta.totalPages) {
      setCurrentPage(meta.totalPages);
    }
  }, [currentPage, meta.totalPages]);

  const currentSnapshot = useMemo(
    () =>
      buildCurrentSnapshot(
        searchTerm,
        selectedName,
        selectedNumber,
        selectedNumberOperator,
        selectedCollection,
        selectedRange,
        selectedVariantGroup,
        selectedPriceMin,
        selectedPriceMax,
        selectedEan,
        selectedFlow,
        selectedFinish,
        selectedAttributeQuery,
        selectedBrand,
        selectedCategory,
        selectedType,
        selectedStatus,
        selectedMediaFilter,
        selectedQuickFilter,
        selectedTenantId,
        settings
      ),
    [
      searchTerm,
      selectedName,
      selectedNumber,
      selectedNumberOperator,
      selectedCollection,
      selectedRange,
      selectedVariantGroup,
      selectedPriceMin,
      selectedPriceMax,
      selectedEan,
      selectedFlow,
      selectedFinish,
      selectedAttributeQuery,
      selectedBrand,
      selectedCategory,
      selectedType,
      selectedStatus,
      selectedMediaFilter,
      selectedQuickFilter,
      selectedTenantId,
      settings,
    ]
  );

  const applySnapshot = (snapshot: SavedViewSnapshot) => {
    setSelectedTenantId(snapshot.tenantId || CATALOG_DEFAULT_TENANT_ID);
    setSearchTerm(snapshot.searchTerm);
    setSelectedName(snapshot.selectedName || '');
    setSelectedNumber(snapshot.selectedNumber || '');
    setSelectedNumberOperator(snapshot.selectedNumberOperator || 'contains');
    setSelectedCollection(snapshot.selectedCollection || '');
    setSelectedRange(snapshot.selectedRange || '');
    setSelectedVariantGroup(snapshot.selectedVariantGroup || '');
    setSelectedPriceMin(snapshot.selectedPriceMin || '');
    setSelectedPriceMax(snapshot.selectedPriceMax || '');
    setSelectedEan(snapshot.selectedEan || '');
    setSelectedFlow(snapshot.selectedFlow || '');
    setSelectedFinish(snapshot.selectedFinish || '');
    setSelectedAttributeQuery(snapshot.selectedAttributeQuery || '');
    setSelectedBrand(snapshot.selectedBrand);
    setSelectedCategory(snapshot.selectedCategory);
    setSelectedType(snapshot.selectedType);
    setSelectedStatus(snapshot.selectedStatus || 'all');
    setSelectedMediaFilter(snapshot.selectedMediaFilter);
    setSelectedQuickFilter(snapshot.selectedQuickFilter || 'all');
    setSettingsForTenant(snapshot.tenantId || CATALOG_DEFAULT_TENANT_ID, snapshot.settings);
    setCurrentPage(1);
    setSelectedProduct(null);
    setIsSettingsOpen(false);
  };

  const {
    savedViews,
    savedViewName,
    setSavedViewName,
    activeSavedView,
    shareableLink,
    shareMessage,
    shareError,
    setShareMessage,
    setShareError,
    saveCurrentView,
    applySavedView,
    deleteSavedView,
    copyShareableLink,
    createShareableLinkForCurrentView,
  } = useSavedViews(currentSnapshot, applySnapshot);

  const handleClearFilters = () => {
    setSelectedBrand('all');
    setSelectedCategory('all');
    setSelectedType('all');
    setSelectedStatus('all');
    setSelectedMediaFilter('all');
    setSelectedQuickFilter('all');
    setSearchTerm('');
    setSelectedName('');
    setSelectedNumber('');
    setSelectedNumberOperator('contains');
    setSelectedCollection('');
    setSelectedRange('');
    setSelectedVariantGroup('');
    setSelectedPriceMin('');
    setSelectedPriceMax('');
    setSelectedEan('');
    setSelectedFlow('');
    setSelectedFinish('');
    setSelectedAttributeQuery('');
    setSelectedProduct(null);
    setSavedViewName('');
  };

  const commitSearchTerm = (term: string) => {
    const next = term.trim();
    setSearchTerm(next);
    if (!next) return;
    setRecentSearches(prev => {
      const normalized = next.toLowerCase();
      const deduped = prev.filter(item => item.toLowerCase() !== normalized);
      return [next, ...deduped].slice(0, MAX_RECENT_SEARCHES);
    });
  };

  const clearRecentSearches = () => setRecentSearches([]);

  const updateProduct = (productId: string, patch: Partial<Product>) => {
    fetcherUpdateProduct(productId, patch);
    setSelectedProduct(current => {
      if (!current || current.id !== productId) return current;
      return { ...current, ...patch };
    });
  };

  const categoryOptions = useMemo<CategoryOption[]>(
    () => flattenCategoryTree(meta.categoryTree),
    [meta.categoryTree]
  );

  return {
    products,
    loading,
    error,
    selectedProduct,
    setSelectedProduct,
    searchTerm,
      selectedName,
      selectedNumber,
      selectedNumberOperator,
      selectedCollection,
      selectedRange,
      selectedVariantGroup,
      selectedPriceMin,
    selectedPriceMax,
    selectedEan,
    selectedFlow,
    selectedFinish,
    selectedAttributeQuery,
    setSearchTerm,
    setSelectedName,
    setSelectedNumber,
    setSelectedNumberOperator,
    setSelectedCollection,
    setSelectedRange,
    setSelectedVariantGroup,
    setSelectedPriceMin,
    setSelectedPriceMax,
    setSelectedEan,
    setSelectedFlow,
    setSelectedFinish,
    setSelectedAttributeQuery,
    selectedBrand,
    setSelectedBrand,
    selectedCategory,
    setSelectedCategory,
    selectedType,
    setSelectedType,
    selectedStatus,
    setSelectedStatus,
    selectedMediaFilter,
    selectedQuickFilter,
    setSelectedMediaFilter,
    setSelectedQuickFilter,
    sortBy,
    setSortBy,
    selectedTenantId,
    setSelectedTenantId,
    currentPage,
    setCurrentPage,
    isSettingsOpen,
    setIsSettingsOpen,
    brandOptions: meta.brandOptions,
    rangeOptions: meta.rangeOptions,
    variantGroupOptions: meta.variantGroupOptions,
    flowOptions: meta.flowOptions,
    finishOptions: meta.finishOptions,
    priceRange: meta.priceRange,
    categoryOptions,
    categoryTree: meta.categoryTree,
    categoryLabelMap: meta.categoryLabelMap,
    typeOptions: meta.typeOptions,
    statusOptions: meta.statusOptions,
    filteredProducts: products,
    displayProducts: products,
    handleClearFilters,
    totalPages: meta.totalPages,
    paginatedProducts: products,
    imageCount: meta.imageCount,
    attachmentCount: meta.attachmentCount,
    assetCount: meta.assetCount,
    withImagesCount: meta.withImagesCount,
    withDocumentsCount: meta.withDocumentsCount,
    mixedMediaCount: meta.mixedMediaCount,
    reloadProducts,
    settings,
    setSettings,
    setSettingsForTenant,
    saveSettings,
    settingsSaveState: saveState,
    tenantOptions,
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
    createShareableLinkForCurrentView,
    setShareMessage,
    setShareError,
    recentSearches,
    commitSearchTerm,
    clearRecentSearches,
    updateProduct,
    filteredGroupCount: meta.filteredGroupCount,
    totalCatalogCount: meta.totalCatalogCount,
    totalRawProductCount: meta.totalRawProductCount,
    cacheAgeMs: meta.cacheAgeMs,
    cacheIsStale: meta.stale,
    cacheIsSlim: meta.slim,
  };
}
