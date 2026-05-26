import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTenantBranding } from '../hooks/useTenantBranding';
import { supabase } from '../lib/supabase';

// Brand tokens
const TOKEN = {
  bg:            '#0D1117',
  surface:       '#111827',
  surfaceAlt:    '#1A2233',
  border:        '#273244',
  text:          '#F5F7FA',
  textSecondary: '#A8B3C7',
  cyan:          '#00B7A7',
  blue:          '#4E6BFF',
  purple:        '#8B5CF6',
  error:         '#FF5C7A',
  errorBg:       'rgba(255,92,122,0.08)',
  errorBorder:   'rgba(255,92,122,0.25)',
  gradient:      'linear-gradient(135deg, #00B7A7 0%, #4E6BFF 50%, #8B5CF6 100%)',
  radius:        '14px',
  radiusSm:      '8px',
  ease:          'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

export default function LoginPage() {
  const { user, profile } = useAuth();
  const branding = useTenantBranding(profile?.tenantId);
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [authError, setAuthError]     = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted]         = useState(false);

  useEffect(() => {
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap';
    document.head.appendChild(link);
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  if (user) return <Navigate to="/" replace />;

  const tenantName = branding?.tenantName ?? 'Content Store';

  const handleLogin = async () => {
    if (loading) return;
    setLoading(true);
    setAuthError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) setAuthError('Credenciales incorrectas. Revisa tu email y contraseña.');
    setLoading(false);
  };

  const clearError = () => { if (authError) setAuthError(null); };

  return (
    <>
      <style>{`
        @keyframes orb-drift-a {
          0%,100% { transform: translate(0,0) scale(1); }
          40%      { transform: translate(60px,-80px) scale(1.12); }
          70%      { transform: translate(-30px,40px) scale(0.94); }
        }
        @keyframes orb-drift-b {
          0%,100% { transform: translate(0,0) scale(1); }
          35%      { transform: translate(-70px,50px) scale(1.08); }
          75%      { transform: translate(40px,-30px) scale(0.96); }
        }
        @keyframes orb-drift-c {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(45px,65px) scale(1.14); }
        }
        @keyframes cs-fade-up {
          from { opacity:0; transform:translateY(16px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes cs-fade-right {
          from { opacity:0; transform:translateX(-16px); }
          to   { opacity:1; transform:translateX(0); }
        }
        @keyframes cs-fade-in {
          from { opacity:0; }
          to   { opacity:1; }
        }
        @keyframes gradient-shift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .cs-login * { box-sizing:border-box; }
        .cs-login {
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          min-height: 100vh;
          display: flex;
          background: ${TOKEN.bg};
        }

        /* ── inputs ── */
        .cs-input {
          width:100%;
          background: ${TOKEN.surfaceAlt};
          border: 1.5px solid ${TOKEN.border};
          border-radius: ${TOKEN.radiusSm};
          padding: 11px 14px;
          font-size: 14px;
          font-family: inherit;
          color: ${TOKEN.text};
          outline: none;
          transition: border-color 220ms ${TOKEN.ease}, box-shadow 220ms ${TOKEN.ease};
          letter-spacing: 0.01em;
        }
        .cs-input::placeholder { color: rgba(168,179,199,0.45); }
        .cs-input:focus {
          border-color: ${TOKEN.cyan};
          box-shadow: 0 0 0 3px rgba(0,183,167,0.12);
        }
        .cs-input-error {
          border-color: ${TOKEN.error} !important;
        }
        .cs-input-error:focus {
          box-shadow: 0 0 0 3px rgba(255,92,122,0.12) !important;
        }
        .cs-input-pw { padding-right: 44px; }

        /* ── button ── */
        .cs-btn {
          width:100%;
          display:flex; align-items:center; justify-content:center; gap:8px;
          background: ${TOKEN.gradient};
          background-size: 200% 200%;
          animation: gradient-shift 5s ease infinite;
          color: #fff;
          border: none;
          border-radius: ${TOKEN.radius};
          height: 44px;
          font-size: 13px;
          font-weight: 500;
          font-family: inherit;
          letter-spacing: 0.04em;
          cursor: pointer;
          transition: opacity 220ms ${TOKEN.ease}, transform 120ms ${TOKEN.ease}, box-shadow 220ms ${TOKEN.ease};
          box-shadow: 0 4px 20px rgba(0,183,167,0.22);
        }
        .cs-btn:hover:not(:disabled) {
          opacity: .92;
          transform: translateY(-1px);
          box-shadow: 0 8px 28px rgba(0,183,167,0.32);
        }
        .cs-btn:active:not(:disabled) { transform:translateY(0); }
        .cs-btn:disabled {
          opacity: .28;
          cursor: not-allowed;
          animation: none;
          background: #334155;
          box-shadow: none;
        }

        /* ── eye button ── */
        .cs-eye {
          position:absolute; right:13px; top:50%; transform:translateY(-50%);
          background:none; border:none; cursor:pointer; padding:0; display:flex;
          color: ${TOKEN.textSecondary};
          transition: color 150ms ${TOKEN.ease};
        }
        .cs-eye:hover { color: ${TOKEN.text}; }

        /* ── reveal animations ── */
        .cs-reveal-up   { opacity:0; }
        .cs-reveal-right{ opacity:0; }
        .cs-mounted .cs-reveal-up    { animation: cs-fade-up    520ms ${TOKEN.ease} both; }
        .cs-mounted .cs-reveal-right { animation: cs-fade-right 520ms ${TOKEN.ease} both; }
        .cs-d1  { animation-delay:  80ms !important; }
        .cs-d2  { animation-delay: 160ms !important; }
        .cs-d3  { animation-delay: 240ms !important; }
        .cs-d4  { animation-delay: 320ms !important; }
        .cs-d5  { animation-delay: 400ms !important; }

        /* ── left panel ── */
        .cs-left {
          display:none;
          flex:1;
          position:relative;
          overflow:hidden;
          background: ${TOKEN.bg};
        }
        @media(min-width:1024px){ .cs-left { display:flex; flex-direction:column; justify-content:space-between; padding:48px 56px; } }

        /* ── right panel ── */
        .cs-right {
          width:100%;
          background: ${TOKEN.surface};
          display:flex;
          flex-direction:column;
          justify-content:center;
          align-items:center;
          padding: 52px 28px;
          position:relative;
        }
        @media(min-width:1024px){
          .cs-right {
            width: 460px;
            flex-shrink:0;
            min-height:100vh;
            border-left: 1px solid ${TOKEN.border};
          }
        }

        /* ── gradient line top of right panel ── */
        .cs-right::before {
          content:'';
          position:absolute; top:0; left:0; right:0; height:1px;
          background: ${TOKEN.gradient};
          opacity:.35;
        }
        @media(min-width:1024px){ .cs-right::before { display:none; } }
      `}</style>

      <div className={`cs-login${mounted ? ' cs-mounted' : ''}`}>

        {/* ── LEFT PANEL ── */}
        <div className="cs-left">
          {/* Gradient orbs */}
          <div aria-hidden="true" style={{
            position:'absolute', width:700, height:700, borderRadius:'50%',
            background:'radial-gradient(circle, rgba(0,183,167,0.28) 0%, transparent 65%)',
            top:-200, left:-180,
            animation:'orb-drift-a 20s ease-in-out infinite',
            pointerEvents:'none', filter:'blur(2px)',
          }} />
          <div aria-hidden="true" style={{
            position:'absolute', width:550, height:550, borderRadius:'50%',
            background:'radial-gradient(circle, rgba(78,107,255,0.22) 0%, transparent 65%)',
            bottom:-100, right:-120,
            animation:'orb-drift-b 25s ease-in-out infinite',
            pointerEvents:'none',
          }} />
          <div aria-hidden="true" style={{
            position:'absolute', width:380, height:380, borderRadius:'50%',
            background:'radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 65%)',
            top:'40%', left:'40%',
            animation:'orb-drift-c 30s ease-in-out infinite',
            pointerEvents:'none',
          }} />

          {/* Dot grid */}
          <div aria-hidden="true" style={{
            position:'absolute', inset:0,
            backgroundImage:'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)',
            backgroundSize:'28px 28px', pointerEvents:'none',
          }} />

          {/* Vignette */}
          <div aria-hidden="true" style={{
            position:'absolute', inset:0,
            background:'radial-gradient(ellipse 75% 75% at 50% 50%, transparent 45%, rgba(13,17,23,0.82) 100%)',
            pointerEvents:'none',
          }} />

          {/* Content */}
          <div style={{ position:'relative', zIndex:1 }}>
            {/* Logo */}
            <div className="cs-reveal-right cs-d1" style={{ display:'flex', alignItems:'center', gap:12 }}>
              <img
                src="/cs-logo-brand.png"
                alt="Content Store"
                style={{
                  height: 40,
                  width: 'auto',
                  objectFit: 'contain',
                  filter: 'brightness(0) invert(1)',
                  opacity: 0.9,
                }}
                onError={e => {
                  const img = e.currentTarget;
                  img.src = '/cs-logo.png';
                  img.onerror = () => { img.style.display = 'none'; };
                }}
              />
            </div>
          </div>

          <div style={{ position:'relative', zIndex:1 }}>
            {/* Tenant pill */}
            <div className="cs-reveal-up cs-d2" style={{
              display:'inline-flex', alignItems:'center', gap:7,
              background:'rgba(255,255,255,0.04)',
              border:'1px solid rgba(255,255,255,0.08)',
              borderRadius:100, padding:'5px 14px', marginBottom:28,
              backdropFilter:'blur(6px)',
            }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:'#00C48C', flexShrink:0 }} />
              <span style={{ color:'rgba(255,255,255,0.4)', fontSize:11, letterSpacing:'0.06em', fontWeight:500 }}>
                {tenantName}
              </span>
            </div>

            {/* Headline */}
            <h1 className="cs-reveal-up cs-d3" style={{
              fontSize:'clamp(2rem,3vw,2.9rem)',
              fontWeight:600,
              lineHeight:1.1,
              letterSpacing:'-0.02em',
              color: TOKEN.text,
              marginBottom:16,
            }}>
              Tu catálogo de<br />
              <span style={{
                background: TOKEN.gradient,
                WebkitBackgroundClip:'text',
                WebkitTextFillColor:'transparent',
                backgroundClip:'text',
              }}>
                producto
              </span>
              ,<br />
              en un solo lugar.
            </h1>

            <p className="cs-reveal-up cs-d4" style={{
              color: TOKEN.textSecondary, fontSize:13, lineHeight:1.75, maxWidth:320, marginBottom:32,
            }}>
              Gestiona fichas técnicas, activos digitales y canales de publicación desde un espacio centralizado conectado a tu PIM.
            </p>

            {/* Feature tags */}
            <div className="cs-reveal-up cs-d5" style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {['Catálogo visual', 'Multicanal', 'Tiempo real', 'Multi-tenant'].map(tag => (
                <span key={tag} style={{
                  background:'rgba(255,255,255,0.04)',
                  border:'1px solid rgba(255,255,255,0.07)',
                  borderRadius:6, padding:'4px 12px',
                  fontSize:11, color:'rgba(255,255,255,0.3)', letterSpacing:'0.04em',
                }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <p style={{
            position:'relative', zIndex:1,
            color:'rgba(255,255,255,0.12)', fontSize:9, letterSpacing:'0.1em', textTransform:'uppercase',
          }}>
            © {new Date().getFullYear()} Pimly · Content Store
          </p>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="cs-right">
          <div style={{ width:'100%', maxWidth:360 }}>

            {/* Mobile logo — hidden on desktop (left panel has its own) */}
            <div className="cs-reveal-up lg:hidden" style={{ display:'flex', alignItems:'center', gap:10, marginBottom:40 }}>
              <img
                src="/cs-logo-brand.png"
                alt="Content Store"
                style={{
                  height: 32,
                  width: 'auto',
                  objectFit: 'contain',
                  filter: 'brightness(0) invert(1)',
                  opacity: 0.85,
                }}
                onError={e => { e.currentTarget.style.display = 'none'; }}
                className="lg:hidden"
              />
            </div>

            {/* Header */}
            <div className="cs-reveal-up cs-d1" style={{ marginBottom:32 }}>
              <p style={{
                fontSize:10, fontWeight:500, letterSpacing:'0.1em',
                textTransform:'uppercase', color: TOKEN.textSecondary,
                marginBottom:10,
              }}>
                Acceso seguro
              </p>
              <h2 style={{
                fontSize:26, fontWeight:600, letterSpacing:'-0.02em',
                color: TOKEN.text, lineHeight:1.1, marginBottom:8,
              }}>
                Bienvenido
              </h2>
              <p style={{ fontSize:13, color: TOKEN.textSecondary, lineHeight:1.6 }}>
                Introduce tus credenciales para continuar
              </p>
            </div>

            {/* Error */}
            {authError && (
              <div style={{
                display:'flex', alignItems:'flex-start', gap:9,
                background: TOKEN.errorBg,
                border:`1px solid ${TOKEN.errorBorder}`,
                borderRadius: TOKEN.radiusSm,
                padding:'10px 13px', marginBottom:20,
                fontSize:12.5, color: TOKEN.error, lineHeight:1.55,
                animation:`cs-fade-in 200ms ${TOKEN.ease} both`,
              }}>
                <AlertCircle size={14} style={{ flexShrink:0, marginTop:1 }} />
                {authError}
              </div>
            )}

            {/* Form */}
            <div className="cs-reveal-up cs-d2">
              {/* Email */}
              <div style={{ marginBottom:16 }}>
                <label style={{
                  display:'block', fontSize:11, fontWeight:500,
                  letterSpacing:'0.08em', textTransform:'uppercase',
                  color: TOKEN.textSecondary, marginBottom:7,
                }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); clearError(); }}
                  placeholder="tu@empresa.com"
                  autoComplete="email"
                  className={`cs-input${authError ? ' cs-input-error' : ''}`}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom:6 }}>
                <label style={{
                  display:'block', fontSize:11, fontWeight:500,
                  letterSpacing:'0.08em', textTransform:'uppercase',
                  color: TOKEN.textSecondary, marginBottom:7,
                }}>
                  Contraseña
                </label>
                <div style={{ position:'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); clearError(); }}
                    onKeyDown={e => { if (e.key === 'Enter') void handleLogin(); }}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className={`cs-input cs-input-pw${authError ? ' cs-input-error' : ''}`}
                  />
                  <button
                    type="button"
                    className="cs-eye"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="button"
                className="cs-btn"
                style={{ marginTop:22 }}
                onClick={() => void handleLogin()}
                disabled={loading || !email || !password}
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {loading ? 'Verificando…' : 'Entrar'}
              </button>
            </div>

            {/* Divider */}
            <div aria-hidden="true" style={{
              height:1, background: TOKEN.border, margin:'28px 0',
            }} />

            {/* Help */}
            <p className="cs-reveal-up cs-d3" style={{
              textAlign:'center', fontSize:12.5, color: TOKEN.textSecondary,
            }}>
              ¿Problemas para acceder?{' '}
              <a
                href="mailto:soporte@pimly.io"
                style={{ color: TOKEN.cyan, textDecoration:'underline', textUnderlineOffset:3 }}
              >
                Solicitar ayuda
              </a>
            </p>
          </div>
        </div>

      </div>
    </>
  );
}
