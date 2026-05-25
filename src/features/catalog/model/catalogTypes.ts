import type { Product } from '../api/productService';

export type CategoryOption = {
  id: string;
  label: string;
  count: number;
};

export type CategoryTreeNode = {
  id: string;
  label: string;
  count: number;
  children: CategoryTreeNode[];
};

export type TypeOption = {
  id: string;
  label: string;
  count: number;
};

export type StatusOption = {
  id: string;
  label: string;
  count: number;
};

export type BrandOption = {
  id: string;
  label: string;
  count: number;
};

export type FacetOption = {
  id: string;
  label: string;
  count: number;
};

export type PriceRange = {
  min: number;
  max: number;
};

export type MediaFilter = 'all' | 'with-assets' | 'without-assets' | 'images-only' | 'documents-only' | 'mixed';

export type QuickFilter = 'all' | 'images' | 'attachments' | 'categories' | 'assets';
export type CatalogSortKey = 'relevance' | 'name_asc' | 'name_desc' | 'sku_asc' | 'updated_desc' | 'variants_desc';

export type CatalogSettings = {
  pageSize: number;
  density: 'comfortable' | 'compact';
  logoUrl?: string;
  paletteId: string;
  customAccentHex?: string;
};

export type SavedViewSnapshot = {
  tenantId: string;
  searchTerm: string;
  selectedName: string;
  selectedNumber: string;
  selectedCollection: string;
  selectedRange: string;
  selectedPriceMin: string;
  selectedPriceMax: string;
  selectedEan: string;
  selectedFlow: string;
  selectedFinish: string;
  selectedAttributeQuery: string;
  selectedBrand: string;
  selectedCategory: string;
  selectedType: string;
  selectedStatus: string;
  selectedMediaFilter: MediaFilter;
  selectedQuickFilter: QuickFilter;
  settings: CatalogSettings;
};

export type SavedView = SavedViewSnapshot & {
  id: string;
  name: string;
  createdAt: string;
};

export type SerializedViewState = SavedViewSnapshot & {
  name?: string;
};

export type TenantOption = {
  id: string;
  label: string;
  description?: string;
};

export type CatalogAccessMode = 'admin' | 'client';

export type CatalogQueryParams = {
  tenantId: string;
  page: number;
  pageSize: number;
  sortBy: CatalogSortKey;
  searchTerm: string;
  selectedName: string;
  selectedNumber: string;
  selectedCollection: string;
  selectedRange: string;
  selectedPriceMin: string;
  selectedPriceMax: string;
  selectedEan: string;
  selectedFlow: string;
  selectedFinish: string;
  selectedAttributeQuery: string;
  selectedBrand: string;
  selectedCategory: string;
  selectedType: string;
  selectedStatus: string;
  selectedMediaFilter: MediaFilter;
  selectedQuickFilter: QuickFilter;
};

export type CatalogPageMeta = {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalCatalogCount: number;
  filteredGroupCount: number;
  totalRawProductCount: number;
  categoryLabelMap: Record<string, string>;
  brandOptions: BrandOption[];
  rangeOptions: FacetOption[];
  flowOptions: FacetOption[];
  finishOptions: FacetOption[];
  priceRange: PriceRange;
  categoryTree: CategoryTreeNode[];
  typeOptions: TypeOption[];
  statusOptions: StatusOption[];
  imageCount: number;
  attachmentCount: number;
  assetCount: number;
  withImagesCount: number;
  withDocumentsCount: number;
  mixedMediaCount: number;
  cacheAgeMs?: number;
  stale?: boolean;
  slim?: boolean;
};

export type CatalogPageResponse = {
  products: Product[];
  meta: CatalogPageMeta;
};

export type CatalogState = {
  products: Product[];
  filteredProducts: Product[];
  loading: boolean;
  error: string | null;
  selectedProduct: Product | null;
  searchTerm: string;
  selectedName: string;
  selectedNumber: string;
  selectedBrand: string;
  selectedCategory: string;
  selectedType: string;
  selectedStatus: string;
  selectedMediaFilter: MediaFilter;
  selectedQuickFilter: QuickFilter;
  sortBy: CatalogSortKey;
  currentPage: number;
  isSettingsOpen: boolean;
  brandOptions: BrandOption[];
  categoryOptions: CategoryOption[];
  categoryTree: CategoryTreeNode[];
  typeOptions: TypeOption[];
  statusOptions: StatusOption[];
  totalPages: number;
  paginatedProducts: Product[];
  imageCount: number;
  attachmentCount: number;
  assetCount: number;
  settings: CatalogSettings;
  selectedTenantId: string;
  tenantOptions: TenantOption[];
  selectedAttributeQuery: string;
};
