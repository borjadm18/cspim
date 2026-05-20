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

export type MediaFilter = 'all' | 'with-assets' | 'without-assets' | 'images-only' | 'documents-only' | 'mixed';

export type QuickFilter = 'all' | 'images' | 'attachments' | 'categories' | 'assets';

export type CatalogSettings = {
  pageSize: number;
  density: 'comfortable' | 'compact';
  logoUrl?: string;
  paletteId: string;
};

export type SavedViewSnapshot = {
  tenantId: string;
  searchTerm: string;
  selectedName: string;
  selectedNumber: string;
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
};
