import { AlertCircle } from 'lucide-react';
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const tenantName = branding?.tenantName ?? 'Content Store';

  const handleLogin = async () => {
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError('Email o contraseña incorrectos');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0F2238] md:flex">
      <div className="relative hidden flex-1 overflow-hidden bg-[#0F2238] md:flex">
        <svg
          className="absolute inset-0 h-full w-full opacity-[0.13]"
          viewBox="0 0 400 520"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#ffffff" strokeWidth="0.5" />
            </pattern>
          </defs>

          <rect width="400" height="520" fill="url(#grid)" />
          <circle cx="320" cy="80" r="120" fill="none" stroke="#ffffff" strokeWidth="0.5" />
          <circle cx="320" cy="80" r="80" fill="none" stroke="#ffffff" strokeWidth="0.5" />
          <circle cx="320" cy="80" r="40" fill="none" stroke="#ffffff" strokeWidth="0.5" />
          <circle cx="60" cy="420" r="100" fill="none" stroke="#ffffff" strokeWidth="0.5" />
          <circle cx="60" cy="420" r="60" fill="none" stroke="#ffffff" strokeWidth="0.5" />
          <line x1="0" y1="0" x2="400" y2="520" stroke="#ffffff" strokeWidth="0.3" />
          <line x1="400" y1="0" x2="0" y2="520" stroke="#ffffff" strokeWidth="0.3" />
          <line x1="0" y1="260" x2="400" y2="260" stroke="#ffffff" strokeWidth="0.3" />
          <line x1="200" y1="0" x2="200" y2="520" stroke="#ffffff" strokeWidth="0.3" />
          <rect
            x="140"
            y="180"
            width="80"
            height="80"
            fill="none"
            stroke="#ffffff"
            strokeWidth="0.5"
            transform="rotate(15 180 220)"
          />
          <rect
            x="155"
            y="195"
            width="50"
            height="50"
            fill="none"
            stroke="#ffffff"
            strokeWidth="0.3"
            transform="rotate(15 180 220)"
          />
          <circle cx="200" cy="260" r="6" fill="#ffffff" opacity="0.4" />
          <circle cx="200" cy="260" r="2" fill="#ffffff" opacity="0.8" />
        </svg>

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

          <div className="flex-1 flex flex-col justify-end pb-2">
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
              Gestiona fichas, imágenes y canales de publicación desde un espacio de trabajo centralizado.
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

        {error && (
          <div className="mb-3 flex items-center gap-[6px] rounded-sm border border-[#F09595] bg-[#FCEBEB] px-[11px] py-2 text-[11px] text-[#A32D2D]">
            <AlertCircle size={14} className="flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="mb-[14px]">
          <label className="mb-[5px] block text-[9px] font-medium uppercase tracking-[0.1em] text-[#A8A5A0]">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder="tu@empresa.com"
            className="w-full rounded-sm border border-[#E2DED8] bg-[#FAFAF8] px-[11px] py-[9px] text-[13px] text-gray-900 outline-none transition-colors placeholder:text-[#CCC9C3] focus:border-[#0F2238] focus:bg-white"
          />
        </div>

        <div className="mb-[6px]">
          <label className="mb-[5px] block text-[9px] font-medium uppercase tracking-[0.1em] text-[#A8A5A0]">
            Contraseña
          </label>
          <input
            type="password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                void handleLogin();
              }
            }}
            placeholder="••••••••"
            className="w-full rounded-sm border border-[#E2DED8] bg-[#FAFAF8] px-[11px] py-[9px] text-[13px] text-gray-900 outline-none transition-colors placeholder:text-[#CCC9C3] focus:border-[#0F2238] focus:bg-white"
          />
        </div>

        <button
          type="button"
          onClick={() => void handleLogin()}
          disabled={loading || !email || !password}
          className="mt-[6px] w-full rounded-sm bg-[#0F2238] py-[10px] text-[9px] font-medium uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#1B3A5C] disabled:cursor-not-allowed disabled:opacity-35"
        >
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
