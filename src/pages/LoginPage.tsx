import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTenantBranding } from '../hooks/useTenantBranding';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const { user, profile } = useAuth();
  const branding = useTenantBranding(profile?.tenantId);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const tenantName = branding?.tenantName ?? 'Content Store';

  const handleLogin = async () => {
    if (loading) return;
    setLoading(true);
    setAuthError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setAuthError('Credenciales incorrectas. Revisa tu email y contraseña.');
    }

    setLoading(false);
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (authError) setAuthError(null);
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (authError) setAuthError(null);
  };

  return (
    <div className="min-h-screen bg-[#0F2238] md:flex">
      <div className="relative hidden flex-1 overflow-hidden bg-[#0F2238] md:flex">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/login-background.png')" }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[#0F2238]/10" aria-hidden="true" />

        <div className="relative z-10 flex h-full w-full flex-col justify-between p-8">
          <div className="flex items-center gap-2">
            <div className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-sm bg-white">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <rect x="1" y="1" width="4" height="12" rx="1" fill="#0F2238" />
                <rect x="7" y="1" width="6" height="7" rx="1" fill="#0F2238" />
              </svg>
            </div>
            <span className="text-[12px] font-medium tracking-[0.04em] text-white/90">Content Store</span>
          </div>

          <div className="flex flex-1 flex-col justify-end pb-2">
            <div className="mb-3 inline-flex w-fit items-center gap-[5px] rounded-sm border border-white/[0.12] bg-white/[0.07] px-2 py-[3px] text-[10px] text-white/50">
              <div className="h-[5px] w-[5px] flex-shrink-0 rounded-full bg-[#639922]" />
              {tenantName}
            </div>

            <h1 className="mb-2 text-[17px] font-medium leading-[1.45] text-white">
              Tu catálogo de producto,
              <br />
              en un solo lugar
            </h1>

            <p className="text-[11px] leading-[1.65] text-white/40">
              Gestiona fichas, imágenes y canales de publicación desde un espacio de trabajo
              centralizado.
            </p>
          </div>

          <p className="text-[9px] uppercase tracking-[0.05em] text-white/20">
            © {new Date().getFullYear()} Pimly · Content Store
          </p>
        </div>
      </div>

      <div className="flex w-full flex-1 flex-col justify-center bg-white px-[34px] py-10 md:w-[340px] md:flex-shrink-0">
        <p className="mb-[18px] text-[9px] font-medium uppercase tracking-[0.1em] text-[#A8A5A0]">
          Acceso seguro
        </p>

        <h2 className="mb-1 text-[19px] font-medium text-gray-900">Bienvenido</h2>
        <p className="mb-7 text-[12px] text-[#A8A5A0]">Introduce tus credenciales para continuar</p>

        {authError && (
          <div className="mb-3 flex items-center gap-[6px] rounded-sm border border-[#F09595] bg-[#FCEBEB] px-[11px] py-2 text-[11px] text-[#A32D2D]">
            <AlertCircle size={14} className="flex-shrink-0" />
            {authError}
          </div>
        )}

        <div className="mb-[14px]">
          <label className="mb-[5px] block text-[9px] font-medium uppercase tracking-[0.1em] text-[#A8A5A0]">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={event => handleEmailChange(event.target.value)}
            placeholder="tu@empresa.com"
            autoComplete="email"
            className="w-full rounded-sm border border-[#E2DED8] bg-[#FAFAF8] px-[11px] py-[9px] text-[13px] text-gray-900 outline-none transition-colors placeholder:text-[#CCC9C3] focus:border-[#0F2238] focus:bg-white"
          />
        </div>

        <div className="mb-[6px]">
          <label className="mb-[5px] block text-[9px] font-medium uppercase tracking-[0.1em] text-[#A8A5A0]">
            Contraseña
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={event => handlePasswordChange(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  void handleLogin();
                }
              }}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full rounded-sm border border-[#E2DED8] bg-[#FAFAF8] px-[11px] py-[9px] pr-10 text-[13px] text-gray-900 outline-none transition-colors placeholder:text-[#CCC9C3] focus:border-[#0F2238] focus:bg-white"
            />
            <button
              type="button"
              onClick={() => setShowPassword(value => !value)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleLogin()}
          disabled={loading || !email || !password}
          className="mt-[6px] inline-flex w-full items-center justify-center gap-2 rounded-sm bg-[#0F2238] py-[10px] text-[9px] font-medium uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#1B3A5C] disabled:cursor-not-allowed disabled:opacity-35"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {loading ? 'Verificando…' : 'Entrar'}
        </button>

        <div className="my-[18px] h-px bg-[#EEEBE6]" />

        <p className="text-center text-[11px] text-[#A8A5A0]">
          ¿Problemas para acceder?{' '}
          <a href="mailto:soporte@pimly.io" className="underline underline-offset-2">
            Solicitar ayuda
          </a>
        </p>
      </div>
    </div>
  );
}
