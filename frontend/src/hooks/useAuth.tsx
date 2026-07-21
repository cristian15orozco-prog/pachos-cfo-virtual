import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api, setAccessToken, setOnAuthFailure } from "../lib/apiClient";

export type Role = "OWNER" | "ADMIN" | "ACCOUNTANT" | "EMPLOYEE";

interface CurrentUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
}

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Si el token vence y renovarlo también falla (ej. la cookie de sesión ya
    // expiró — ahora dura 365 días), esto saca al usuario para que vuelva a
    // entrar, en vez de dejar la app en un estado roto donde todo falla en
    // silencio.
    setOnAuthFailure(() => setUser(null));

    api
      .post<{ accessToken: string }>("/auth/refresh")
      .then(async ({ accessToken }) => {
        setAccessToken(accessToken);
        const { data } = await api.get<{ data: CurrentUser }>("/auth/me");
        setUser(data);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));

    // Renueva la sesión sola cada 10 minutos mientras la pestaña siga
    // abierta — el token de acceso dura 15 minutos, así que sin esto una
    // pestaña abierta sin actividad podía quedarse "colgada" hasta la
    // siguiente acción. Esto también reinicia el reloj de la cookie de 365
    // días (ventana deslizante), para que el programa se quede abierto
    // indefinidamente mientras se use al menos una vez al año.
    const interval = setInterval(
      () => {
        api
          .post<{ accessToken: string }>("/auth/refresh")
          .then(({ accessToken }) => setAccessToken(accessToken))
          .catch(() => {
            // Un fallo puntual (ej. el backend gratuito de Render despertando de
            // su modo inactivo) no debe cerrar la sesión — solo se sale si una
            // acción real del usuario también falla, vía onAuthFailure.
          });
      },
      10 * 60 * 1000
    );
    return () => clearInterval(interval);
  }, []);

  async function login(email: string, password: string) {
    const { accessToken } = await api.post<{ accessToken: string }>("/auth/login", { email, password });
    setAccessToken(accessToken);
    const { data } = await api.get<{ data: CurrentUser }>("/auth/me");
    setUser(data);
  }

  async function logout() {
    await api.post("/auth/logout");
    setAccessToken(null);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
