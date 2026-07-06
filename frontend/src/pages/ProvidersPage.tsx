import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/apiClient";
import { Card, money } from "../components/ui";
import { Modal, FormField, inputClass } from "../components/Modal";
import { useAuth } from "../hooks/useAuth";

interface Provider {
  id: string;
  name: string;
  category: string | null;
  phone: string | null;
  email: string | null;
  invoiceCount: number;
  pendingBalance: number;
}

const emptyForm = {
  name: "",
  contactName: "",
  phone: "",
  email: "",
  address: "",
  category: "",
};

export function ProvidersPage() {
  const { user } = useAuth();
  const canCreate = user?.role === "OWNER" || user?.role === "ADMIN";
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["providers"],
    queryFn: () => api.get<{ data: Provider[] }>("/providers").then((r) => r.data),
  });

  const createProvider = useMutation({
    mutationFn: () =>
      api.post("/providers", {
        name: form.name,
        contactName: form.contactName || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
        category: form.category || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      queryClient.invalidateQueries({ queryKey: ["providers-simple"] });
      setShowForm(false);
      setForm(emptyForm);
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    createProvider.mutate();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Proveedores</h2>
        {canCreate && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-pachos-green text-white text-sm rounded-md px-4 py-2"
          >
            + Nuevo Proveedor
          </button>
        )}
      </div>
      <Card>
        {isLoading && <p className="text-slate-400 text-sm">Cargando...</p>}
        {!isLoading && data?.length === 0 && (
          <p className="text-slate-400 text-sm">Todavía no hay proveedores registrados.</p>
        )}
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-100">
              <th className="py-2">Nombre</th>
              <th>Categoría</th>
              <th>Contacto</th>
              <th># Facturas</th>
              <th className="text-right">Balance pendiente</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((p) => (
              <tr key={p.id} className="border-b border-slate-50">
                <td className="py-2 font-medium">{p.name}</td>
                <td>{p.category ?? "—"}</td>
                <td>{p.phone ?? p.email ?? "—"}</td>
                <td>{p.invoiceCount}</td>
                <td className="text-right">{money(p.pendingBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {showForm && (
        <Modal title="Nuevo Proveedor" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit}>
            <FormField label="Nombre">
              <input
                required
                className={inputClass}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </FormField>

            <FormField label="Categoría">
              <input
                className={inputClass}
                placeholder="Ej. Bebidas, Carnicería, Limpieza…"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </FormField>

            <FormField label="Nombre de contacto">
              <input
                className={inputClass}
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Teléfono">
                <input
                  className={inputClass}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </FormField>
              <FormField label="Email">
                <input
                  type="email"
                  className={inputClass}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </FormField>
            </div>

            <FormField label="Dirección">
              <input
                className={inputClass}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </FormField>

            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-sm px-4 py-2 rounded-md border border-slate-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={createProvider.isPending}
                className="bg-pachos-green text-white text-sm rounded-md px-4 py-2 disabled:opacity-50"
              >
                {createProvider.isPending ? "Guardando..." : "Guardar proveedor"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
