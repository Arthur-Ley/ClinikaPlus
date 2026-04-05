// src/pages/RegisterPage.tsx
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "../../services/authApi";

// ── Types ───────────────────────────────────────────────────────────
type RegisterFormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  password: string;
  confirmPassword: string;
};

type FieldErrors = Partial<Record<keyof RegisterFormData, string>>;

// ── Validation ──────────────────────────────────────────────────────
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(form: RegisterFormData): FieldErrors {
  const errors: FieldErrors = {};

  if (!form.firstName.trim()) errors.firstName = "First name is required.";
  if (!form.lastName.trim()) errors.lastName = "Last name is required.";

  if (!form.email.trim()) errors.email = "Email is required.";
  else if (!emailRegex.test(form.email)) errors.email = "Enter a valid email.";

  if (!form.phone.trim()) errors.phone = "Phone number is required.";

  if (!form.dob.trim()) {
    errors.dob = "Birthdate is required.";
  } else {
    const today = new Date();
    const birthdate = new Date(form.dob);
    const minimumDate = new Date(
      today.getFullYear() - 18,
      today.getMonth(),
      today.getDate()
    );
    if (birthdate > minimumDate) errors.dob = "You must be at least 18 years old.";
  }

  if (!form.password.trim()) errors.password = "Password is required.";
  else if (form.password.length < 8) errors.password = "Use at least 8 characters.";

  if (!form.confirmPassword.trim()) errors.confirmPassword = "Confirm your password.";
  else if (form.confirmPassword !== form.password) errors.confirmPassword = "Passwords do not match.";

  return errors;
}

