import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchProducts, getCachedProducts, setCachedProducts, type Product } from '../api/productService';
import { loadOrganizationSettings, saveOrganizationSettings } from '../api/organizationSettings';
import {
  CATALOG_ACCESS_MODE,
  CATALOG_DEFAULT_TENANT_ID,
  CATALOG_TENANT_OPTIONS,
  type CatalogTenantOption,
} from '../../../shared/config/catalogTenant';
import { DEFAULT_CATALOG_THEME_ID } from '../../../shared/theme/catalogThemes';
import type {
  BrandOption,
  CatalogSettings,
  CatalogSortKey,
  CategoryOption,
  MediaFilter,
  QuickFilter,
  SavedView,
  SavedViewSnapshot,
  SerializedViewState,
  TypeOption,
} from '../model/catalogTypes';
import {
  buildBrandOptions,
  buildCategoryOptions,
  buildCategoryLabelMap,
  buildCategoryTree,
  buildTypeOptions,
  buildStatusOptions,
  groupProductsForDisplay,
  hasDocuments,
  hasMixedMedia,
  filterProducts,
  hasAssets,
  resolveCategorySelectionIds,
} from '../selectors/catalogSelectors';

const DEFAULT_SETTINGS: CatalogSettings = {
  pageSize: 30,
  density: 'comfortable',
  logoUrl: undefined,
  paletteId: DEFAULT_CATALOG_THEME_ID,
};

const SAVED_VIEWS_STORAGE_KEY = 'content-store.saved-views.v1';
const RECENT_SEARCHES_STORAGE_KEY = 'content-store.recent-searches.v1';
const SELECTED_TENANT_STORAGE_KEY = 'content-store.selected-tenant.v1';
const SETTINGS_BY_TENANT_STORAGE_KEY = 'content-store.settings-by-tenant.v1';
const SHAREABLE_VIEW_QUERY_KEY = 'view';

const DEFAULT_VIEW_SNAPSHOT: SavedViewSnapshot = {
  tenantId: CATALOG_DEFAULT_TENANT_ID,
  searchTerm: '',
  selectedName: '',
  selectedNumber: '',
  selectedBrand: 'all',
  selectedCategory: 'all',
  selectedType: 'all',
  selectedStatus: 'all',
  selectedMediaFilter: 'all',
  selectedQuickFilter: 'all',
  settings: DEFAULT_SETTINGS,
};

const createSnapshot = (
  searchTerm: string,
  selectedName: string,
  selectedNumber: string,
  selectedBrand: string,
  selectedCategory: string,
  selectedType: string,
  selectedStatus: string,
  selectedMediaFilter: MediaFilter,
  selectedQuickFilter: QuickFilter,
  tenantId: string,
  settings: CatalogSettings
): SavedViewSnapshot => ({
  tenantId,
  searchTerm,
  selectedName,
  selectedNumber,
  selectedBrand,
  selectedCategory,
  selectedType,
  selectedStatus,
  selectedMediaFilter,
  selectedQuickFilter,
  settings: { ...settings },
});

const isSameSnapshot = (a: SavedViewSnapshot, b: SavedViewSnapshot) =>
  a.tenantId === b.tenantId &&
  a.searchTerm === b.searchTerm &&
  a.selectedName === b.selectedName &&
  a.selectedNumber === b.selectedNumber &&
  a.selectedBrand === b.selectedBrand &&
  a.selectedCategory === b.selectedCategory &&
  a.selectedType === b.selectedType &&
  a.selectedStatus === b.selectedStatus &&
  a.selectedMediaFilter === b.selectedMediaFilter &&
  a.selectedQuickFilter === b.selectedQuickFilter &&
  a.settings.pageSize === b.settings.pageSize &&
  a.settings.density === b.settings.density &&
  a.settings.logoUrl === b.settings.logoUrl &&
  a.settings.paletteId === b.settings.paletteId;

