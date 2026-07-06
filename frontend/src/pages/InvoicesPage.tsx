import { useMemo, useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/apiClient";
import { Card, Badge, money } from "../components/ui";
import { Modal, FormField, inputClass } from "../components/Modal";
import { useAuth } from "../hooks/useAuth";

interface Invoice {
  id: string;
  invoiceNumber: string;
  total: string;
  dueDate: string;
  status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
  isDuplicateFlag: boolean;
  provider: { name: string };
}

interface Provider {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

const STATUS_TONE: Record<Invoice["status"], "default" | "warning" | "danger" | "success"> = {
  PENDING: "default",
  PARTIAL: "warning",
  PAID: "success",
  OVERDUE: "danger",
};

const emptyForm = {
  providerId: "",
  invoiceNumber: "",
  invoiceDate: "",
  dueDate: "",
  subtotal: "",
  tax: "",
  categoryId: "",
  notes: "",
};

export function InvoicesPage() {
  const { user } = useAuth();
  const canCreate = user?.role === "OWNER" || user?.role === "ADMIN";
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => api.get<{ data: Invoice[] }>("/invoices").then((r) => r.data),
  });

  const { data: providers } = useQuery({
    queryKey: ["providers-simple"],
    queryFn: () => api.get<{ data: Provider[] }>("/providers").then((r) => r.data),
    enabled: showForm,
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<{ data: Category[] }>("/categories").then((r) => r.data),
    enabled: showForm,
  });

  const subtotalNum = Number(form.subtotal) || 0;
  const taxNum = Number(form.tax) || 0;
  const total = useMemo(() => subtotalNum + taxNum, [subtotalNum, taxNum]);

  const createInvoice = useMutation({
    mutationFn: () =>
      api.post("/invoices", {
        providerId: form.providerId,
        invoiceNumber: form.invoiceNumber,
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate,
        subtotal: subtotalNum,
        tax: taxNum,
        total,
        categoryId: form.categoryId || undefined,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setShowForm(false);
      setForm(emptyForm);
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    createInvoice.mutate();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Facturas de Proveedores</h2>
        {canCreate && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-pachos-green text-white text-sm rounded-md px-4 py-2"
          >
            + Nueva Factura
          </button>
        )}
      </div>

      <Card>
        {isLoading && <p className="text-slate-400 text-sm">Cargando...</p>}
        {!isLoading && data?.length === 0 && (
          <p className="text-slate-400 text-sm">Todavía no hay facturas registradas.</p>
        )}
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-100">
              <th className="py-2">Proveedor</th>
              <th>Factura</th>
              <th>Vence</th>
              <th>Estado</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((inv) => (
              <tr key={inv.id} className="border-b border-slate-50">
                <td className="py-2">{inv.provider.name}</td>
                <td>
                  {inv.invoiceNumber} {inv.isDuplicateFlag && <Badge tone="danger">posible duplicado</Badge>}
                </td>
                <td>{new Date(inv.dueDate).toLocaleDateString()}</td>
                <td>
                  <Badge tone={STATUS_TONE[inv.status]}>{inv.status}</Badge>
                </td>
                <td className="text-right">{money(inv.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {showForm && (
        <Modal title="Nueva Factura" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit}>
            <FormField label="Proveedor">
              <select
                required
                className={inputClass}
                value={form.providerId}
                onChange={(e) => setForm({ ...form, providerId: e.target.value })}
              >
                <option value="">Selecciona un proveedor…</option>
                {providers?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Número de factura">
              <input
                required
                className={inputClass}
                value={form.invoiceNumber}
                onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Fecha de factura">
                <input
                  required
                  type="date"
                  className={inputClass}
                  value={form.invoiceDate}
                  onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })}
                />
              </FormField>
              <FormField label="Fecha de vencimiento">
                <input
                  required
                  type="date"
                  className={inputClass}
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Subtotal">
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputClass}
                  value={form.subtotal}
                  onChange={(e) => setForm({ ...form, subtotal: e.target.value })}
                />
              </FormField>
              <FormField label="Impuestos">
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputClass}
                  value={form.tax}
                  onChange={(e) => setForm({ ...form, tax: e.target.value })}
                />
              </FormField>
            </div>

            <FormField label="Total">
              <input disabled className={`${inputClass} bg-slate-50 text-slate-500`} value={total.toFixed(2)} />
            </FormField>

            <FormField label="Categoría (opcional)">
              <select
                className={inputClass}
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="">Sin categoría</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Notas (opcional)">
              <textarea
                className={inputClass}
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
                disabled={createInvoice.isPending}
                className="bg-pachos-green text-white text-sm rounded-md px-4 py-2 disabled:opacity-50"
              >
                {createInvoice.isPending ? "Guardando..." : "Guardar factura"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
