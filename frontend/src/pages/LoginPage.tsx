import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function EnvelopeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3.5 6.5l8.5 6 8.5-6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 018 0v3" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 12S5 5.5 12 5.5 22.5 12 22.5 12 19 18.5 12 18.5 1.5 12 1.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3l18 18" />
      <path d="M10.6 5.6A10.6 10.6 0 0112 5.5c7 0 10.5 6.5 10.5 6.5a15.6 15.6 0 01-3.9 4.6M6.7 6.7C3.4 8.9 1.5 12 1.5 12S5 18.5 12 18.5a10.6 10.6 0 004.1-.8" />
      <path d="M9.9 9.9a3 3 0 004.2 4.2" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
    </svg>
  );
}

function LeafIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 19c9 0 14-5 14-14-9 0-14 5-14 14z" />
      <path d="M5 19c0-6 3-9 8-11" />
    </svg>
  );
}

function RibbonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="5" />
      <path d="M9 12.5L7.5 20l4.5-2.5 4.5 2.5-1.5-7.5" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
      <path d="M9 12l2 2 4-4.5" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
      <path d="M21.5 12a9.5 9.5 0 00-9.5-9.5" stroke="white" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Patrón decorativo muy discreto (carrito, gráfica, recibo, tendencia, caja) para el panel institucional. */
function BackgroundPattern() {
  return (
    <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <pattern id="pachos-login-pattern" width="150" height="150" patternUnits="userSpaceOnUse">
          <g stroke="white" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 12h6l4 20h20l4-14H24" />
            <circle cx="22" cy="38" r="2.2" />
            <circle cx="36" cy="38" r="2.2" />
          </g>
          <g stroke="white" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M74 40v-10M82 40v-16M90 40v-6" />
            <path d="M70 40h24" />
          </g>
          <g stroke="white" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M106 8h18v26l-3-2-3 2-3-2-3 2-3-2-3 2z" />
            <path d="M110 15h10M110 20h10" />
          </g>
          <g stroke="white" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 96l10-8 8 6 14-16" />
            <circle cx="40" cy="78" r="2" />
          </g>
          <g stroke="white" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M72 96l14-6 14 6-14 6z" />
            <path d="M72 96v14l14 6 14-6V96" />
            <path d="M86 102v14" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#pachos-login-pattern)" opacity="0.045" />
    </svg>
  );
}

const emptyErrors = { email: "", password: "" };

