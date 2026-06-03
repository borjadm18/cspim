import { Building2, ChevronDown, LogOut, Settings2, UserCircle2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CatalogAccessMode, TenantOption } from '../model/catalogTypes';
import { UserAvatar } from './UserAvatar';

interface SidebarContextMenuProps {
  accessMode: CatalogAccessMode;
  tenantOptions: TenantOption[];
  selectedTenantId: string;
  onTenantChange: (tenantId: string) => void;
  email?: string | null;
  fullName?: string | null;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

const getDisplayName = (fullName?: string | null, email?: string | null) => {
  const trimmedName = (fullName || '').trim();
  if (trimmedName) return trimmedName;
  return (email || '').trim() || 'Usuario';
};

export function SidebarContextMenu({
  accessMode,
  tenantOptions,
  selectedTenantId,
  onTenantChange,
  email,
  fullName,
  onOpenProfile,
  onOpenSettings,
  onLogout,
}: SidebarContextMenuProps) {
  const [open, setOpen] = useState(false);
  const [tenantSearch, setTenantSearch] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const displayName = useMemo(() => getDisplayName(fullName, email), [email, fullName]);
  const selectedTenant = tenantOptions.find(option => option.id === selectedTenantId) || tenantOptions[0];

  const filteredTenantOptions = useMemo(() => {
    const query = tenantSearch.trim().toLowerCase();
    if (!query) return tenantOptions;

    return tenantOptions.filter(option =>
      [option.label, option.description || '', option.id].join(' ').toLowerCase().includes(query)
    );
  }, [tenantOptions, tenantSearch]);

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
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        className="flex w-full items-center gap-3 rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-3.5 py-3 text-left shadow-sm transition hover:border-slate-300 hover:bg-white"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Abrir menú de contexto"
      >
        <UserAvatar email={email} fullName={fullName} compact />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {selectedTenant?.label || 'Organización activa'}
          </p>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute bottom-[calc(100%+0.625rem)] left-0 z-50 w-[320px] rounded-[28px] border border-slate-200 bg-white p-3 shadow-[0_24px_60px_rgba(15,23,42,0.18)]"
        >
          <div className="rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-3">
            <div className="flex items-center gap-3">
              <UserAvatar email={email} fullName={fullName} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                <p className="truncate text-xs text-slate-500">{email || 'Sin email disponible'}</p>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Organización</p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                {selectedTenant?.label || 'Sin organización'}
              </p>
              {selectedTenant?.description ? (
                <p className="mt-1 truncate text-xs text-slate-500">{selectedTenant.description}</p>
              ) : null}
            </div>
          </div>

          {accessMode === 'admin' ? (
            <div className="mt-3 rounded-[22px] border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-2 text-slate-700">
                <Building2 className="h-4 w-4 text-slate-400" />
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Cambiar organización</p>
              </div>
              <input
                type="text"
                value={tenantSearch}
                onChange={event => setTenantSearch(event.target.value)}
                placeholder="Buscar organización..."
                className="mt-3 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[color:var(--catalog-accent)]"
              />
              <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1">
                {filteredTenantOptions.map(option => {
                  const active = option.id === selectedTenantId;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        onTenantChange(option.id);
                        setTenantSearch('');
                        setOpen(false);
                      }}
                      className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                        active
                          ? 'border-[color:var(--catalog-accent)] bg-[color:var(--catalog-accent-soft)]'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">{option.description || option.id}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

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
