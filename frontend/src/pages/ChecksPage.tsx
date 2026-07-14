import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/apiClient";
import { Card, Badge, money, formatDateOnly } from "../components/ui";
import { Modal, FormField, inputClass } from "../components/Modal";
import { useAuth } from "../hooks/useAuth";

interface Check {
  id: string;
  checkNumber: string;
  payee: string;
  bankName: string;
  amount: string;
  status: "PENDING" | "ISSUED" | "CLEARED" | "CANCELLED";
  issueDate: string;
  reconciled: boolean;
}

interface InvoiceOption {
  id: string;
  invoiceNumber: string;
  total: string;
  provider: { name: string };
}

const STATUS_TONE: Record<Check["status"], "default" | "warning" | "danger" | "success"> = {
  PENDING: "default",
  ISSUED: "warning",
  CLEARED: "success",
  CANCELLED: "danger",
};

const emptyForm = {
  checkNumber: "",
  payee: "",
  bankName: "TD Bank",
  amount: "",
  issueDate: "",
  invoiceId: "",
  notes: "",
};

export function ChecksPage() {
  const { user } = useAuth();
  const canCreate = user?.role === "OWNER" || user?.role === "ADMIN";
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["checks"],
    queryFn: () => api.get<{ data: Check[] }>("/checks").then((r) => r.data),
  });

  const { data: invoices } = useQuery({
    queryKey: ["invoices-simple"],
    queryFn: () => api.get<{ data: InvoiceOption[] }>("/invoices").then((r) => r.data),
    enabled: showForm,
  });

  const createCheck = useMutation({
    mutationFn: () =>
      api.post("/checks", {
        checkNumber: form.checkNumber,
        payee: form.payee,
        bankName: form.bankName,
        amount: Number(form.amount) || 0,
        issueDate: form.issueDate,
        invoiceId: form.invoiceId || undefined,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setShowForm(false);
      setForm(emptyForm);
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    createCheck.mutate();
  }

  const [markClearedError, setMarkClearedError] = useState<string | null>(null);

  const markCleared = useMutation({
    mutationFn: (id: string) => api.post(`/checks/${id}/mark-cleared`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["cashflow-summary"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["bank-manual-movements"] });
      setMarkClearedError(null);
    },
    onError: (err: Error) => setMarkClearedError(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Cheques</h2>
          <p className="text-sm text-slate-500">
            Registro de cheques emitidos manualmente. El sistema no imprime ni emite cheques. Mientras no haya banco
            conectado, marca aquí a mano cuándo se cobró uno — eso también descuenta el saldo manual del banco.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-pachos-green text-white text-sm rounded-md px-4 py-2 shrink-0"
          >
            + Nuevo Cheque
          </button>
        )}
      </div>

      <Card>
        {isLoading && <p className="text-slate-400 text-sm">Cargando...</p>}
        {!isLoading && data?.length === 0 && (
          <p className="text-slate-400 text-sm">Todavía no hay cheques registrados.</p>
        )}
        {markClearedError && <p className="text-sm text-red-600 mb-3">{markClearedError}</p>}
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-100">
              <th className="py-2">No. Cheque</th>
              <th>Beneficiario</th>
              <th>Banco</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th>Conciliado</th>
              <th className="text-right">Monto</th>
              {canCreate && <th></th>}
            </tr>
          </thead>
          <tbody>
            {data?.map((c) => (
              <tr key={c.id} className="border-b border-slate-50">
                <td className="py-2">{c.checkNumber}</td>
                <td>{c.payee}</td>
                <td>{c.bankName}</td>
                <td>{formatDateOnly(c.issueDate)}</td>
                <td>
                  <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
                </td>
                <td>{c.reconciled ? <Badge tone="success">Sí</Badge> : <Badge>No</Badge>}</td>
                <td className="text-right">{money(c.amount)}</td>
                {canCreate && (
                  <td className="text-right pl-3 whitespace-nowrap">
                    {(c.status === "ISSUED" || c.status === "PENDING") && (
                      <button
                        onClick={() => markCleared.mutate(c.id)}
                        disabled={markCleared.isPending}
                        className="text-xs text-pachos-green underline disabled:opacity-50"
                      >
                        Marcar como cobrado
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {showForm && (
        <Modal title="Nuevo Cheque" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Número de cheque">
                <input
                  required
                  className={inputClass}
                  value={form.checkNumber}
                  onChange={(e) => setForm({ ...form, checkNumber: e.target.value })}
                />
              </FormField>
              <FormField label="Banco">
                <input
                  required
                  className={inputClass}
                  value={form.bankName}
                  onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                />
              </FormField>
            </div>

            <FormField label="Beneficiario">
              <input
                required
                className={inputClass}
                value={form.payee}
                onChange={(e) => setForm({ ...form, payee: e.target.value })}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Fecha de emisión">
                <input
                  required
                  type="date"
                  className={inputClass}
                  value={form.issueDate}
                  onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
                />
              </FormField>
              <FormField label="Monto">
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputClass}
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </FormField>
            </div>

            <FormField label="Factura asociada (opcional)">
              <select
                className={inputClass}
                value={form.invoiceId}
                onChange={(e) => setForm({ ...form, invoiceId: e.target.value })}
              >
                <option value="">Sin factura asociada</option>
                {invoices?.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.provider.name} — {inv.invoiceNumber} ({money(inv.total)})
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
                disabled={createCheck.isPending}
                className="bg-pachos-green text-white text-sm rounded-md px-4 py-2 disabled:opacity-50"
              >
                {createCheck.isPending ? "Guardando..." : "Guardar cheque"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
