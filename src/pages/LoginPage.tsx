import { AlertCircle, Eye, EyeOff, Loader2, LockKeyhole, Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const { user } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setAuthError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setAuthError('Credenciales incorrectas. Revisa tu email y contraseña.');
    }

    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f0f2f5] p-4">
      <div
        className="flex w-full overflow-hidden rounded-2xl"
        style={{
          maxWidth: 960,
          minHeight: 560,
          boxShadow: '0 4px 6px rgba(0,0,0,.04), 0 20px 60px rgba(0,0,0,.14), 0 1px 3px rgba(0,0,0,.08)',
        }}
      >
        {/* ── LEFT PANEL ── */}
        <div
          className="relative hidden flex-col justify-between overflow-hidden p-10 md:flex"
          style={{ flex: '0 0 60%', backgroundColor: '#1A2840' }}
        >
          {/* Decorative pill shapes */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute"
            style={{
              width: 420, height: 140,
              bottom: -30, right: -80,
              transform: 'rotate(-24deg)',
              borderRadius: 999,
              background: 'rgba(255,255,255,.045)',
            }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute"
            style={{
              width: 260, height: 80,
              top: 40, right: -40,
              transform: 'rotate(-24deg)',
              borderRadius: 999,
              background: 'rgba(255,255,255,.035)',
            }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute"
            style={{
              width: 180, height: 55,
              bottom: 110, right: 60,
              transform: 'rotate(-24deg)',
              borderRadius: 999,
              background: 'rgba(255,255,255,.06)',
            }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute"
            style={{
              width: 320, height: 95,
              top: 130, left: -80,
              transform: 'rotate(-24deg)',
              borderRadius: 999,
              background: 'rgba(255,255,255,.03)',
            }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute"
            style={{
              width: 100, height: 32,
              top: 220, left: 120,
              transform: 'rotate(-24deg)',
              borderRadius: 999,
              background: 'rgba(255,255,255,.055)',
            }}
          />

          {/* Wordmark */}
          <div className="relative z-10 flex items-center gap-2">
            <span
              className="inline-block rounded-full"
              style={{ width: 8, height: 8, background: 'rgba(255,255,255,.55)', flexShrink: 0 }}
            />
            <span
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: 'rgba(255,255,255,.85)', letterSpacing: '0.12em' }}
            >
              Content Store
            </span>
          </div>

          {/* Headline */}
          <div className="relative z-10 pb-12">
            <h1
              className="max-w-xs font-bold leading-tight tracking-tight text-white"
              style={{ fontSize: 'clamp(22px, 3vw, 30px)', letterSpacing: '-0.02em' }}
            >
              Your product catalog,<br />always at hand.
            </h1>
            <p
              className="mt-4 max-w-xs text-sm leading-relaxed"
              style={{ color: 'rgba(255,255,255,.45)' }}
            >
              Centralize, enrich, and distribute your product data across every channel.
            </p>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div
          className="flex flex-1 items-center justify-center bg-white px-10 py-12"
          style={{ flex: '0 0 40%' }}
        >
          <div className="w-full max-w-xs">
            <span
              className="mb-7 block text-[10.5px] font-semibold uppercase tracking-widest"
              style={{ color: '#9199a6', letterSpacing: '0.15em' }}
            >
              User Login
            </span>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Email */}
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"
                  style={{ width: 15, height: 15, color: '#b0b8c4' }}
                />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={event => {
                    setEmail(event.target.value);
                    if (authError) setAuthError(null);
                  }}
                  placeholder="you@company.com"
                  className="h-11 w-full rounded-lg border pl-10 pr-4 text-sm outline-none transition"
                  style={{
                    borderColor: '#e2e6ea',
                    background: '#fafbfc',
                    color: '#1e2a3a',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = '#1A2840';
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(26,40,64,.09)';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = '#e2e6ea';
                    e.currentTarget.style.background = '#fafbfc';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* Password */}
              <div className="relative">
                <LockKeyhole
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"
                  style={{ width: 15, height: 15, color: '#b0b8c4' }}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={event => {
                    setPassword(event.target.value);
                    if (authError) setAuthError(null);
                  }}
                  placeholder="Password"
                  className="h-11 w-full rounded-lg border pl-10 pr-10 text-sm outline-none transition"
                  style={{
                    borderColor: '#e2e6ea',
                    background: '#fafbfc',
                    color: '#1e2a3a',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = '#1A2840';
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(26,40,64,.09)';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = '#e2e6ea';
                    e.currentTarget.style.background = '#fafbfc';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center justify-center p-1 transition"
                  style={{ color: '#b0b8c4' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#6c7a8d'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#b0b8c4'; }}
                >
                  {showPassword
                    ? <EyeOff style={{ width: 15, height: 15 }} />
                    : <Eye style={{ width: 15, height: 15 }} />
                  }
                </button>
              </div>

              {/* Error */}
              {authError ? (
                <div
                  className="flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm"
                  style={{ borderColor: '#fecaca', background: '#fff5f5', color: '#b91c1c' }}
                >
                  <AlertCircle className="mt-px flex-none" style={{ width: 14, height: 14 }} />
                  <span>{authError}</span>
                </div>
              ) : null}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !email.trim() || !password.trim()}
                className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white transition"
                style={{
                  backgroundColor: '#1A2840',
                  boxShadow: '0 2px 8px rgba(26,40,64,.22)',
                  marginTop: 22,
                }}
                onMouseEnter={e => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.backgroundColor = '#243352';
                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(26,40,64,.32)';
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = '#1A2840';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(26,40,64,.22)';
                }}
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" style={{ width: 15, height: 15 }} />
                    Entrando...
                  </>
                ) : (
                  'Login'
                )}
              </button>
            </form>

            <a
              href="#"
              className="mt-4 block text-center text-xs transition"
              style={{ color: '#9199a6' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#1A2840'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#9199a6'; }}
            >
              Forgot password?
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
