import { Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { CatalogSettings, SavedView } from '../model/catalogTypes';
import { CATALOG_THEMES } from '../../../shared/theme/catalogThemes';
import { SavedViewsPanel } from './SavedViewsPanel';

interface CatalogSettingsModalProps {
  open: boolean;
  settings: CatalogSettings;
  onChange: (next: CatalogSettings) => void;
  onClose: () => void;
  onReset: () => void;
  savedViews: SavedView[];
  savedViewName: string;
  onSavedViewNameChange: (value: string) => void;
  onSaveView: () => void;
  onApplyView: (view: SavedView) => void;
  onDeleteView: (viewId: string) => void;
  onCopyCurrentViewLink: () => void;
  shareableLink: string;
  shareMessage: string | null;
  shareError: string | null;
}

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });

export function CatalogSettingsModal({
  open,
  settings,
  onChange,
  onClose,
  onReset,
  savedViews,
  savedViewName,
  onSavedViewNameChange,
  onSaveView,
  onApplyView,
  onDeleteView,
  onCopyCurrentViewLink,
  shareableLink,
  shareMessage,
  shareError,
}: CatalogSettingsModalProps) {
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const openLogoPicker = () => {
    const input = logoInputRef.current;
    if (!input) return;
    try {
      if (typeof input.showPicker === 'function') {
        input.showPicker();
        return;
      }
    } catch {
      // Fallback to the standard click path below.
    }
    input.click();
  };

  const handleLogoUpload = async (file?: File | null) => {
    if (!file) return;
    setUploadingLogo(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      onChange({ ...settings, logoUrl: dataUrl });
    } finally {
      setUploadingLogo(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.28)]"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Configuración</p>
            <h3 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-900">Ajustes del catálogo</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Cerrar
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2"
            onDragOver={event => event.preventDefault()}
            onDrop={event => {
              event.preventDefault();
              const file = event.dataTransfer.files?.[0];
              void handleLogoUpload(file);
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Logo</span>
                <p className="mt-2 text-sm text-slate-600">Sube o arrastra un archivo para reemplazar el logo del catálogo.</p>
              </div>
              <div className="flex items-center gap-2">
                {settings.logoUrl ? (
                  <button
                    type="button"
                    onClick={() => onChange({ ...settings, logoUrl: undefined })}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 transition hover:bg-slate-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    Quitar
                  </button>
                ) : null}
                <label
                  htmlFor="catalog-logo-upload"
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[var(--catalog-accent)] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-95"
                >
                  <Upload className="h-4 w-4" />
                  {uploadingLogo ? 'Subiendo...' : 'Subir archivo'}
                </label>
              </div>
            </div>

            <input
              ref={logoInputRef}
              id="catalog-logo-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async event => {
                const input = event.currentTarget;
                const file = input.files?.[0];
                await handleLogoUpload(file);
                input.value = '';
              }}
            />

            <div
              role="button"
              tabIndex={0}
              onClick={openLogoPicker}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openLogoPicker();
                }
              }}
              className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white p-4 transition hover:border-[color:var(--catalog-accent)]/30 hover:bg-[color:var(--catalog-accent-soft)]/20"
            >
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                {settings.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo cargado" className="h-full w-full object-contain p-2" />
                ) : (
                  <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Logo</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">{settings.logoUrl ? 'Logo activo' : 'Sin logo configurado'}</p>
                <p className="mt-1 text-sm text-slate-600">
                  El cambio se guarda en la configuración del catálogo y se aplica al tenant activo.
                </p>
                <p className="mt-1 text-xs text-slate-500">También puedes arrastrar el archivo encima de este bloque.</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Paleta</span>
                <p className="mt-2 text-sm text-slate-600">Elige la identidad cromática del catálogo.</p>
              </div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{settings.paletteId}</div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {CATALOG_THEMES.map(theme => {
                const active = settings.paletteId === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => onChange({ ...settings, paletteId: theme.id })}
                    className={`rounded-2xl border p-4 text-left transition ${
                      active ? 'border-[color:var(--catalog-accent)] bg-white shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white">
                        <span
                          className="h-7 w-7 rounded-full"
                          style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentStrong})` }}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{theme.name}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{theme.id}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <label className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Densidad</span>
            <select
              value={settings.density}
              onChange={event => onChange({ ...settings, density: event.target.value as CatalogSettings['density'] })}
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none"
            >
              <option value="comfortable">Cómoda</option>
              <option value="compact">Compacta</option>
            </select>
            <p className="mt-2 text-sm text-slate-600">Afecta al espaciado del catálogo y a la lectura general.</p>
          </label>

          <label className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Productos por página</span>
            <select
              value={settings.pageSize}
              onChange={event => onChange({ ...settings, pageSize: Number(event.target.value) })}
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none"
            >
              <option value={12}>12</option>
              <option value={24}>24</option>
              <option value={30}>30</option>
              <option value={48}>48</option>
            </select>
            <p className="mt-2 text-sm text-slate-600">Ajusta cuántos productos aparecen antes de paginar.</p>
          </label>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Vista</p>
            <p className="mt-2 text-sm text-slate-700">Grid de productos y ficha de producto completa.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Descargas</p>
            <p className="mt-2 text-sm text-slate-700">Cada archivo del producto incluye acceso directo a descarga.</p>
          </div>
        </div>

        <div className="mt-6">
          <SavedViewsPanel
            savedViews={savedViews}
            savedViewName={savedViewName}
            onSavedViewNameChange={onSavedViewNameChange}
            onSaveView={onSaveView}
            onApplyView={onApplyView}
            onDeleteView={onDeleteView}
            onCopyCurrentViewLink={onCopyCurrentViewLink}
            shareableLink={shareableLink}
            shareMessage={shareMessage}
            shareError={shareError}
          />
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            onClick={onReset}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Restaurar
          </button>
          <button
            onClick={onClose}
            className="rounded-full bg-[var(--catalog-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-95"
          >
            Guardar y cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

