import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchCatalogPage,
  getCachedCatalogPage,
  setCachedCatalogPage,
  type Product,
} from '../api/productService';
import type { CatalogPageMeta, CatalogPageResponse, CatalogQueryParams } from '../model/catalogTypes';
import { isTestProduct } from '../selectors/catalogSelectors';

const EMPTY_META: CatalogPageMeta = {
  currentPage: 1,
  pageSize: 30,
  totalPages: 1,
  totalCatalogCount: 0,
  filteredGroupCount: 0,
  totalRawProductCount: 0,
  categoryLabelMap: {},
  brandOptions: [],
  rangeOptions: [],
  flowOptions: [],
  finishOptions: [],
  priceRange: { min: 0, max: 0 },
  categoryTree: [],
  typeOptions: [],
  statusOptions: [],
  imageCount: 0,
  attachmentCount: 0,
  assetCount: 0,
  withImagesCount: 0,
  withDocumentsCount: 0,
  mixedMediaCount: 0,
};

const filterVisibleProducts = (response: CatalogPageResponse): CatalogPageResponse => ({
  ...response,
  products: response.products.filter(product => !isTestProduct(product)),
});

export function useProductFetcher(query: CatalogQueryParams) {
  const [products, setProducts] = useState<Product[]>([]);
  const [meta, setMeta] = useState<CatalogPageMeta>(EMPTY_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestTokenRef = useRef(0);
  const queryKey = useMemo(() => JSON.stringify(query), [query]);

  const reloadProducts = async () => {
    const token = ++requestTokenRef.current;
    try {
      const cached = getCachedCatalogPage(query);
      if (cached) {
        const visibleCached = filterVisibleProducts(cached);
        setProducts(visibleCached.products);
        setMeta(visibleCached.meta);
        setLoading(false);
        setError(null);
      } else {
        setLoading(true);
      }

      setError(null);
      const response = filterVisibleProducts(await fetchCatalogPage(query));
      if (requestTokenRef.current !== token) return;

      setProducts(response.products);
      setMeta(response.meta);
      setCachedCatalogPage(query, response);
    } catch (err) {
      if (requestTokenRef.current !== token) return;
      setError(err instanceof Error ? err.message : 'Error desconocido al cargar productos');
    } finally {
      if (requestTokenRef.current === token) setLoading(false);
    }
  };

  useEffect(() => {
    void reloadProducts();
  }, [queryKey]);

  const updateProduct = (productId: string, patch: Partial<Product>) => {
    setProducts(prev => prev.map(product => (product.id === productId ? { ...product, ...patch } : product)));
  };

  return { products, meta, loading, error, reloadProducts, updateProduct };
}
