import { useEffect, useMemo, useState } from 'react';
import { CATALOG_DEFAULT_TENANT_ID } from '../../../shared/config/catalogTenant';
import type { SavedView, SavedViewSnapshot, SerializedViewState } from '../model/catalogTypes';
import { DEFAULT_SETTINGS } from './useCatalogSettings';

const SAVED_VIEWS_KEY = 'content-store.saved-views.v1';
const SHAREABLE_VIEW_QUERY_KEY = 'view';

export const DEFAULT_VIEW_SNAPSHOT: SavedViewSnapshot = {
  tenantId: CATALOG_DEFAULT_TENANT_ID,
  searchTerm: '',
  selectedName: '',
  selectedNumber: '',
  selectedNumberOperator: 'contains',
  selectedCollection: '',
  selectedRange: '',
  selectedVariantGroup: '',
  selectedPriceMin: '',
  selectedPriceMax: '',
  selectedEan: '',
  selectedFlow: '',
  selectedFinish: '',
  selectedAttributeQuery: '',
  selectedBrand: 'all',
  selectedCategory: 'all',
  selectedType: 'all',
  selectedStatus: 'all',
  selectedMediaFilter: 'all',
  selectedQuickFilter: 'all',
  settings: DEFAULT_SETTINGS,
};

const createSavedViewId = () => `view-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const isSameSnapshot = (a: SavedViewSnapshot, b: SavedViewSnapshot) =>
  a.tenantId === b.tenantId &&
  a.searchTerm === b.searchTerm &&
  a.selectedName === b.selectedName &&
  a.selectedNumber === b.selectedNumber &&
  a.selectedNumberOperator === b.selectedNumberOperator &&
  a.selectedCollection === b.selectedCollection &&
  a.selectedRange === b.selectedRange &&
  a.selectedVariantGroup === b.selectedVariantGroup &&
  a.selectedPriceMin === b.selectedPriceMin &&
  a.selectedPriceMax === b.selectedPriceMax &&
  a.selectedEan === b.selectedEan &&
  a.selectedFlow === b.selectedFlow &&
  a.selectedFinish === b.selectedFinish &&
  a.selectedAttributeQuery === b.selectedAttributeQuery &&
  a.selectedBrand === b.selectedBrand &&
  a.selectedCategory === b.selectedCategory &&
  a.selectedType === b.selectedType &&
  a.selectedStatus === b.selectedStatus &&
  a.selectedMediaFilter === b.selectedMediaFilter &&
  a.selectedQuickFilter === b.selectedQuickFilter &&
  a.settings.pageSize === b.settings.pageSize &&
  a.settings.density === b.settings.density &&
  a.settings.logoUrl === b.settings.logoUrl &&
  a.settings.faviconUrl === b.settings.faviconUrl &&
  a.settings.loginHeroImageUrl === b.settings.loginHeroImageUrl &&
  a.settings.loginEyebrow === b.settings.loginEyebrow &&
  a.settings.loginHeading === b.settings.loginHeading &&
  a.settings.loginBody === b.settings.loginBody &&
  a.settings.paletteId === b.settings.paletteId &&
  a.settings.customAccentHex === b.settings.customAccentHex;

const encodeShareableState = (state: SerializedViewState) =>
  window.btoa(unescape(encodeURIComponent(JSON.stringify(state))));

export const decodeShareableState = (value: string): SavedViewSnapshot | null => {
  try {
    const decoded = decodeURIComponent(escape(window.atob(value)));
    const parsed = JSON.parse(decoded) as SerializedViewState;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      ...DEFAULT_VIEW_SNAPSHOT,
      ...parsed,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
      selectedName: parsed.selectedName || '',
      selectedNumber: parsed.selectedNumber || '',
      selectedNumberOperator: parsed.selectedNumberOperator || 'contains',
      selectedCollection: parsed.selectedCollection || '',
      selectedRange: parsed.selectedRange || '',
      selectedVariantGroup: parsed.selectedVariantGroup || '',
      selectedPriceMin: parsed.selectedPriceMin || '',
      selectedPriceMax: parsed.selectedPriceMax || '',
      selectedEan: parsed.selectedEan || '',
      selectedFlow: parsed.selectedFlow || '',
      selectedFinish: parsed.selectedFinish || '',
      selectedAttributeQuery: parsed.selectedAttributeQuery || '',
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
    const raw = window.localStorage.getItem(SAVED_VIEWS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedView[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(v => v && typeof v.id === 'string' && typeof v.name === 'string')
      .map(v => ({
        ...DEFAULT_VIEW_SNAPSHOT,
        ...v,
        createdAt: typeof v.createdAt === 'string' ? v.createdAt : new Date().toISOString(),
        settings: { ...DEFAULT_SETTINGS, ...(v.settings || {}) },
        selectedName: v.selectedName || '',
        selectedNumber: v.selectedNumber || '',
        selectedNumberOperator: v.selectedNumberOperator || 'contains',
        selectedCollection: v.selectedCollection || '',
        selectedRange: v.selectedRange || '',
        selectedVariantGroup: v.selectedVariantGroup || '',
        selectedPriceMin: v.selectedPriceMin || '',
        selectedPriceMax: v.selectedPriceMax || '',
        selectedEan: v.selectedEan || '',
        selectedFlow: v.selectedFlow || '',
        selectedFinish: v.selectedFinish || '',
        selectedAttributeQuery: v.selectedAttributeQuery || '',
        selectedStatus: v.selectedStatus || 'all',
        selectedQuickFilter: v.selectedQuickFilter || 'all',
      }));
  } catch {
    return [];
  }
};

export function useSavedViews(
  currentSnapshot: SavedViewSnapshot,
  applySnapshot: (snapshot: SavedViewSnapshot) => void
) {
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => loadSavedViews());
  const [savedViewName, setSavedViewName] = useState('');
  const [shareableLink, setShareableLink] = useState('');
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(savedViews));
  }, [savedViews]);

  const activeSavedView = useMemo(
    () => savedViews.find(v => isSameSnapshot(v, currentSnapshot)) ?? null,
    [savedViews, currentSnapshot]
  );

  const saveCurrentView = () => {
    const name = savedViewName.trim();
    if (!name) return;

    setSavedViews(prev => {
      const nextView: SavedView = {
        id: createSavedViewId(),
        name,
        createdAt: new Date().toISOString(),
        ...currentSnapshot,
      };
      const existingIndex = prev.findIndex(v => v.name.trim().toLowerCase() === name.toLowerCase());
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          ...nextView,
          id: next[existingIndex].id,
          createdAt: next[existingIndex].createdAt,
        };
        return next;
      }
      return [nextView, ...prev];
    });

    setSavedViewName('');
  };

  const applySavedView = (view: SavedView) => applySnapshot(view);

  const deleteSavedView = (viewId: string) =>
    setSavedViews(prev => prev.filter(v => v.id !== viewId));

  const createShareableLinkForCurrentView = () => {
    const url = buildShareableUrl(currentSnapshot);
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

  return {
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
  };
}
