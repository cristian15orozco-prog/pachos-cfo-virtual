import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/apiClient";
import { Card, Badge, money, formatDateOnly } from "../components/ui";
import { Modal, FormField, inputClass } from "../components/Modal";
import { useAuth } from "../hooks/useAuth";

interface Provider {
  id: string;
  name: string;
  contactName: string | null;
  category: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  invoiceCount: number;
  pendingBalance: number;
}

interface ProviderInvoice {
  id: string;
  invoiceNumber: string;
  total: string;
  dueDate: string;
  status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
  attachments: { id: string; fileName: string; mimeType: string }[];
}

const STATUS_TONE: Record<ProviderInvoice["status"], "default" | "warning" | "danger" | "success"> = {
  PENDING: "default",
  PARTIAL: "warning",
  PAID: "success",
  OVERDUE: "danger",
};

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

  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editError, setEditError] = useState<string | null>(null);

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

  const isOwner = user?.role === "OWNER";

  const updateProvider = useMutation({
    mutationFn: () => {
      if (!editingProvider) return Promise.reject(new Error("Sin proveedor seleccionado"));
      return api.patch(`/providers/${editingProvider.id}`, {
        name: editForm.name,
        contactName: editForm.contactName || undefined,
        phone: editForm.phone || undefined,
        email: editForm.email || undefined,
        address: editForm.address || undefined,
        category: editForm.category || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      queryClient.invalidateQueries({ queryKey: ["providers-simple"] });
      queryClient.invalidateQueries({ queryKey: ["providers-names"] });
      setEditingProvider(null);
      setEditError(null);
    },
    onError: (err: Error) => setEditError(err.message),
  });

  function openEditModal(provider: Provider) {
    setEditingProvider(provider);
    setEditForm({
      name: provider.name,
      contactName: provider.contactName ?? "",
      phone: provider.phone ?? "",
      email: provider.email ?? "",
      address: provider.address ?? "",
      category: provider.category ?? "",
    });
    setEditError(null);
  }

  function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    updateProvider.mutate();
  }
  const [viewingProvider, setViewingProvider] = useState<Provider | null>(null);
  const [viewError, setViewError] = useState<string | null>(null);

  const providerInvoices = useQuery({
    queryKey: ["invoices", "by-provider", viewingProvider?.id],
    queryFn: () =>
      api.get<{ data: ProviderInvoice[] }>(`/invoices?providerId=${viewingProvider!.id}`).then((r) => r.data),
    enabled: !!viewingProvider,
  });

  // El PDF de una factura solo lo puede ver el Dueño (el backend también lo exige).
  async function viewInvoicePdf(attachmentId: string) {
    setViewError(null);
    try {
      const blob = await api.getBlob(`/attachments/${attachmentId}/file`);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setViewError((err as Error).message);
    }
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
              {isOwner && <th></th>}
            </tr>
          </thead>
          <tbody>
            {data?.map((p) => (
              <tr
                key={p.id}
                onClick={() => setViewingProvider(p)}
                className="border-b border-slate-50 cursor-pointer hover:bg-slate-50"
              >
                <td className="py-2 font-medium text-pachos-green underline">{p.name}</td>
                <td>{p.category ?? "—"}</td>
                <td>{p.phone ?? p.email ?? "—"}</td>
                <td>{p.invoiceCount}</td>
                <td className="text-right">{money(p.pendingBalance)}</td>
                {isOwner && (
                  <td className="text-right pl-3 whitespace-nowrap">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(p);
                      }}
                      className="text-xs text-slate-500 underline"
                    >
                      ✏️ Editar
                    </button>
                  </td>
                )}
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

      {viewingProvider && (
        <Modal title={`Facturas — ${viewingProvider.name}`} onClose={() => setViewingProvider(null)}>
          {viewError && <p className="text-sm text-red-600 mb-3">{viewError}</p>}
          {providerInvoices.isLoading && <p className="text-slate-400 text-sm">Cargando...</p>}
          {!providerInvoices.isLoading && providerInvoices.data?.length === 0 && (
            <p className="text-slate-400 text-sm">Este proveedor todavía no tiene facturas registradas.</p>
          )}
          {!!providerInvoices.data?.length && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="py-2">Factura</th>
                  <th>Vence</th>
                  <th>Estado</th>
                  <th className="text-right">Total</th>
                  {isOwner && <th></th>}
                </tr>
              </thead>
              <tbody>
                {providerInvoices.data?.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-50">
                    <td className="py-2">{inv.invoiceNumber}</td>
                    <td>{formatDateOnly(inv.dueDate)}</td>
                    <td>
                      <Badge tone={STATUS_TONE[inv.status]}>{inv.status}</Badge>
                    </td>
                    <td className="text-right">{money(inv.total)}</td>
                    {isOwner && (
                      <td className="text-right pl-3 whitespace-nowrap">
                        {inv.attachments
                          .filter((a) => a.mimeType === "application/pdf")
                          .map((a) => (
                            <button
                              key={a.id}
                              onClick={() => viewInvoicePdf(a.id)}
                              className="text-xs text-slate-500 underline"
                            >
                              📄 Ver PDF
                            </button>
                          ))}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal>
      )}

      {editingProvider && (
        <Modal title={`Editar Proveedor — ${editingProvider.name}`} onClose={() => setEditingProvider(null)}>
          <form onSubmit={handleEditSubmit}>
            <FormField label="Nombre">
              <input
                required
                className={inputClass}
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </FormField>

            <FormField label="Categoría">
              <input
                className={inputClass}
                placeholder="Ej. Bebidas, Carnicería, Limpieza…"
                value={editForm.category}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
              />
            </FormField>

            <FormField label="Nombre de contacto">
              <input
                className={inputClass}
                value={editForm.contactName}
                onChange={(e) => setEditForm({ ...editForm, contactName: e.target.value })}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Teléfono">
                <input
                  className={inputClass}
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </FormField>
              <FormField label="Email">
                <input
                  type="email"
                  className={inputClass}
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </FormField>
            </div>

            <FormField label="Dirección">
              <input
                className={inputClass}
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              />
            </FormField>

            {editError && <p className="text-sm text-red-600 mb-3">{editError}</p>}

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setEditingProvider(null)}
                className="text-sm px-4 py-2 rounded-md border border-slate-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={updateProvider.isPending}
                className="bg-pachos-green text-white text-sm rounded-md px-4 py-2 disabled:opacity-50"
              >
                {updateProvider.isPending ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