export function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showForgotHint, setShowForgotHint] = useState(false);
  const [fieldErrors, setFieldErrors] = useState(emptyErrors);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // "/" ya decide a dónde ir según el rol (HomeRedirect en App.tsx) — mandar
  // directo a /dashboard aquí dejaba a un Empleado atascado cargando una
  // página a la que no tiene permiso.
  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const nextErrors = { email: "", password: "" };
    if (!email.trim()) nextErrors.email = "El correo electrónico es obligatorio.";
    else if (!EMAIL_PATTERN.test(email.trim())) nextErrors.email = "Ingresa un correo válido.";
    if (!password) nextErrors.password = "La contraseña es obligatoria.";
    setFieldErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) return;

    setSubmitting(true);
    try {
      await login(email, password);
    } catch {
      setError("Las credenciales ingresadas no son correctas.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="flex min-h-[100dvh] flex-col font-poppins lg:grid lg:grid-cols-2"
      style={{
        paddingTop: "max(0px, env(safe-area-inset-top))",
        paddingBottom: "max(0px, env(safe-area-inset-bottom))",
      }}
    >
      {/* Panel institucional */}
      <div
        className="relative flex shrink-0 flex-col items-center overflow-hidden px-6 pb-10 pt-10 lg:justify-center lg:px-12 lg:py-16"
        style={{
          background: "linear-gradient(145deg, #1B5E20 0%, #2E7D32 55%, #246528 100%)",
        }}
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-brand-orange" />
        <BackgroundPattern />

        <div className="relative flex w-full flex-col items-center">
          <img
            src="/pachos-logo.png"
            alt="Pachos Minimarket"
            className="mb-6 w-[72%] max-w-[310px] object-contain lg:mb-10 lg:max-w-[400px]"
          />

          <p className="hidden max-w-xs text-center text-[15px] leading-relaxed text-white/90 lg:block">
            Frescura, calidad y buen precio para nuestra comunidad.
          </p>

          <div className="mt-9 hidden gap-8 lg:flex">
            {[
              { icon: <LeafIcon />, label: "Frescura" },
              { icon: <RibbonIcon />, label: "Calidad" },
              { icon: <ShieldIcon />, label: "Confianza" },
            ].map((attr) => (
              <div key={attr.label} className="flex flex-col items-center gap-2 text-white/85">
                {attr.icon}
                <span className="text-xs tracking-wide">{attr.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Panel del formulario */}
      <div className="flex flex-1 items-center justify-center bg-brand-grayLight px-4 py-8 lg:px-10 lg:py-16">
        <div
          className="w-[calc(100%-32px)] max-w-[480px] rounded-[20px] border border-[rgba(17,24,39,0.06)] bg-white p-7 lg:p-10"
          style={{
            boxShadow: "0 20px 50px rgba(17, 24, 39, 0.16), 0 4px 12px rgba(17, 24, 39, 0.08)",
          }}
        >
          <div className="mb-7">
            <span className="mb-3 block h-1 w-10 rounded-full bg-brand-orange" />
            <h1 className="text-[28px] font-bold leading-tight text-brand-text lg:text-[32px]">CFO Virtual</h1>
            <p className="mt-1 text-base text-brand-grayDark">Pachos Minimarket</p>
            <p className="mt-2 max-w-[38ch] text-sm text-brand-grayDark/90">
              Gestiona las finanzas y operaciones de tu supermercado.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-4">
              <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-brand-text">
                Correo electrónico
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
                  <EnvelopeIcon />
                </span>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="Ingresa tu correo"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!fieldErrors.email}
                  aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
                  className={`h-14 w-full rounded-[10px] border bg-white pl-11 pr-3.5 text-[15px] text-brand-text placeholder:text-[#9CA3AF] focus:outline-none focus:ring-4 ${
                    fieldErrors.email
                      ? "border-red-400 focus:border-red-400 focus:ring-red-100"
                      : "border-[#D1D5DB] focus:border-brand-orange focus:ring-[rgba(242,104,34,0.12)]"
                  }`}
                />
              </div>
              {fieldErrors.email && (
                <p id="login-email-error" className="mt-1.5 flex items-center gap-1.5 text-[13px] text-red-600">
                  <AlertIcon />
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div className="mb-2">
              <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-brand-text">
                Contraseña
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
                  <LockIcon />
                </span>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Ingresa tu contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
                  className={`h-14 w-full rounded-[10px] border bg-white pl-11 pr-11 text-[15px] text-brand-text placeholder:text-[#9CA3AF] focus:outline-none focus:ring-4 ${
                    fieldErrors.password
                      ? "border-red-400 focus:border-red-400 focus:ring-red-100"
                      : "border-[#D1D5DB] focus:border-brand-orange focus:ring-[rgba(242,104,34,0.12)]"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-[#9CA3AF] hover:text-brand-grayDark focus:outline-none focus:ring-2 focus:ring-brand-orange/40"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {fieldErrors.password && (
                <p id="login-password-error" className="mt-1.5 flex items-center gap-1.5 text-[13px] text-red-600">
                  <AlertIcon />
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <div className="mb-6 mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <label className="-my-2 flex cursor-pointer items-center gap-2 py-2">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-5 w-5 rounded border-[#D1D5DB] accent-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/40"
                />
                <span className="text-sm text-brand-grayDark">Recuérdame</span>
              </label>

              <button
                type="button"
                onClick={() => setShowForgotHint((v) => !v)}
                className="text-sm font-semibold text-brand-greenDark underline-offset-2 hover:text-brand-orange hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            {showForgotHint && (
              <p className="-mt-4 mb-6 rounded-lg bg-brand-greenLight px-3.5 py-2.5 text-[13px] text-brand-greenDark">
                Pídele al Dueño que te restablezca la contraseña desde Configuración → Usuarios.
              </p>
            )}

            {error && (
              <p className="mb-4 flex items-center gap-1.5 text-[13px] text-red-600" role="alert">
                <AlertIcon />
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-[10px] bg-brand-orange text-[16px] font-semibold text-white transition hover:bg-brand-orangeDark active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-brand-grayLight disabled:text-[#9CA3AF] disabled:active:scale-100"
              style={!submitting ? { boxShadow: "0 8px 20px rgba(242, 104, 34, 0.28)" } : undefined}
            >
              {submitting ? (
                <>
                  <Spinner />
                  Ingresando...
                </>
              ) : (
                <>
                  Ingresar
                  <ArrowRightIcon />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
