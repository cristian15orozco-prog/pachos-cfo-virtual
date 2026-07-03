import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
    } catch {
      setError("Credenciales inválidas.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-pachos-green">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-pachos-green mb-1">CFO Virtual</h1>
        <p className="text-sm text-slate-500 mb-6">Pachos Supermarket</p>

        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-slate-300 rounded-md px-3 py-2 mb-4 text-sm"
        />

        <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-slate-300 rounded-md px-3 py-2 mb-4 text-sm"
        />

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-pachos-green text-white rounded-md py-2 text-sm font-medium disabled:opacity-50"
        >
          {submitting ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
