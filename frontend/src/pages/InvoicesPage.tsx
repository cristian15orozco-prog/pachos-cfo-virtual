import { useMemo, useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/apiClient";
import { Card, Badge, money, formatDateOnly, todayLocalDateString } from "../components/ui";
import { Modal, FormField, inputClass } from "../components/Modal";
import { InvoicePhotoPicker } from "../components/InvoicePhotoPicker";
import { attachPhotosToInvoice } from "../lib/attachInvoicePhotos";
import { useAuth } from "../hooks/useAuth";

interface Invoice {
  id: string;
  providerId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  subtotal: string;
  tax: string;
  total: string;
  categoryId: string | null;
  notes: string | null;
  status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
  isDuplicateFlag: boolean;
  provider: { name: string };
  attachments: { id: string; fileName: string; mimeType: string }[];
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

const emptyCreatePaymentForm = {
  paid: false,
  method: "CASH" as "CASH" | "CHECK",
  sourceAccount: "DAILY_SALES" as "DAILY_SALES" | "SAVINGS",
  checkNumber: "",
  payee: "",
  bankName: "TD Bank",
  issueDate: "",
};

const emptyPaymentForm = {
  method: "CASH" as "CASH" | "CHECK",
  amount: "",
  paidAt: "",
  sourceAccount: "DAILY_SALES" as "DAILY_SALES" | "SAVINGS",
  checkNumber: "",
  payee: "",
  bankName: "TD Bank",
  issueDate: "",
};

export function InvoicesPage() {
  const { user } = useAuth();
  const canCreate = user?.role === "OWNER" || user?.role === "ADMIN";
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [createPayment, setCreatePayment] = useState(emptyCreatePaymentForm);
  const [error, setError] = useState<string | null>(null);

  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => api.get<{ data: Invoice[] }>("/invoices").then((r) => r.data),
  });

  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editError, setEditError] = useState<string | null>(null);

  const { data: providers } = useQuery({
    queryKey: ["providers-simple"],
    queryFn: () => api.get<{ data: Provider[] }>("/providers").then((r) => r.data),
    enabled: showForm || !!editingInvoice,
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<{ data: Category[] }>("/categories").then((r) => r.data),
    enabled: showForm || !!editingInvoice,
  });

  const subtotalNum = Number(form.subtotal) || 0;
  const taxNum = Number(form.tax) || 0;
  const total = useMemo(() => subtotalNum + taxNum, [subtotalNum, taxNum]);

  const createInvoice = useMutation({
    mutationFn: async () => {
      const createRes = await api.post<{ data: { id: string } }>("/invoices", {
        providerId: form.providerId,
        invoiceNumber: form.invoiceNumber,
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate,
        subtotal: subtotalNum,
        tax: taxNum,
        total,
        categoryId: form.categoryId || undefined,
        notes: form.notes || undefined,
      });

      if (createPayment.paid) {
        await api.post(`/invoices/${createRes.data.id}/payments`, {
          method: createPayment.method,
          amount: total,
          paidAt: form.invoiceDate,
          ...(createPayment.method === "CASH" ? { sourceAccount: createPayment.sourceAccount } : {}),
          ...(createPayment.method === "CHECK"
            ? {
                checkNumber: createPayment.checkNumber,
                payee: createPayment.payee || undefined,
                bankName: createPayment.bankName,
                issueDate: createPayment.issueDate || form.invoiceDate,
              }
            : {}),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["cashflow-summary"] });
      queryClient.invalidateQueries({ queryKey: ["cashflow-timeline"] });
      queryClient.invalidateQueries({ queryKey: ["cash-register"] });
      queryClient.invalidateQueries({ queryKey: ["cash-register-movements"] });
      queryClient.invalidateQueries({ queryKey: ["checks"] });
      setShowForm(false);
      setForm(emptyForm);
      setCreatePayment(emptyCreatePaymentForm);
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const recordPayment = useMutation({
    mutationFn: () => {
      if (!payingInvoice) return Promise.reject(new Error("Sin factura seleccionada"));
      return api.post(`/invoices/${payingInvoice.id}/payments`, {
        method: paymentForm.method,
        amount: Number(paymentForm.amount) || 0,
        paidAt: paymentForm.paidAt,
        ...(paymentForm.method === "CASH" ? { sourceAccount: paymentForm.sourceAccount } : {}),
        ...(paymentForm.method === "CHECK"
          ? {
              checkNumber: paymentForm.checkNumber,
              payee: paymentForm.payee || payingInvoice.provider.name,
              bankName: paymentForm.bankName,
              issueDate: paymentForm.issueDate || paymentForm.paidAt,
            }
          : {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["checks"] });
      queryClient.invalidateQueries({ queryKey: ["cashflow-summary"] });
      queryClient.invalidateQueries({ queryKey: ["cashflow-timeline"] });
      queryClient.invalidateQueries({ queryKey: ["cash-register"] });
      queryClient.invalidateQueries({ queryKey: ["cash-register-movements"] });
      setPayingInvoice(null);
      setPaymentForm(emptyPaymentForm);
      setPaymentError(null);
    },
    onError: (err: Error) => setPaymentError(err.message),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (createPayment.paid && createPayment.method === "CHECK" && !createPayment.checkNumber) {
      setError("Falta el número de cheque.");
      return;
    }
    createInvoice.mutate();
  }

  const updateInvoice = useMutation({
    mutationFn: () => {
      if (!editingInvoice) return Promise.reject(new Error("Sin factura seleccionada"));
      const editSubtotal = Number(editForm.subtotal) || 0;
      const editTax = Number(editForm.tax) || 0;
      return api.patch(`/invoices/${editingInvoice.id}`, {
        providerId: editForm.providerId,
        invoiceNumber: editForm.invoiceNumber,
        invoiceDate: editForm.invoiceDate,
        dueDate: editForm.dueDate,
        subtotal: editSubtotal,
        tax: editTax,
        total: editSubtotal + editTax,
        categoryId: editForm.categoryId || undefined,
        notes: editForm.notes || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["cashflow-summary"] });
      setEditingInvoice(null);
      setEditError(null);
    },
    onError: (err: Error) => setEditError(err.message),
  });

  function openEditModal(invoice: Invoice) {
    setEditingInvoice(invoice);
    setEditForm({
      providerId: invoice.providerId,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate.slice(0, 10),
      dueDate: invoice.dueDate.slice(0, 10),
      subtotal: invoice.subtotal,
      tax: invoice.tax,
      categoryId: invoice.categoryId ?? "",
      notes: invoice.notes ?? "",
    });
    setEditError(null);
  }

  function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    updateInvoice.mutate();
  }

  function openPaymentModal(invoice: Invoice) {
    setPayingInvoice(invoice);
    setPaymentForm({ ...emptyPaymentForm, amount: invoice.total, paidAt: todayLocalDateString() });
    setPaymentError(null);
  }

  function handlePaymentSubmit(e: FormEvent) {
    e.preventDefault();
    recordPayment.mutate();
  }

  const [attachingInvoice, setAttachingInvoice] = useState<Invoice | null>(null);
  const [attachPages, setAttachPages] = useState<File[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);

  const attachPhotos = useMutation({
    mutationFn: async () => {
      if (!attachingInvoice) return;
      await attachPhotosToInvoice(attachingInvoice.id, attachPages, attachingInvoice.invoiceNumber);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setAttachingInvoice(null);
      setAttachPages([]);
      setAttachError(null);
    },
    onError: (err: Error) => setAttachError(err.message),
  });

  function openAttachModal(invoice: Invoice) {
    setAttachingInvoice(invoice);
    setAttachPages([]);
    setAttachError(null);
  }

  function handleAttachSubmit(e: FormEvent) {
    e.preventDefault();
    attachPhotos.mutate();
  }

  const [viewError, setViewError] = useState<string | null>(null);
  const isOwner = user?.role === "OWNER";

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

  const canPay = user?.role === "OWNER" || user?.role === "ADMIN";

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
        {viewError && <p className="text-sm text-red-600 mb-3">{viewError}</p>}
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-100">
              <th className="py-2">Proveedor</th>
              <th>Factura</th>
              <th>Vence</th>
              <th>Estado</th>
              <th className="text-right">Total</th>
              {canPay && <th></th>}
            </tr>
          </thead>
          <tbody>
            {data?.map((inv) => (
              <tr key={inv.id} className="border-b border-slate-50">
                <td className="py-2">{inv.provider.name}</td>
                <td>
                  {inv.invoiceNumber} {inv.isDuplicateFlag && <Badge tone="danger">posible duplicado</Badge>}
                </td>
                <td>{formatDateOnly(inv.dueDate)}</td>
                <td>
                  <Badge tone={STATUS_TONE[inv.status]}>{inv.status}</Badge>
                </td>
                <td className="text-right">{money(inv.total)}</td>
                {canPay && (
                  <td className="text-right pl-3 space-x-3 whitespace-nowrap">
                    {inv.status !== "PAID" && (
                      <button
                        onClick={() => openPaymentModal(inv)}
                        className="text-xs text-pachos-green underline"
                      >
                        Registrar Pago
                      </button>
                    )}
                    <button onClick={() => openAttachModal(inv)} className="text-xs text-slate-500 underline">
                      📷 Adjuntar foto
                    </button>
                    {isOwner && (
                      <button onClick={() => openEditModal(inv)} className="text-xs text-slate-500 underline">
                        ✏️ Editar
                      </button>
                    )}
                    {isOwner &&
                      inv.attachments
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

            <div className="border-t border-slate-100 mt-4 pt-4">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3">
                <input
                  type="checkbox"
                  checked={createPayment.paid}
                  onChange={(e) => setCreatePayment({ ...createPayment, paid: e.target.checked })}
                />
                ¿Ya se pagó?
              </label>

              {createPayment.paid && (
                <>
                  <FormField label="Método de pago">
                    <select
                      className={inputClass}
                      value={createPayment.method}
                      onChange={(e) =>
                        setCreatePayment({ ...createPayment, method: e.target.value as "CASH" | "CHECK" })
                      }
                    >
                      <option value="CASH">Efectivo</option>
                      <option value="CHECK">Cheque</option>
                    </select>
                  </FormField>

                  {createPayment.method === "CASH" && (
                    <>
                      <FormField label="Pagar con">
                        <select
                          className={inputClass}
                          value={createPayment.sourceAccount}
                          onChange={(e) =>
                            setCreatePayment({
                              ...createPayment,
                              sourceAccount: e.target.value as "DAILY_SALES" | "SAVINGS",
                            })
                          }
                        >
                          <option value="DAILY_SALES">Ventas del Día</option>
                          <option value="SAVINGS">Ahorro</option>
                        </select>
                      </FormField>
                      <p className="text-xs text-slate-500 bg-slate-50 rounded-md px-3 py-2">
                        Se descontará ${total.toFixed(2)} de la cuenta elegida.
                      </p>
                    </>
                  )}

                  {createPayment.method === "CHECK" && (
                    <>
                      <FormField label="Número de cheque">
                        <input
                          required
                          className={inputClass}
                          value={createPayment.checkNumber}
                          onChange={(e) => setCreatePayment({ ...createPayment, checkNumber: e.target.value })}
                        />
                      </FormField>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField label="Beneficiario">
                          <input
                            className={inputClass}
                            placeholder="Nombre del proveedor"
                            value={createPayment.payee}
                            onChange={(e) => setCreatePayment({ ...createPayment, payee: e.target.value })}
                          />
                        </FormField>
                        <FormField label="Banco">
                          <input
                            className={inputClass}
                            value={createPayment.bankName}
                            onChange={(e) => setCreatePayment({ ...createPayment, bankName: e.target.value })}
                          />
                        </FormField>
                      </div>
                      <FormField label="Fecha del cheque (si va posfechado, pon esa fecha)">
                        <input
                          type="date"
                          className={inputClass}
                          placeholder={form.invoiceDate}
                          value={createPayment.issueDate}
                          onChange={(e) => setCreatePayment({ ...createPayment, issueDate: e.target.value })}
                        />
                      </FormField>
                      <p className="text-xs text-slate-500 bg-slate-50 rounded-md px-3 py-2">
                        Si lo dejas vacío, se usa la fecha de la factura ({form.invoiceDate || "hoy"}). El flujo de
                        caja no lo resta hasta esa fecha.
                      </p>
                    </>
                  )}
                </>
              )}
            </div>

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

      {payingInvoice && (
        <Modal title={`Registrar Pago — ${payingInvoice.invoiceNumber}`} onClose={() => setPayingInvoice(null)}>
          <form onSubmit={handlePaymentSubmit}>
            <FormField label="Método de pago">
              <select
                className={inputClass}
                value={paymentForm.method}
                onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value as "CASH" | "CHECK" })}
              >
                <option value="CASH">Efectivo</option>
                <option value="CHECK">Cheque</option>
              </select>
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Monto">
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputClass}
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                />
              </FormField>
              <FormField label="Fecha de pago">
                <input
                  required
                  type="date"
                  className={inputClass}
                  value={paymentForm.paidAt}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paidAt: e.target.value })}
                />
              </FormField>
            </div>

            {paymentForm.method === "CASH" && (
              <>
                <FormField label="Pagar con">
                  <select
                    className={inputClass}
                    value={paymentForm.sourceAccount}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, sourceAccount: e.target.value as "DAILY_SALES" | "SAVINGS" })
                    }
                  >
                    <option value="DAILY_SALES">Ventas del Día</option>
                    <option value="SAVINGS">Ahorro</option>
                  </select>
                </FormField>
                <p className="text-xs text-slate-500 bg-slate-50 rounded-md px-3 py-2">
                  Este monto se descontará directo de la cuenta elegida.
                </p>
              </>
            )}

            {paymentForm.method === "CHECK" && (
              <>
                <p className="text-xs text-slate-500 bg-slate-50 rounded-md px-3 py-2 mb-3">
                  Se registrará un cheque nuevo con estado "Emitido". El saldo real de TD Bank no cambia hasta que
                  el banco confirme que se cobró — mientras tanto, se descuenta virtualmente de la proyección de
                  flujo de caja.
                </p>
                <FormField label="Número de cheque">
                  <input
                    required
                    className={inputClass}
                    value={paymentForm.checkNumber}
                    onChange={(e) => setPaymentForm({ ...paymentForm, checkNumber: e.target.value })}
                  />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Beneficiario">
                    <input
                      className={inputClass}
                      placeholder={payingInvoice.provider.name}
                      value={paymentForm.payee}
                      onChange={(e) => setPaymentForm({ ...paymentForm, payee: e.target.value })}
                    />
                  </FormField>
                  <FormField label="Banco">
                    <input
                      className={inputClass}
                      value={paymentForm.bankName}
                      onChange={(e) => setPaymentForm({ ...paymentForm, bankName: e.target.value })}
                    />
                  </FormField>
                </div>
                <FormField label="Fecha del cheque (si va posfechado, pon esa fecha)">
                  <input
                    type="date"
                    className={inputClass}
                    value={paymentForm.issueDate}
                    onChange={(e) => setPaymentForm({ ...paymentForm, issueDate: e.target.value })}
                  />
                </FormField>
                <p className="text-xs text-slate-500 bg-slate-50 rounded-md px-3 py-2">
                  Si lo dejas vacío, se usa la fecha de pago de arriba. El flujo de caja no lo resta hasta esa fecha.
                </p>
              </>
            )}

            {paymentError && <p className="text-sm text-red-600 mb-3">{paymentError}</p>}

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setPayingInvoice(null)}
                className="text-sm px-4 py-2 rounded-md border border-slate-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={recordPayment.isPending}
                className="bg-pachos-green text-white text-sm rounded-md px-4 py-2 disabled:opacity-50"
              >
                {recordPayment.isPending ? "Guardando..." : "Registrar pago"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {attachingInvoice && (
        <Modal title={`Adjuntar foto — ${attachingInvoice.invoiceNumber}`} onClose={() => setAttachingInvoice(null)}>
          <form onSubmit={handleAttachSubmit}>
            <FormField label="Fotos de la factura (una por página)">
              <InvoicePhotoPicker pages={attachPages} onChange={setAttachPages} disabled={attachPhotos.isPending} />
            </FormField>

            {attachError && <p className="text-sm text-red-600 mb-3">{attachError}</p>}

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setAttachingInvoice(null)}
                className="text-sm px-4 py-2 rounded-md border border-slate-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={attachPhotos.isPending || attachPages.length === 0}
                className="bg-pachos-green text-white text-sm rounded-md px-4 py-2 disabled:opacity-50"
              >
                {attachPhotos.isPending ? "Subiendo..." : "Adjuntar"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editingInvoice && (
        <Modal title={`Editar Factura — ${editingInvoice.invoiceNumber}`} onClose={() => setEditingInvoice(null)}>
          <form onSubmit={handleEditSubmit}>
            <FormField label="Proveedor">
              <select
                required
                className={inputClass}
                value={editForm.providerId}
                onChange={(e) => setEditForm({ ...editForm, providerId: e.target.value })}
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
                value={editForm.invoiceNumber}
                onChange={(e) => setEditForm({ ...editForm, invoiceNumber: e.target.value })}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Fecha de factura">
                <input
                  required
                  type="date"
                  className={inputClass}
                  value={editForm.invoiceDate}
                  onChange={(e) => setEditForm({ ...editForm, invoiceDate: e.target.value })}
                />
              </FormField>
              <FormField label="Fecha de vencimiento">
                <input
                  required
                  type="date"
                  className={inputClass}
                  value={editForm.dueDate}
                  onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
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
                  value={editForm.subtotal}
                  onChange={(e) => setEditForm({ ...editForm, subtotal: e.target.value })}
                />
              </FormField>
              <FormField label="Impuestos">
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputClass}
                  value={editForm.tax}
                  onChange={(e) => setEditForm({ ...editForm, tax: e.target.value })}
                />
              </FormField>
            </div>

            <FormField label="Total">
              <input
                disabled
                className={`${inputClass} bg-slate-50 text-slate-500`}
                value={((Number(editForm.subtotal) || 0) + (Number(editForm.tax) || 0)).toFixed(2)}
              />
            </FormField>

            <FormField label="Categoría (opcional)">
              <select
                className={inputClass}
                value={editForm.categoryId}
                onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}
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
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              />
            </FormField>

            {editError && <p className="text-sm text-red-600 mb-3">{editError}</p>}

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setEditingInvoice(null)}
                className="text-sm px-4 py-2 rounded-md border border-slate-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={updateInvoice.isPending}
                className="bg-pachos-green text-white text-sm rounded-md px-4 py-2 disabled:opacity-50"
              >
                {updateInvoice.isPending ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
