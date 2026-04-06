// src/pages/LoginPage.tsx
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  clearAuthSession,
  login,
  requestPasswordReset,
  saveAuthSession,
} from '../../services/authApi';

// ── Types ───────────────────────────────────────────────────────────
interface FormData {
  email: string;
  password: string;
}

type LoginLocationState = {
  from?: {
    pathname: string;
    search?: string;
    hash?: string;
  };
};

function normalizeRedirectTarget(value: string | null): string | null {
  if (!value || !value.startsWith('/')) {
    return null;
  }

  if (value.startsWith('//')) {
    return null;
  }

  return value;
}

// ── Component ───────────────────────────────────────────────────────
export default function LoginPage() {
  const [form, setForm] = useState<FormData>({ email: '', password: '' });
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [forgotEmail, setForgotEmail] = useState<string>('');
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotInfo, setForgotInfo] = useState<string | null>(null);
  const [sendingOtp, setSendingOtp] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation() as ReturnType<typeof useLocation> & { state: LoginLocationState | null };
  const [searchParams] = useSearchParams();
  const queryRedirect = normalizeRedirectTarget(searchParams.get('redirect'));
  const redirectTo =
    typeof location.state?.from?.pathname === 'string'
      ? normalizeRedirectTarget(`${location.state.from.pathname}${location.state.from.search || ''}${location.state.from.hash || ''}`)
      : queryRedirect;

  // ── Stable scroll: reserve gutter always, hide track visually ──
  useEffect(() => {
    const id = 'clinika-login-scroll-fix';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = `
        html {
          overflow-y: scroll;
          scrollbar-width: none;
        }
        html::-webkit-scrollbar { display: none; width: 0; }
        body { overflow-x: hidden; }
      `;
      document.head.appendChild(style);
    }
    return () => {
      const el = document.getElementById(id);
      if (el) el.remove();
    };
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const resetForgotState = () => {
    setForgotError(null);
    setForgotInfo(null);
  };

  const handleSendOtp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setForgotError(null);
    setForgotInfo(null);

    if (!forgotEmail.trim()) {
      setForgotError('Please enter the email address for your account.');
      return;
    }

    setSendingOtp(true);
    const redirectTo = `${window.location.origin}/reset-password`;

    try {
      const response = await requestPasswordReset(forgotEmail.trim(), redirectTo);
      setForgotInfo(response.message);
    } catch (error) {
      setForgotError(error instanceof Error ? error.message : 'Unable to send reset link. Please try again.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError(null);

    try {
      clearAuthSession();
      const response = await login({
        email: form.email,
        password: form.password,
      });
      saveAuthSession(response);

      if (redirectTo && redirectTo !== '/login' && redirectTo !== '/register') {
        navigate(redirectTo, { replace: true });
      } else if (response.user.role === 'admin') {
        navigate('/admin/patients');
      } else if (response.user.role === 'ambulance') {
        navigate('/emergency');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Shared input base classes ────────────────────────────────────
  const inputBase =
    'w-full py-3.5 rounded-xl border border-gray-200 bg-gray-50/60 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition-all duration-200';

  return (
    <div className="min-h-screen flex font-['Inter','system-ui',sans-serif]">

      {/* ── Left decorative panel (desktop only) ────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 flex-col justify-between p-14 overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/5" />
        <div className="absolute top-1/3 -left-16 w-64 h-64 rounded-full bg-white/5" />
        <div className="absolute -bottom-24 right-1/4 w-96 h-96 rounded-full bg-blue-800/40" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="8" fill="rgba(255,255,255,0.15)" />
            <path d="M6 20h4l3-7 4 14 4-10 2 3h11" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-white font-extrabold text-2xl tracking-wide">
            CLINIKA<span className="text-blue-200">+</span>
          </span>
        </div>

        {/* Center content */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/10 rounded-full mb-8 backdrop-blur-sm border border-white/20">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-white/90 text-xs font-medium tracking-wide">HIPAA Compliant &amp; Secure</span>
          </div>
          <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
            Your clinical<br />intelligence<br />platform.
          </h2>
          <p className="text-blue-100 text-lg leading-relaxed max-w-md">
            Streamlined patient care, AI-powered assessments, and smart scheduling — all in one place.
          </p>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-blue-200/70 text-sm">
          © {new Date().getFullYear()} CLINIKA+. Built for healthcare professionals.
        </p>
      </div>

      {/* ── Right panel ─────────────────────────────────────────── */}
      {/*
        On mobile: full-width, min-h-screen so it fills the viewport.
        overflow-y-auto lets it scroll if content is taller than viewport (e.g. small phones).
        px/py give breathing room. items-start + pt-safe on tiny screens avoids notch overlap.
      */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center bg-white min-h-screen overflow-y-auto px-6 sm:px-12 py-12 lg:px-14">

        {/* Mobile logo — shown only below lg */}
        <div className="flex lg:hidden items-center gap-2.5 mb-10 self-start">
          <svg className="w-9 h-9" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="8" fill="#EFF6FF" />
            <path d="M6 20h4l3-7 4 14 4-10 2 3h11" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-blue-700 font-extrabold text-2xl tracking-wide">
            CLINIKA<span className="text-blue-500">+</span>
          </span>
        </div>

        {/* Form card */}
        <div className="w-full max-w-md">

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              {mode === 'login' ? 'Welcome back' : 'Forgot password'}
            </h1>
            <p className="text-gray-500 text-sm sm:text-base">
              {mode === 'login'
                ? 'Sign in to your CLINIKA+ account'
                : 'Enter your email to receive a password reset link'}
            </p>
          </div>

          {/* Alert banners */}
          {authError && mode === 'login' && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 leading-relaxed">
              {authError}
            </div>
          )}
          {forgotError && mode === 'forgot' && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 leading-relaxed">
              {forgotError}
            </div>
          )}
          {forgotInfo && mode === 'forgot' && (
            <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 leading-relaxed">
              {forgotInfo}
            </div>
          )}

          {/* ── Login form ── */}
          {mode === 'login' ? (
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-[18px] h-[18px] text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={form.email}
                    onChange={handleChange}
                    placeholder="you@hospital.com"
                    className={`${inputBase} pl-11 pr-4`}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setForgotEmail(form.email || '');
                      resetForgotState();
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-[18px] h-[18px] text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={form.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className={`${inputBase} pl-11 pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-blue-600/20 hover:shadow-blue-600/35 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 mt-1"
              >
                {isLoading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </button>
            </form>

          ) : (
            /* ── Forgot password form ── */
            <form onSubmit={handleSendOtp} className="space-y-5">
              <div>
                <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-[18px] h-[18px] text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input
                    id="forgot-email"
                    name="forgotEmail"
                    type="email"
                    autoComplete="email"
                    required
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    placeholder="you@hospital.com"
                    className={`${inputBase} pl-11 pr-4`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={sendingOtp}
                className="w-full flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-blue-600/20 hover:shadow-blue-600/35 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200"
              >
                {sendingOtp ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Sending link...</span>
                  </>
                ) : (
                  <>
                    <span>Send reset link</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setMode('login'); resetForgotState(); }}
                className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 font-medium transition-colors py-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to login
              </button>
            </form>
          )}

          {/* Divider + register — login mode only */}
          {mode === 'login' && (
            <>
              <div className="flex items-center gap-4 my-7">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-gray-400 text-sm">or</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <p className="text-center text-sm text-gray-500">
                Don't have an account?{' '}
                <Link to="/register" className="text-blue-600 font-semibold hover:text-blue-700 transition-colors">
                  Create one
                </Link>
              </p>

              {/* Security badge */}
              <div className="flex items-center justify-center gap-2 mt-8 text-gray-400 text-xs">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>256-bit encrypted · HIPAA compliant</span>
              </div>
            </>
          )}

        </div>
      </div>

    </div>
  );
}
