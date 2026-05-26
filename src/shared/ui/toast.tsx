import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside ToastProvider');
  return ctx;
}

const STYLES: Record<ToastType, string> = {
  success: 'bg-green-50 border-green-200 text-green-900',
  error: 'bg-red-50 border-red-200 text-red-900',
  info: 'bg-blue-50 border-blue-200 text-blue-900',
  warning: 'bg-amber-50 border-amber-200 text-amber-900',
};

const DOT: Record<ToastType, string> = {
  success: 'bg-green-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
  warning: 'bg-amber-500',
};

const DURATION_MS = 4000;

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex min-w-[260px] max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg ${STYLES[item.type]}`}
    >
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[item.type]}`} aria-hidden="true" />
      <p className="flex-1 text-sm font-medium leading-snug">{item.message}</p>
      <button
        onClick={onDismiss}
        aria-label="Cerrar notificación"
        className="shrink-0 rounded-full p-0.5 opacity-50 transition hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = String(++idRef.current);
    setToasts(prev => [...prev, { id, message, type }]);
    window.setTimeout(() => dismiss(id), DURATION_MS);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-label="Notificaciones"
        className="fixed bottom-5 right-5 z-[200] flex flex-col items-end gap-2"
      >
        {toasts.map(item => (
          <Toast key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
