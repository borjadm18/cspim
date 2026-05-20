import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async () => {
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
    }

    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,var(--catalog-page-start)_0%,var(--catalog-page-end)_100%)] p-4 text-slate-900">
      <div className="w-full max-w-sm rounded-[28px] border border-slate-200 bg-white p-8 shadow-[0_20px_50px_rgba(15,23,42,0.12)]">
        <div className="mb-6 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--catalog-accent)] text-sm font-bold uppercase tracking-[0.16em] text-white">
          CS
        </div>

        <h1 className="text-lg font-semibold text-slate-900">Accede a tu cuenta</h1>
        <p className="mt-1 text-sm text-slate-500">Content Store · gestión de producto</p>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="tu@empresa.com"
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[color:var(--catalog-accent)] focus:ring-4 focus:ring-[color:var(--catalog-accent-soft)]/60"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
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
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[color:var(--catalog-accent)] focus:ring-4 focus:ring-[color:var(--catalog-accent-soft)]/60"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="button"
            onClick={() => void handleLogin()}
            disabled={loading || !email || !password}
            className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[color:var(--catalog-accent)] text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Accediendo…' : 'Entrar'}
          </button>
        </div>
      </div>
    </div>
  );
}
