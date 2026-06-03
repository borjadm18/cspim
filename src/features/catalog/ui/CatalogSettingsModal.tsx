import { Check, ImageIcon, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { CatalogSettings, SavedView } from '../model/catalogTypes';
import { CATALOG_THEMES } from '../../../shared/theme/catalogThemes';
import { SavedViewsPanel } from './SavedViewsPanel';
import { uploadOrganizationAsset } from '../api/organizationSettings';

interface CatalogSettingsModalProps {
  open: boolean;
  settings: CatalogSettings;
  onChange: (next: CatalogSettings) => void;
  onClose: () => void;
  onReset: () => void;
  onSave: () => Promise<void>;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  tenantId: string;
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

function UploadCard({
  title,
  description,
  value,
  uploading,
  previewLabel,
  inputId,
  onUpload,
  onClear,
}: {
  title: string;
  description: string;
  value?: string;
  uploading: boolean;
  previewLabel: string;
  inputId: string;
  onUpload: (file?: File | null) => Promise<void>;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const openPicker = () => {
    const input = inputRef.current;
    if (!input) return;
    try {
      if (typeof input.showPicker === 'function') {
        input.showPicker();
        return;
      }
    } catch {
      // fallback to click below
    }
    input.click();
  };

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
      onDragOver={event => event.preventDefault()}
      onDrop={event => {
        event.preventDefault();
        const file = event.dataTransfer.files?.[0];
        void onUpload(file);
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</span>
          <p className="mt-2 text-sm text-slate-600">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          {value ? (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 transition hover:bg-slate-50"
            >
              <X className="h-3.5 w-3.5" />
              Quitar
            </button>
          ) : null}
          <label
            htmlFor={inputId}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[var(--catalog-accent)] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-95"
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'Subiendo...' : 'Subir archivo'}
          </label>
        </div>
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async event => {
          const input = event.currentTarget;
          const file = input.files?.[0];
          await onUpload(file);
          input.value = '';
        }}
      />

      <div
        role="button"
        tabIndex={0}
        onClick={openPicker}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openPicker();
          }
        }}
        className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white p-4 transition hover:border-[color:var(--catalog-accent)]/30 hover:bg-[color:var(--catalog-accent-soft)]/20"
      >
        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
          {value ? (
            <img src={value} alt={`${title} cargado`} className="h-full w-full object-contain p-2" />
          ) : (
            <ImageIcon className="h-5 w-5 text-slate-400" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900">{value ? `${previewLabel} activo` : `Sin ${previewLabel.toLowerCase()} configurado`}</p>
          <p className="mt-1 text-sm text-slate-600">El cambio se guarda en la configuración del catálogo del tenant activo.</p>
          <p className="mt-1 text-xs text-slate-500">También puedes arrastrar el archivo encima de este bloque.</p>
        </div>
      </div>
    </div>
  );
}

export function CatalogSettingsModal({
  open,
  settings,
  onChange,
  onClose,
  onReset,
  onSave,
  saveState,
  tenantId,
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
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [uploadingLoginHero, setUploadingLoginHero] = useState(false);

  if (!open) return null;

  const handleAssetUpload = async (
    file: File | null | undefined,
    field: 'logoUrl' | 'faviconUrl' | 'loginHeroImageUrl',
    kind: 'logo' | 'favicon' | 'login-hero',
    setUploading: (value: boolean) => void
  ) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadOrganizationAsset(tenantId, kind, file);
      onChange({ ...settings, [field]: url });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.28)]"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Ajustes</p>
            <h3 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-900">Ajustes del catálogo</h3>
            <p className="mt-2 text-sm text-slate-600">Controla identidad visual, densidad de catálogo y opciones activas del tenant.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Cerrar
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <UploadCard
            title="Logo"
            description="Sube o arrastra un archivo para reemplazar el logo del catálogo."
            value={settings.logoUrl}
            uploading={uploadingLogo}
            previewLabel="Logo"
            inputId="catalog-logo-upload"
            onUpload={file => handleAssetUpload(file, 'logoUrl', 'logo', setUploadingLogo)}
            onClear={() => onChange({ ...settings, logoUrl: undefined })}
          />

          <UploadCard
            title="Favicon"
            description="Define el icono del navegador para reforzar el branding del tenant."
            value={settings.faviconUrl}
            uploading={uploadingFavicon}
            previewLabel="Favicon"
            inputId="catalog-favicon-upload"
            onUpload={file => handleAssetUpload(file, 'faviconUrl', 'favicon', setUploadingFavicon)}
            onClear={() => onChange({ ...settings, faviconUrl: undefined })}
          />

          <UploadCard
            title="Hero del login"
            description="Sube una imagen editorial para enriquecer la capa visual del acceso."
            value={settings.loginHeroImageUrl}
            uploading={uploadingLoginHero}
            previewLabel="Imagen hero"
            inputId="catalog-login-hero-upload"
            onUpload={file => handleAssetUpload(file, 'loginHeroImageUrl', 'login-hero', setUploadingLoginHero)}
            onClear={() => onChange({ ...settings, loginHeroImageUrl: undefined })}
          />

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
                const active = settings.paletteId === theme.id && !settings.customAccentHex;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => onChange({ ...settings, paletteId: theme.id, customAccentHex: undefined })}
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

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Color personalizado</span>
              <p className="mt-1 text-sm text-slate-600">Sobreescribe la paleta con un color de acento exacto.</p>
              <div className="mt-3 flex items-center gap-3">
                <input
                  type="color"
                  value={settings.customAccentHex || '#143d6b'}
                  onChange={event => onChange({ ...settings, customAccentHex: event.target.value })}
                  className="h-10 w-12 cursor-pointer rounded-lg border border-slate-200 bg-white p-0.5"
                  aria-label="Seleccionar color personalizado"
                />
                <input
                  type="text"
                  value={settings.customAccentHex || ''}
                  onChange={event => {
                    const val = event.target.value;
                    if (/^#[0-9a-fA-F]{0,6}$/.test(val) || val === '') {
                      onChange({ ...settings, customAccentHex: val || undefined });
                    }
                  }}
                  placeholder="#000000"
                  maxLength={7}
                  className="h-10 w-28 rounded-xl border border-slate-200 bg-white px-3 font-mono text-sm text-slate-900 outline-none focus:border-[color:var(--catalog-accent)]"
                  aria-label="Código hexadecimal del color"
                />
                {settings.customAccentHex ? (
                  <button
                    type="button"
                    onClick={() => onChange({ ...settings, customAccentHex: undefined })}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Limpiar
                  </button>
                ) : null}
              </div>
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

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Narrativa del login</span>
            <p className="mt-2 text-sm text-slate-600">Añade una capa editorial ligera para que la pantalla de acceso respire mejor el tono del tenant.</p>

            <div className="mt-4 grid gap-4">
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Claim corto</span>
                <input
                  type="text"
                  value={settings.loginEyebrow || ''}
                  onChange={event => onChange({ ...settings, loginEyebrow: event.target.value || undefined })}
                  placeholder="Content Store"
                  maxLength={48}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[color:var(--catalog-accent)]"
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Titular</span>
                <input
                  type="text"
                  value={settings.loginHeading || ''}
                  onChange={event => onChange({ ...settings, loginHeading: event.target.value || undefined })}
                  placeholder="Una entrada limpia y seria al catálogo de producto."
                  maxLength={140}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[color:var(--catalog-accent)]"
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Bloque editorial</span>
                <textarea
                  value={settings.loginBody || ''}
                  onChange={event => onChange({ ...settings, loginBody: event.target.value || undefined })}
                  placeholder="Explica brevemente qué aporta este acceso y para quién está pensado."
                  maxLength={320}
                  rows={4}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-[color:var(--catalog-accent)]"
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Features activas</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                <div className="flex items-center gap-2 text-emerald-700">
                  <Check className="h-4 w-4" />
                  <p className="text-sm font-semibold">Vista completa del catálogo</p>
                </div>
                <p className="mt-2 text-sm text-emerald-800/80">Grid de productos, ficha completa y navegación pensada para trabajo comercial diario.</p>
              </div>
              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4">
                <div className="flex items-center gap-2 text-sky-700">
                  <Check className="h-4 w-4" />
                  <p className="text-sm font-semibold">Descarga directa de archivos</p>
                </div>
                <p className="mt-2 text-sm text-sky-800/80">Cada documento o recurso del producto mantiene acceso directo para abrir o descargar.</p>
              </div>
            </div>
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
            onClick={() => void onSave()}
            disabled={saveState === 'saving'}
            className="rounded-full bg-[var(--catalog-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saveState === 'saving' ? 'Guardando…' : saveState === 'saved' ? 'Guardado' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
