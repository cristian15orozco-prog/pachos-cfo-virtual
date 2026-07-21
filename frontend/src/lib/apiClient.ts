const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1";

let accessToken: string | null = null;
let onAuthFailure: (() => void) | null = null;
let refreshInFlight: Promise<string> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

/** Se llama cuando el token expiró y renovarlo también falló — la app debe volver al login. */
export function setOnAuthFailure(cb: () => void) {
  onAuthFailure = cb;
}

function authHeaders(): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

/**
 * El token de acceso dura solo 15 minutos. Sin esto, cualquier acción hecha
 * después de ese tiempo fallaba en silencio (parecía que "la app se
 * colgaba") hasta recargar la página entera. Ahora, si una petición llega
 * con el token vencido, se renueva sola (usando la cookie de sesión de 7
 * días) y se reintenta una vez — transparente para quien está usando la app.
 */
async function refreshAccessToken(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("No se pudo renovar la sesión.");
        const body = await res.json();
        accessToken = body.accessToken;
        return body.accessToken as string;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * El backend gratuito (Render) se duerme tras ~15 minutos sin tráfico, y
 * despertarlo de verdad (arrancar Node + el motor de Prisma + reconectar a
 * la base de datos) puede tardar 30-90 segundos, no solo unos pocos. Un
 * reintento corto (que fue el primer intento de arreglar esto) no alcanzaba
 * a esperar eso, así que la sesión igual se cerraba de la nada aunque el
 * token siguiera siendo válido. Este reintento insiste durante ~100
 * segundos antes de rendirse.
 */
async function refreshAccessTokenWithRetries(): Promise<string> {
  const delaysMs = [0, 3000, 6000, 10000, 15000, 20000, 20000, 25000];
  let lastError: unknown;
  for (const delay of delaysMs) {
    if (delay) await sleep(delay);
    try {
      return await refreshAccessToken();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function withAuthRetry(path: string, doFetch: () => Promise<Response>): Promise<Response> {
  const res = await doFetch();
  if (res.status === 401 && path !== "/auth/refresh" && path !== "/auth/login") {
    try {
      await refreshAccessTokenWithRetries();
      return await doFetch();
    } catch {
      accessToken = null;
      onAuthFailure?.();
    }
  }
  return res;
}

async function throwIfNotOk(res: Response): Promise<void> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Error ${res.status}`);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await withAuthRetry(path, () =>
    fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
        ...options.headers,
      },
    })
  );

  await throwIfNotOk(res);
  if (res.status === 204) return undefined as T;
  return res.json();
}

async function requestFormData<T>(path: string, formData: FormData): Promise<T> {
  const res = await withAuthRetry(path, () =>
    fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      credentials: "include",
      headers: authHeaders(),
      body: formData,
    })
  );

  await throwIfNotOk(res);
  return res.json();
}

async function requestBlob(path: string): Promise<Blob> {
  const res = await withAuthRetry(path, () =>
    fetch(`${API_BASE_URL}${path}`, {
      credentials: "include",
      headers: authHeaders(),
    })
  );

  await throwIfNotOk(res);
  return res.blob();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  postFormData: <T>(path: string, formData: FormData) => requestFormData<T>(path, formData),
  getBlob: (path: string) => requestBlob(path),
};
