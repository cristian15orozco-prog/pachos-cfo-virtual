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
    // Si el token vence y renovarlo también falla (ej. la cookie de sesión de
    // 7 días ya expiró), esto saca al usuario para que vuelva a entrar, en
    // vez de dejar la app en un estado roto donde todo falla en silencio.
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