const createSavedViewId = () => `view-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const MAX_RECENT_SEARCHES = 6;
const DEFAULT_SORT_BY: CatalogSortKey = 'relevance';

const getProductUpdatedAt = (product: Product) => {
  const raw = (product as any).updatedAt || (product as any).lastUpdate || (product as any).createDate || '';
  const time = Date.parse(String(raw));
  return Number.isNaN(time) ? 0 : time;
};

const getProductVariantCount = (product: Product) => {
  const variants = Array.isArray((product as any).variants) ? (product as any).variants.length : 0;
  return variants;
};

const compareStrings = (a: unknown, b: unknown) =>
  String(a || '').localeCompare(String(b || ''), 'es', { sensitivity: 'base', numeric: true });

const sortCatalogProducts = (products: Product[], sortBy: CatalogSortKey) => {
  const next = [...products];

  switch (sortBy) {
    case 'name_asc':
      return next.sort((a, b) => compareStrings(a.name, b.name));
    case 'name_desc':
      return next.sort((a, b) => compareStrings(b.name, a.name));
    case 'sku_asc':
      return next.sort((a, b) => compareStrings(a.sku || (a as any).number, b.sku || (b as any).number));
    case 'updated_desc':
      return next.sort((a, b) => getProductUpdatedAt(b) - getProductUpdatedAt(a) || compareStrings(a.name, b.name));
    case 'variants_desc':
      return next.sort((a, b) => getProductVariantCount(b) - getProductVariantCount(a) || compareStrings(a.name, b.name));
    case 'relevance':
    default:
      return next;
  }
};

const encodeShareableState = (state: SerializedViewState) =>
  window.btoa(unescape(encodeURIComponent(JSON.stringify(state))));

const decodeShareableState = (value: string): SerializedViewState | null => {
  try {
    const decoded = decodeURIComponent(escape(window.atob(value)));
    const parsed = JSON.parse(decoded) as SerializedViewState;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      ...DEFAULT_VIEW_SNAPSHOT,
      ...parsed,
      settings: {
        ...DEFAULT_SETTINGS,
        ...(parsed.settings || {}),
      },
      selectedName: parsed.selectedName || '',
      selectedNumber: parsed.selectedNumber || '',
      selectedStatus: parsed.selectedStatus || 'all',
      selectedQuickFilter: parsed.selectedQuickFilter || 'all',
    };
  } catch {
    return null;
  }
};

const buildShareableUrl = (state: SerializedViewState) => {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  url.searchParams.set(SHAREABLE_VIEW_QUERY_KEY, encodeShareableState(state));
  return url.toString();
};

const loadSavedViews = (): SavedView[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(SAVED_VIEWS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as SavedView[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(view => view && typeof view.id === 'string' && typeof view.name === 'string')
      .map(view => ({
        ...DEFAULT_VIEW_SNAPSHOT,
        ...view,
        createdAt: typeof view.createdAt === 'string' ? view.createdAt : new Date().toISOString(),
        settings: {
          ...DEFAULT_SETTINGS,
          ...(view.settings || {}),
        },
        selectedName: view.selectedName || '',
        selectedNumber: view.selectedNumber || '',
        selectedStatus: view.selectedStatus || 'all',
        selectedQuickFilter: view.selectedQuickFilter || 'all',
      }));
  } catch {
    return [];
  }
};

const loadRecentSearches = (): string[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(item => typeof item === 'string' && item.trim());
  } catch {
    return [];
  }
};

const loadSettingsByTenant = (): Record<string, CatalogSettings> => {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(SETTINGS_BY_TENANT_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Record<string, CatalogSettings>;
    if (!parsed || typeof parsed !== 'object') return {};

    return Object.fromEntries(
      Object.entries(parsed).map(([tenantId, settings]) => [
        tenantId,
        {
          ...DEFAULT_SETTINGS,
          ...(settings || {}),
        },
      ])
    );
  } catch {
    return {};
  }
};

const loadSelectedTenant = (): string => {
  if (typeof window === 'undefined') return CATALOG_DEFAULT_TENANT_ID;

  try {
    const raw = window.localStorage.getItem(SELECTED_TENANT_STORAGE_KEY);
    if (raw && CATALOG_TENANT_OPTIONS.some(option => option.id === raw)) {
      return raw;
    }
  } catch {
    return CATALOG_DEFAULT_TENANT_ID;
  }

  return CATALOG_DEFAULT_TENANT_ID;
};

export function useCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string>(() => loadSelectedTenant());
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [selectedNumber, setSelectedNumber] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedMediaFilter, setSelectedMediaFilter] = useState<MediaFilter>('all');
  const [selectedQuickFilter, setSelectedQuickFilter] = useState<QuickFilter>('all');
  const [sortBy, setSortBy] = useState<CatalogSortKey>(DEFAULT_SORT_BY);
  const [settingsByTenant, setSettingsByTenant] = useState<Record<string, CatalogSettings>>(() => loadSettingsByTenant());
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => loadSavedViews());
  const [recentSearches, setRecentSearches] = useState<string[]>(() => loadRecentSearches());
  const [savedViewName, setSavedViewName] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [shareableLink, setShareableLink] = useState('');
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [hasAppliedSharedView, setHasAppliedSharedView] = useState(false);
  const [tenantOptions, setTenantOptions] = useState<CatalogTenantOption[]>(() => CATALOG_TENANT_OPTIONS);
  const [hydratedTenantSettings, setHydratedTenantSettings] = useState<Record<string, boolean>>({});
  const requestTokenRef = useRef(0);

  useEffect(() => {
    void reloadProducts();
  }, [selectedTenantId]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedProduct(null);
  }, [selectedTenantId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SELECTED_TENANT_STORAGE_KEY, selectedTenantId);
  }, [selectedTenantId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SAVED_VIEWS_STORAGE_KEY, JSON.stringify(savedViews));
  }, [savedViews]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(recentSearches));
  }, [recentSearches]);

  useEffect(() => {
    let cancelled = false;

    const loadOrganizations = async () => {
      try {
        const response = await fetch('/api/organizations', {
          headers: {
            accept: 'application/json',
          },
        });

        if (!response.ok) return;

        const data = await response.json();
        const organizations = Array.isArray(data?.organizations) ? data.organizations : Array.isArray(data) ? data : [];
        const nextTenantOptions = organizations
          .map((item: any) => ({
            id: typeof item.id === 'string' ? item.id.trim() : '',
            label: typeof item.label === 'string' ? item.label.trim() : '',
            description: typeof item.description === 'string' ? item.description.trim() : undefined,
          }))
          .filter((item: CatalogTenantOption) => Boolean(item.id && item.label));

        if (cancelled || nextTenantOptions.length === 0) return;

        setTenantOptions(nextTenantOptions);
      } catch {
        // keep env fallback
      }
    };

    if (CATALOG_ACCESS_MODE === 'admin' || import.meta.env.PROD) {
      void loadOrganizations();
    }

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SETTINGS_BY_TENANT_STORAGE_KEY, JSON.stringify(settingsByTenant));
  }, [settingsByTenant]);

  useEffect(() => {
    if (!tenantOptions.some(option => option.id === selectedTenantId)) {
      const fallbackTenant = tenantOptions[0]?.id || CATALOG_DEFAULT_TENANT_ID;
      setSelectedTenantId(fallbackTenant);
    }
  }, [tenantOptions, selectedTenantId]);

  useEffect(() => {
    if (typeof window === 'undefined' || hasAppliedSharedView) return;

    const params = new URLSearchParams(window.location.search);
    const encodedView = params.get(SHAREABLE_VIEW_QUERY_KEY);
    if (!encodedView) return;

    const nextView = decodeShareableState(encodedView);
    if (!nextView) return;

    setSelectedTenantId(nextView.tenantId || CATALOG_DEFAULT_TENANT_ID);
    setSearchTerm(nextView.searchTerm);
    setSelectedName(nextView.selectedName || '');
    setSelectedNumber(nextView.selectedNumber || '');
    setSelectedBrand(nextView.selectedBrand);
    setSelectedCategory(nextView.selectedCategory);
    setSelectedType(nextView.selectedType);
    setSelectedStatus(nextView.selectedStatus || 'all');
    setSelectedMediaFilter(nextView.selectedMediaFilter);
    setSelectedQuickFilter(nextView.selectedQuickFilter || 'all');
    setSettingsForTenant(nextView.tenantId || CATALOG_DEFAULT_TENANT_ID, nextView.settings);
    setCurrentPage(1);
    setHasAppliedSharedView(true);
  }, [hasAppliedSharedView]);

  const reloadProducts = async () => {
    const token = ++requestTokenRef.current;
    try {
      const cachedProducts = getCachedProducts(selectedTenantId);
      if (cachedProducts && cachedProducts.length > 0) {
        setProducts(cachedProducts);
        setLoading(false);
        setError(null);
      } else {
        setLoading(true);
      }

      setError(null);
      const data = await fetchProducts(selectedTenantId);
      if (requestTokenRef.current !== token) return;
      setProducts(data);
      setCachedProducts(selectedTenantId, data);
    } catch (err) {
      if (requestTokenRef.current !== token) return;
      setError(err instanceof Error ? err.message : 'Error desconocido al cargar productos');
    } finally {
      if (requestTokenRef.current === token) {
        setLoading(false);
      }
    }
  };

  const categoryLabelMap = useMemo(() => buildCategoryLabelMap(products), [products]);
  const brandOptions = useMemo<BrandOption[]>(() => buildBrandOptions(products), [products]);
  const categoryOptions = useMemo<CategoryOption[]>(() => buildCategoryOptions(products, categoryLabelMap), [products, categoryLabelMap]);
  const categoryTree = useMemo(() => buildCategoryTree(categoryOptions), [categoryOptions]);
  const typeOptions = useMemo<TypeOption[]>(() => buildTypeOptions(products), [products]);
  const statusOptions = useMemo(() => buildStatusOptions(products), [products]);
  const selectedCategoryIds = useMemo(
    () => resolveCategorySelectionIds(selectedCategory, categoryTree),
    [selectedCategory, categoryTree]
  );
  const settings = settingsByTenant[selectedTenantId] || DEFAULT_SETTINGS;

  useEffect(() => {
    let cancelled = false;

    const hydrateTenantSettings = async () => {
      setHydratedTenantSettings(previous => ({
        ...previous,
        [selectedTenantId]: false,
      }));

      const remoteSettings = await loadOrganizationSettings(selectedTenantId);
      if (cancelled) return;

      if (remoteSettings) {
        setSettingsByTenant(previous => ({
          ...previous,
          [selectedTenantId]: {
            ...DEFAULT_SETTINGS,
            ...(previous[selectedTenantId] || DEFAULT_SETTINGS),
            ...remoteSettings,
          },
        }));
      }

      setHydratedTenantSettings(previous => ({
        ...previous,
        [selectedTenantId]: true,
      }));
    };

    void hydrateTenantSettings();

    return () => {
      cancelled = true;
    };
  }, [selectedTenantId]);

  useEffect(() => {
    if (!hydratedTenantSettings[selectedTenantId]) return;

    void saveOrganizationSettings({
      tenantId: selectedTenantId,
      settings,
    });
  }, [hydratedTenantSettings, selectedTenantId, settings]);

  const setSettingsForTenant = (tenantId: string, next: CatalogSettings | ((prev: CatalogSettings) => CatalogSettings)) => {
    setSettingsByTenant(previous => {
      const current = previous[tenantId] || DEFAULT_SETTINGS;
      const resolved = typeof next === 'function' ? (next as (prev: CatalogSettings) => CatalogSettings)(current) : next;
      return {
        ...previous,
        [tenantId]: { ...DEFAULT_SETTINGS, ...resolved },
      };
    });
  };

  const setSettings = (next: CatalogSettings | ((prev: CatalogSettings) => CatalogSettings)) => {
    setSettingsForTenant(selectedTenantId, next);
  };

  const filteredProducts = useMemo(
    () =>
      filterProducts(
        products,
        searchTerm,
        selectedName,
        selectedNumber,
        selectedBrand,
        selectedCategoryIds,
        selectedType,
        selectedStatus,
        selectedMediaFilter,
        selectedQuickFilter
      ),
    [
      products,
      searchTerm,
      selectedName,
      selectedNumber,
      selectedBrand,
      selectedCategoryIds,
      selectedType,
      selectedStatus,
      selectedMediaFilter,
      selectedQuickFilter,
    ]
  );

  const displayProducts = useMemo(() => groupProductsForDisplay(filteredProducts), [filteredProducts]);
  const sortedProducts = useMemo(() => sortCatalogProducts(displayProducts, sortBy), [displayProducts, sortBy]);

  const currentSnapshot = useMemo(
    () =>
      createSnapshot(
        searchTerm,
        selectedName,
        selectedNumber,
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

  const activeSavedView = useMemo(
    () => savedViews.find(view => isSameSnapshot(view, currentSnapshot)) ?? null,
    [savedViews, currentSnapshot]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedName, selectedNumber, selectedBrand, selectedCategory, selectedType, selectedStatus, selectedMediaFilter, selectedQuickFilter, sortBy]);

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
    setSelectedProduct(null);
    setSavedViewName('');
  };

  const commitSearchTerm = (term: string) => {
    const next = term.trim();
    setSearchTerm(next);

    if (!next) return;

    setRecentSearches(previous => {
      const normalized = next.toLowerCase();
      const deduped = previous.filter(item => item.toLowerCase() !== normalized);
      return [next, ...deduped].slice(0, MAX_RECENT_SEARCHES);
    });
  };

  const saveCurrentView = () => {
    const name = savedViewName.trim();
    if (!name) return;

    setSavedViews(previous => {
      const nextView: SavedView = {
        id: createSavedViewId(),
        name,
        createdAt: new Date().toISOString(),
        ...currentSnapshot,
      };

      const existingIndex = previous.findIndex(view => view.name.trim().toLowerCase() === name.toLowerCase());
      if (existingIndex >= 0) {
        const next = [...previous];
        next[existingIndex] = {
          ...next[existingIndex],
          ...nextView,
          id: next[existingIndex].id,
          createdAt: next[existingIndex].createdAt,
        };
        return next;
      }

      return [nextView, ...previous];
    });

    setSavedViewName('');
  };

  const applySavedView = (view: SavedView) => {
    setSelectedTenantId(view.tenantId || CATALOG_DEFAULT_TENANT_ID);
    setSearchTerm(view.searchTerm);
    setSelectedName(view.selectedName || '');
    setSelectedNumber(view.selectedNumber || '');
    setSelectedBrand(view.selectedBrand);
    setSelectedCategory(view.selectedCategory);
    setSelectedType(view.selectedType);
    setSelectedStatus(view.selectedStatus || 'all');
    setSelectedMediaFilter(view.selectedMediaFilter);
    setSelectedQuickFilter(view.selectedQuickFilter || 'all');
    setSettingsForTenant(view.tenantId || CATALOG_DEFAULT_TENANT_ID, view.settings);
    setCurrentPage(1);
    setSelectedProduct(null);
    setIsSettingsOpen(false);
  };

  const deleteSavedView = (viewId: string) => {
    setSavedViews(previous => previous.filter(view => view.id !== viewId));
  };

  const createShareableLinkForCurrentView = () => {
    const state: SerializedViewState = {
      tenantId: selectedTenantId,
      searchTerm,
      selectedName,
      selectedNumber,
      selectedBrand,
      selectedCategory,
      selectedType,
      selectedStatus,
      selectedMediaFilter,
      selectedQuickFilter,
      settings,
    };

    const url = buildShareableUrl(state);
    setShareableLink(url);
    setShareMessage('Enlace copiado para compartir esta vista.');
    setShareError(null);
    return url;
  };

  const copyShareableLink = async () => {
    try {
      const url = createShareableLinkForCurrentView();
      if (!url) throw new Error('No se pudo generar el enlace');

      await navigator.clipboard.writeText(url);
      setShareMessage('Enlace copiado para compartir esta vista.');
      setShareError(null);
    } catch {
      setShareError('No se pudo copiar el enlace. Puedes generarlo y copiarlo manualmente.');
      setShareMessage(null);
    }
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
  };

  const updateProduct = (productId: string, patch: Partial<Product>) => {
    setProducts(previous => {
      const next = previous.map(product => (product.id === productId ? { ...product, ...patch } : product));

      setSelectedProduct(current => {
        if (!current || current.id !== productId) return current;
        return { ...current, ...patch };
      });

      return next;
    });
  };

  const restoreDefaultSettings = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  const totalPages = Math.ceil(sortedProducts.length / settings.pageSize);
  const startIndex = (currentPage - 1) * settings.pageSize;
  const paginatedProducts = sortedProducts.slice(startIndex, startIndex + settings.pageSize);

  const imageCount = filteredProducts.reduce((sum, product) => sum + (product.images?.length || 0), 0);
  const attachmentCount = filteredProducts.reduce((sum, product) => sum + (((product as any).attachments || []).length || 0), 0);
  const assetCount = filteredProducts.filter(product => hasAssets(product)).length;
  const withImagesCount = filteredProducts.filter(product => (product.images?.length || 0) > 0).length;
  const withDocumentsCount = filteredProducts.filter(product => hasDocuments(product)).length;
  const mixedMediaCount = filteredProducts.filter(product => hasMixedMedia(product)).length;

  return {
    products,
    loading,
    error,
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
    brandOptions,
    categoryOptions,
    categoryTree,
    categoryLabelMap,
    typeOptions,
    statusOptions,
    filteredProducts,
    displayProducts: sortedProducts,
    handleClearFilters,
    totalPages,
    paginatedProducts,
    imageCount,
    attachmentCount,
    assetCount,
    withImagesCount,
    withDocumentsCount,
    mixedMediaCount,
    reloadProducts,
    settings,
    setSettings,
    setSettingsForTenant,
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
  };
}
