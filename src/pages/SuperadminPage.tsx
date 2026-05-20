import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { LoadingSpinner } from '../shared/ui/LoadingSpinner';

type Tenant = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  primary_hover: string;
  primary_text: string;
  created_at: string | null;
};

type ProfileRow = {
  tenant_id: string;
};

type Role = 'admin' | 'content_manager' | 'comercial';

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

const darkenHex = (hex: string, amount = 0.15) => {
  const normalized = hex.replace('#', '').trim();
  if (normalized.length !== 6) return hex;
  const value = Number.parseInt(normalized, 16);
  if (Number.isNaN(value)) return hex;

  const r = Math.max(0, Math.floor(((value >> 16) & 255) * (1 - amount)));
  const g = Math.max(0, Math.floor(((value >> 8) & 255) * (1 - amount)));
  const b = Math.max(0, Math.floor((value & 255) * (1 - amount)));
  return `#${[r, g, b].map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
};

export default function SuperadminPage() {
  const { profile } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [profileRows, setProfileRows] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTenant, setSavingTenant] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [tenantColor, setTenantColor] = useState('#1B3A5C');
  const [tenantHoverColor, setTenantHoverColor] = useState('#152E4A');
  const [tenantLogoUrl, setTenantLogoUrl] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userFullName, setUserFullName] = useState('');
  const [userTenantId, setUserTenantId] = useState('');
  const [userRole, setUserRole] = useState<Role>('content_manager');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const tenantUserCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of profileRows) {
      counts.set(row.tenant_id, (counts.get(row.tenant_id) || 0) + 1);
    }
    return counts;
  }, [profileRows]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      const [{ data: tenantsData, error: tenantsError }, { data: profilesData, error: profilesError }] =
        await Promise.all([
          supabase.from('tenants').select('*').order('created_at', { ascending: false }),
          supabase.from('profiles').select('tenant_id'),
        ]);

      if (tenantsError) setError(tenantsError.message);
      if (profilesError) setError(previous => previous || profilesError.message);

      setTenants((tenantsData as Tenant[]) || []);
      setProfileRows((profilesData as ProfileRow[]) || []);
      setLoading(false);
    };

    void load();
  }, []);

  const resetTenantForm = () => {
    setEditingTenantId(null);
    setTenantName('');
    setTenantSlug('');
    setTenantColor('#1B3A5C');
    setTenantHoverColor('#152E4A');
    setTenantLogoUrl('');
  };

  const handleSaveTenant = async () => {
    if (!tenantName.trim() || !tenantSlug.trim()) return;
    setSavingTenant(true);
    setError(null);
    setSuccess(null);

    const payload = {
      name: tenantName.trim(),
      slug: tenantSlug.trim(),
      logo_url: tenantLogoUrl.trim() || null,
      primary_color: tenantColor,
      primary_hover: tenantHoverColor || darkenHex(tenantColor),
      primary_text: '#ffffff',
    };

    const result = editingTenantId
      ? await supabase.from('tenants').update(payload).eq('id', editingTenantId)
      : await supabase.from('tenants').insert(payload);

    if (result.error) {
      setError(result.error.message);
    } else {
      setSuccess(editingTenantId ? 'Tenant actualizado' : 'Tenant creado');
      resetTenantForm();
      const { data } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
      setTenants((data as Tenant[]) || []);
    }

    setSavingTenant(false);
  };

  const handleEditTenant = (tenant: Tenant) => {
    setEditingTenantId(tenant.id);
    setTenantName(tenant.name);
    setTenantSlug(tenant.slug);
    setTenantColor(tenant.primary_color);
    setTenantHoverColor(tenant.primary_hover);
    setTenantLogoUrl(tenant.logo_url || '');
  };

  const handleDeleteTenant = async (tenantId: string) => {
    if (!confirm('¿Eliminar este tenant?')) return;
    const { error: deleteError } = await supabase.from('tenants').delete().eq('id', tenantId);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setTenants(previous => previous.filter(tenant => tenant.id !== tenantId));
  };

  const handleCreateUser = async () => {
    if (!userEmail.trim() || !userPassword.trim() || !userTenantId) return;
    setSavingUser(true);
    setError(null);
    setSuccess(null);

    const { error: functionError } = await supabase.functions.invoke('create-user', {
      body: {
        email: userEmail.trim(),
        password: userPassword,
        tenantId: userTenantId,
        role: userRole,
        fullName: userFullName.trim() || null,
      },
    });

    if (functionError) {
      setError(functionError.message);
    } else {
      setSuccess('Usuario creado');
      setUserEmail('');
      setUserPassword('');
      setUserFullName('');
      const { data } = await supabase.from('profiles').select('tenant_id');
      setProfileRows((data as ProfileRow[]) || []);
    }

    setSavingUser(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,var(--catalog-page-start)_0%,var(--catalog-page-end)_100%)] text-slate-900">
        <LoadingSpinner />
      </div>
    );
  }

  if (profile?.role !== 'superadmin') {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,var(--catalog-page-start)_0%,var(--catalog-page-end)_100%)] px-6 py-10 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-[24px] border border-slate-200 bg-white p-8 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
          <h1 className="text-xl font-semibold">Acceso restringido</h1>
          <p className="mt-2 text-sm text-slate-600">Esta sección solo está disponible para superadmin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--catalog-page-start)_0%,var(--catalog-page-end)_100%)] px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.07)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-slate-400">Superadmin</p>
          <h1 className="mt-2 text-2xl font-semibold">Gestión de tenants y usuarios</h1>
          <p className="mt-1 text-sm text-slate-500">Administra organizaciones, branding y altas de usuarios desde una sola vista.</p>
        </header>

        {(error || success) && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            {error || success}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.07)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Tenants</h2>
                <p className="text-sm text-slate-500">{tenants.length} organizaciones registradas</p>
              </div>
              <button
                type="button"
                onClick={resetTenantForm}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 transition hover:bg-slate-50"
              >
                Nuevo tenant
              </button>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-[10px] uppercase tracking-widest text-slate-400">
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Slug</th>
                    <th className="px-4 py-3">Color</th>
                    <th className="px-4 py-3">Usuarios</th>
                    <th className="px-4 py-3">Creado</th>
                    <th className="px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map(tenant => (
                    <tr key={tenant.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium">{tenant.name}</td>
                      <td className="px-4 py-3 text-slate-500">{tenant.slug}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="h-4 w-4 rounded-sm border border-slate-200" style={{ backgroundColor: tenant.primary_color }} />
                          <span className="font-mono text-xs text-slate-500">{tenant.primary_color}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{tenantUserCounts.get(tenant.id) || 0}</td>
                      <td className="px-4 py-3 text-slate-500">{tenant.created_at ? new Date(tenant.created_at).toLocaleDateString('es-ES') : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditTenant(tenant)}
                            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600 transition hover:bg-slate-50"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteTenant(tenant.id)}
                            className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-red-600 transition hover:bg-red-50"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.07)]">
              <h2 className="text-lg font-semibold">{editingTenantId ? 'Editar tenant' : 'Crear tenant'}</h2>
              <div className="mt-4 space-y-3">
                <input
                  value={tenantName}
                  onChange={event => {
                    const value = event.target.value;
                    setTenantName(value);
                    if (!editingTenantId) {
                      setTenantSlug(slugify(value));
                    }
                  }}
                  placeholder="Nombre de la organización"
                  className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-[color:var(--catalog-accent)]"
                />
                <input
                  value={tenantSlug}
                  onChange={event => setTenantSlug(slugify(event.target.value))}
                  placeholder="slug"
                  className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-[color:var(--catalog-accent)]"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="color"
                    value={tenantColor}
                    onChange={event => {
                      setTenantColor(event.target.value);
                      setTenantHoverColor(darkenHex(event.target.value));
                    }}
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white p-1"
                  />
                  <input
                    value={tenantHoverColor}
                    onChange={event => setTenantHoverColor(event.target.value)}
                    placeholder="Color hover"
                    className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-[color:var(--catalog-accent)]"
                  />
                </div>
                <input
                  value={tenantLogoUrl}
                  onChange={event => setTenantLogoUrl(event.target.value)}
                  placeholder="URL del logo"
                  className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-[color:var(--catalog-accent)]"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveTenant()}
                    disabled={savingTenant}
                    className="rounded-full bg-[var(--catalog-accent)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingTenant ? 'Guardando…' : 'Guardar tenant'}
                  </button>
                  {editingTenantId && (
                    <button
                      type="button"
                      onClick={resetTenantForm}
                      className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 transition hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.07)]">
              <h2 className="text-lg font-semibold">Crear usuario</h2>
              <div className="mt-4 space-y-3">
                <input
                  value={userEmail}
                  onChange={event => setUserEmail(event.target.value)}
                  type="email"
                  placeholder="Email"
                  className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-[color:var(--catalog-accent)]"
                />
                <input
                  value={userPassword}
                  onChange={event => setUserPassword(event.target.value)}
                  type="password"
                  placeholder="Contraseña temporal"
                  className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-[color:var(--catalog-accent)]"
                />
                <input
                  value={userFullName}
                  onChange={event => setUserFullName(event.target.value)}
                  placeholder="Nombre completo"
                  className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-[color:var(--catalog-accent)]"
                />
                <select
                  value={userTenantId}
                  onChange={event => setUserTenantId(event.target.value)}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-[color:var(--catalog-accent)]"
                >
                  <option value="">Selecciona tenant</option>
                  {tenants.map(tenant => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </option>
                  ))}
                </select>
                <select
                  value={userRole}
                  onChange={event => setUserRole(event.target.value as Role)}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-[color:var(--catalog-accent)]"
                >
                  <option value="admin">Admin</option>
                  <option value="content_manager">Content manager</option>
                  <option value="comercial">Comercial</option>
                </select>
                <button
                  type="button"
                  onClick={() => void handleCreateUser()}
                  disabled={savingUser}
                  className="rounded-full bg-[var(--catalog-accent)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingUser ? 'Creando…' : 'Crear usuario'}
                </button>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
