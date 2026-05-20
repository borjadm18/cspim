import type { SavedView } from '../model/catalogTypes';

interface SavedViewsPanelProps {
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

const buildSummary = (view: SavedView) => {
  const parts = [
    view.searchTerm ? `Búsqueda: ${view.searchTerm}` : null,
    view.selectedBrand !== 'all' ? `Marca: ${view.selectedBrand}` : null,
    view.selectedCategory !== 'all' ? `Categoría: ${view.selectedCategory}` : null,
    view.selectedType !== 'all' ? `Tipo: ${view.selectedType}` : null,
    view.selectedMediaFilter !== 'all' ? `Medios: ${view.selectedMediaFilter}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' · ') : 'Vista sin filtros';
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

export function SavedViewsPanel({
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
}: SavedViewsPanelProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Vistas guardadas</p>
          <p className="mt-2 text-sm text-slate-600">
            Guarda una combinación de búsqueda y filtros para volver a ella al instante.
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
          {savedViews.length}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          value={savedViewName}
          onChange={event => onSavedViewNameChange(event.target.value)}
          placeholder="Ej. Solo ducha con archivos"
          className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[color:var(--catalog-accent)] focus:bg-white focus:ring-4 focus:ring-[color:var(--catalog-accent-soft)]/60"
        />
        <button
          type="button"
          onClick={onSaveView}
          disabled={!savedViewName.trim()}
          className="rounded-xl bg-[var(--catalog-accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Guardar vista
        </button>
        <button
          type="button"
          onClick={onCopyCurrentViewLink}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Copiar enlace
        </button>
      </div>

      {(shareMessage || shareError || shareableLink) && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
          {shareMessage && <p className="font-medium text-emerald-700">{shareMessage}</p>}
          {shareError && <p className="font-medium text-rose-700">{shareError}</p>}
          {shareableLink && <p className="mt-2 break-all text-xs text-slate-600">{shareableLink}</p>}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {savedViews.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
            Todavía no has guardado ninguna vista.
          </div>
        ) : (
          savedViews.map(view => (
            <article key={view.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-semibold text-slate-900">{view.name}</h4>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{buildSummary(view)}</p>
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Guardada el {formatDate(view.createdAt)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onApplyView(view)}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700 transition hover:border-[color:var(--catalog-accent)]/30 hover:bg-[color:var(--catalog-accent-soft)]/50"
                  >
                    Aplicar
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteView(view.id)}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-600 transition hover:bg-rose-50"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