// ── Component ───────────────────────────────────────────────────────
export default function RegisterPage() {
  const navigate = useNavigate();
  const [registerForm, setRegisterForm] = useState<RegisterFormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dob: "",
    password: "",
    confirmPassword: "",
  });

  const [touched, setTouched] = useState<Partial<Record<keyof RegisterFormData, boolean>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const isSuccess = Boolean(submitSuccess);

  const errors = useMemo(() => validate(registerForm), [registerForm]);
  const canSubmit = Object.keys(errors).length === 0 && !isLoading;

  // ── Stable scroll: reserve gutter always, hide track visually ──
  useEffect(() => {
    const id = "clinika-register-scroll-fix";
    if (!document.getElementById(id)) {
      const style = document.createElement("style");
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

  const handleRegisterChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setRegisterForm((prev) => ({ ...prev, [name]: value }));
  };

  const markTouched = (name: keyof RegisterFormData) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const handleRegisterSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    // Mark all fields touched to show all errors
    setTouched({
      firstName: true, lastName: true, email: true,
      phone: true, dob: true, password: true, confirmPassword: true,
    });

    const currentErrors = validate(registerForm);
    if (Object.keys(currentErrors).length > 0) return;

    setIsLoading(true);

    try {
      const email = registerForm.email.trim();
      const response = await register({
        firstName: registerForm.firstName,
        lastName: registerForm.lastName,
        email,
        phone: registerForm.phone,
        dob: registerForm.dob,
        password: registerForm.password,
      });

      if (response.needsEmailConfirmation) {
        setSubmitSuccess(`Confirmation email sent to ${email}. Check your inbox and spam folder, then sign in.`);
        setTimeout(() => navigate("/login"), 1200);
        return;
      }

      setSubmitSuccess("Account created successfully. You can sign in now.");
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Shared input base ────────────────────────────────────────────
  const inputBase =
    "w-full py-3.5 rounded-xl border border-gray-200 bg-gray-50/60 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition-all duration-200";

  const FieldError = ({ msg }: { msg?: string }) =>
    msg ? <p className="mt-1.5 text-xs text-red-600">{msg}</p> : null;

  return (
    <div className="min-h-screen flex font-['Inter','system-ui',sans-serif]">

      {/* ── Left decorative panel (desktop only) ────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 flex-col justify-between p-14 overflow-hidden flex-shrink-0">
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
            Create your<br />CLINIKA+<br />account.
          </h2>
          <p className="text-blue-100 text-lg leading-relaxed max-w-md">
            Join the clinical intelligence platform built to streamline care, assessments, and scheduling.
          </p>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-blue-200/70 text-sm">
          © {new Date().getFullYear()} CLINIKA+. Built for healthcare professionals.
        </p>
      </div>

      {/* ── Right panel ─────────────────────────────────────────── */}
      {/*
        min-h-screen so it fills viewport on mobile.
        overflow-y-auto lets it scroll when content is taller than screen (long form on small phones).
        py-12 gives breathing room top + bottom; items-start + self-center keeps form vertically sensible.
      */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-start lg:justify-center bg-white min-h-screen overflow-y-auto px-6 sm:px-12 lg:px-14 py-12">

        {/* Mobile logo */}
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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Create account</h1>
            <p className="text-gray-500 text-sm sm:text-base">Create your CLINIKA+ account</p>
          </div>

          {/* Alert banner */}
          {(submitError || submitSuccess) && (
            <div
              className={[
                "mb-5 rounded-xl border px-4 py-3 text-sm leading-relaxed",
                submitError
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700",
              ].join(" ")}
            >
              {submitError ?? submitSuccess}
            </div>
          )}

          {/* Form — hidden after success */}
          {!isSuccess && (
            <form onSubmit={handleRegisterSubmit} className="space-y-5">

              {/* First + Last name row */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1.5">
                    First Name
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    autoComplete="given-name"
                    value={registerForm.firstName}
                    onChange={handleRegisterChange}
                    onBlur={() => markTouched("firstName")}
                    placeholder="First name"
                    className={`${inputBase} px-4`}
                  />
                  <FieldError msg={touched.firstName ? errors.firstName : undefined} />
                </div>

                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Last Name
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    autoComplete="family-name"
                    value={registerForm.lastName}
                    onChange={handleRegisterChange}
                    onBlur={() => markTouched("lastName")}
                    placeholder="Last name"
                    className={`${inputBase} px-4`}
                  />
                  <FieldError msg={touched.lastName ? errors.lastName : undefined} />
                </div>
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email
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
                    value={registerForm.email}
                    onChange={handleRegisterChange}
                    onBlur={() => markTouched("email")}
                    placeholder="your.email@example.com"
                    className={`${inputBase} pl-11 pr-4`}
                  />
                </div>
                <FieldError msg={touched.email ? errors.email : undefined} />
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Phone Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-[18px] h-[18px] text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    value={registerForm.phone}
                    onChange={handleRegisterChange}
                    onBlur={() => markTouched("phone")}
                    placeholder="+639631234567"
                    className={`${inputBase} pl-11 pr-4`}
                  />
                </div>
                <FieldError msg={touched.phone ? errors.phone : undefined} />
              </div>

              {/* Date of Birth */}
              <div>
                <label htmlFor="dob" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Date of Birth
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-[18px] h-[18px] text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input
                    id="dob"
                    name="dob"
                    type="date"
                    value={registerForm.dob}
                    onChange={handleRegisterChange}
                    onBlur={() => markTouched("dob")}
                    className={`${inputBase} pl-11 pr-4`}
                  />
                </div>
                <FieldError msg={touched.dob ? errors.dob : undefined} />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-[18px] h-[18px] text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={registerForm.password}
                    onChange={handleRegisterChange}
                    onBlur={() => markTouched("password")}
                    placeholder="Create password"
                    className={`${inputBase} pl-11 pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <FieldError msg={touched.password ? errors.password : undefined} />
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-[18px] h-[18px] text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={registerForm.confirmPassword}
                    onChange={handleRegisterChange}
                    onBlur={() => markTouched("confirmPassword")}
                    placeholder="Confirm password"
                    className={`${inputBase} pl-11 pr-4`}
                  />
                </div>
                <FieldError msg={touched.confirmPassword ? errors.confirmPassword : undefined} />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-blue-600/20 hover:shadow-blue-600/35 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 mt-1"
              >
                {isLoading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Creating account...</span>
                  </>
                ) : (
                  <span>Create Account</span>
                )}
              </button>
            </form>
          )}

          {/* Sign in link */}
          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-blue-600 font-semibold hover:text-blue-700 transition-colors">
              Sign in
            </Link>
          </p>

          {/* Security badge */}
          <div className="flex items-center justify-center gap-2 mt-6 mb-4 text-gray-400 text-xs">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>256-bit encrypted · HIPAA compliant</span>
          </div>

        </div>
      </div>
    </div>
  );
}
