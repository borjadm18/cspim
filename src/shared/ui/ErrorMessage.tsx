import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorMessageProps {
  message: string;
  onRetry: () => void;
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className="mx-auto max-w-2xl rounded-[28px] border border-rose-200 bg-white px-6 py-8 text-center shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h3 className="text-xl font-semibold text-slate-900">No se pudo cargar el catálogo</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
      <button
        onClick={onRetry}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--catalog-accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
      >
        <RefreshCw className="h-4 w-4" />
        Reintentar
      </button>
    </div>
  );
}
