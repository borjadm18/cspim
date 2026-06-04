import { useEffect, useState, type ReactNode } from 'react';
import type { CatalogAccessMode, TenantOption } from '../model/catalogTypes';
import { SidebarContextMenu } from './SidebarContextMenu';

interface CatalogSidebarProps {
  logoUrl?: string;
  activeViewName?: string | null;
  tenantOptions: TenantOption[];
  selectedTenantId: string;
  accessMode: CatalogAccessMode;
  onTenantChange: (tenantId: string) => void;
  userEmail?: string | null;
  userFullName?: string | null;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onSignOut: () => void;
  children: ReactNode;
}

export function CatalogSidebar({
  logoUrl,
  activeViewName,
  tenantOptions,
  selectedTenantId,
  accessMode,
  onTenantChange,
  userEmail,
  userFullName,
  onOpenProfile,
  onOpenSettings,
  onSignOut,
  children,
}: CatalogSidebarProps) {
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setLogoError(false);
  }, [logoUrl]);

  return (
    <aside className="sticky top-4 flex h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-[32px] border border-slate-200/80 bg-white/92 shadow-[0_20px_48px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <div className="border-b border-slate-200/80 px-5 py-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
            {logoUrl && !logoError ? (
              <img
                src={logoUrl}
                alt="Logo del catálogo"
                className="h-full w-full object-contain p-2"
                onError={() => setLogoError(true)}
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center rounded-[20px] bg-[var(--catalog-accent)] text-sm font-semibold tracking-[0.24em] text-white">
                CS
              </span>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Content Store</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-900">Catálogo virtual</h1>
          </div>
        </div>

        {activeViewName ? (
          <span className="mt-4 inline-flex rounded-full border border-[color:var(--catalog-accent-soft)] bg-[color:var(--catalog-accent-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--catalog-accent)]">
            Vista: {activeViewName}
          </span>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>

      <div className="border-t border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.9)_0%,rgba(248,250,252,0.98)_100%)] p-3">
        <SidebarContextMenu
          accessMode={accessMode}
          tenantOptions={tenantOptions}
          selectedTenantId={selectedTenantId}
          onTenantChange={onTenantChange}
          email={userEmail}
          fullName={userFullName}
          onOpenProfile={onOpenProfile}
          onOpenSettings={onOpenSettings}
          onLogout={onSignOut}
        />
      </div>
    </aside>
  );
}
