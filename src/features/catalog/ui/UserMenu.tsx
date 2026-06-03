import { ChevronDown, LogOut, Settings2, UserCircle2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { UserAvatar } from './UserAvatar';

interface UserMenuProps {
  email?: string | null;
  fullName?: string | null;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  className?: string;
  buttonClassName?: string;
  showLabel?: boolean;
}

const getDisplayName = (fullName?: string | null, email?: string | null) => {
  const trimmedName = (fullName || '').trim();
  if (trimmedName) return trimmedName;
  return (email || '').trim() || 'Usuario';
};

export function UserMenu({
  email,
  fullName,
  onOpenProfile,
  onOpenSettings,
  onLogout,
  className,
  buttonClassName,
  showLabel = true,
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const displayName = useMemo(() => getDisplayName(fullName, email), [email, fullName]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`.trim()}>
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        className={`inline-flex items-center gap-3 rounded-[22px] border border-slate-200/90 bg-white px-3 py-2 text-left text-sm text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 ${buttonClassName ?? ''}`.trim()}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Abrir menú de usuario"
      >
        <UserAvatar email={email} fullName={fullName} compact />
        {showLabel ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
            <p className="truncate text-xs text-slate-500">Cuenta</p>
          </div>
        ) : null}
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[296px] rounded-[28px] border border-slate-200 bg-white p-3 shadow-[0_24px_60px_rgba(15,23,42,0.18)]"
        >
          <div className="rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-3 py-3">
            <div className="flex items-center gap-3">
              <UserAvatar email={email} fullName={fullName} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                <p className="truncate text-xs text-slate-500">{email || 'Sin email disponible'}</p>
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onOpenProfile();
              }}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <UserCircle2 className="h-4 w-4 text-slate-400" />
              Perfil
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onOpenSettings();
              }}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <Settings2 className="h-4 w-4 text-slate-400" />
              Ajustes del catálogo
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4 text-slate-400" />
              Cerrar sesión
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
