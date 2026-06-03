import { Building2, Mail, ShieldCheck, UserCircle2, X } from 'lucide-react';
import type { UserRole } from '../../../hooks/useAuth';
import { UserAvatar } from './UserAvatar';

interface UserProfileModalProps {
  open: boolean;
  email?: string | null;
  fullName?: string | null;
  role?: UserRole | null;
  organizationName?: string | null;
  onClose: () => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: 'Superadmin',
  admin: 'Administrador',
  content_manager: 'Gestor de contenido',
  comercial: 'Comercial',
};

export function UserProfileModal({
  open,
  email,
  fullName,
  role,
  organizationName,
  onClose,
}: UserProfileModalProps) {
  if (!open) return null;

  const displayName = (fullName || '').trim() || 'Usuario';
  const roleLabel = role ? ROLE_LABELS[role] : 'Sin rol definido';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.28)]"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Perfil</p>
            <h3 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-900">Cuenta activa</h3>
            <p className="mt-2 text-sm text-slate-600">
              Un resumen rápido de quién está dentro del tenant y con qué nivel de acceso.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100"
            aria-label="Cerrar perfil"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5">
          <div className="flex items-center gap-4">
            <UserAvatar email={email} fullName={fullName} />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold tracking-[-0.02em] text-slate-950">{displayName}</p>
              <p className="mt-1 truncate text-sm text-slate-500">{email || 'Sin email disponible'}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[var(--catalog-accent)] shadow-sm">
              <UserCircle2 className="h-4 w-4" />
            </div>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Nombre</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{displayName}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[var(--catalog-accent)] shadow-sm">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Rol</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{roleLabel}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[var(--catalog-accent)] shadow-sm">
              <Building2 className="h-4 w-4" />
            </div>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Organización</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{organizationName || 'Tenant activo'}</p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-500">
              <Mail className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Email de acceso</p>
              <p className="mt-1 truncate text-sm font-medium text-slate-900">{email || 'Sin email disponible'}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-[var(--catalog-accent)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-95"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
