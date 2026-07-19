import { useMemo, useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/apiClient";
import { Card, todayLocalDateString } from "../components/ui";
import { FormField, inputClass } from "../components/Modal";
import { InvoicePhotoPicker } from "../components/InvoicePhotoPicker";
import { attachPhotosToInvoice } from "../lib/attachInvoicePhotos";

interface ProviderName {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

const emptyForm = {
  providerId: "",
  invoiceNumber: "",
  invoiceDate: todayLocalDateString(),
  dueDate: todayLocalDateString(),
  subtotal: "",
  tax: "",
  categoryId: "",
  notes: "",
};

const emptyPaymentForm = {
  paid: true,
  method: "CASH" as "CASH" | "CHECK",
  checkNumber: "",
  payee: "",
  bankName: "TD Bank",
  issueDate: "",
};

export function RegisterInvoicePage() {
  const queryClient = useQueryClient();

  const [form, setForm] = useState(emptyForm);
  const [payment, setPayment] = useState(emptyPaymentForm);
  const [photoPages, setPhotoPages] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const providers = useQuery({
    queryKey: ["providers-names"],
    queryFn: () => api.get<{ data: ProviderName[] }>("/providers/names").then((r) => r.data),
  });

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<{ data: Category[] }>("/categories").then((r) => r.data),
  });

  const subtotalNum = Number(form.subtotal) || 0;
  const taxNum = Number(form.tax) || 0;
  const total = useMemo(() => subtotalNum + taxNum, [subtotalNum, taxNum]);

  const submitAll = useMutation({
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
      const invoiceId = createRes.data.id;

      // La foto es documentación, no dato financiero — si falla, la factura
      // ya guardada no se pierde; solo se avisa que la foto no subió.
      let photoWarning: string | null = null;
      if (photoPages.length > 0) {
        try {
          await attachPhotosToInvoice(invoiceId, photoPages, form.invoiceNumber);
        } catch (err) {
          photoWarning = `La factura se guardó, pero no se pudo subir la foto: ${(err as Error).message}`;
        }
      }

      if (payment.paid) {
        await api.post(`/invoices/${invoiceId}/payments`, {
          method: payment.method,
          amount: total,
          paidAt: form.invoiceDate,
          ...(payment.method === "CHECK"
            ? {
                checkNumber: payment.checkNumber,
                payee: payment.payee || undefined,
                bankName: payment.bankName,
                issueDate: payment.issueDate || form.invoiceDate,
              }
            : {}),
        });
      }

      return { photoWarning };
    },
    onSuccess: ({ photoWarning }) => {
      setForm(emptyForm);
      setPayment(emptyPaymentForm);
      setPhotoPages([]);
      setError(null);
      setWarning(photoWarning);
      setSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setTimeout(() => setSuccess(false), 4000);
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setWarning(null);
    if (payment.paid && payment.method === "CHECK" && !payment.checkNumber) {
      setError("Falta el número de cheque.");
      return;
    }
    submitAll.mutate();
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold">Registrar Factura</h2>
        <p className="text-sm text-slate-500">
          Cuando llegue una factura de un proveedor, regístrala aquí junto con cómo se pagó.
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <FormField label="Fotos de la factura (opcional — una por página)">
            <InvoicePhotoPicker pages={photoPages} onChange={setPhotoPages} disabled={submitAll.isPending} />
          </FormField>

          <FormField label="Proveedor">
            <select
              required
              className={inputClass}
              value={form.providerId}
              onChange={(e) => setForm({ ...form, providerId: e.target.value })}
            >
              <option value="">Selecciona un proveedor…</option>
              {providers.data?.map((p) => (
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
              {categories.data?.map((c) => (
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
                checked={payment.paid}
                onChange={(e) => setPayment({ ...payment, paid: e.target.checked })}
              />
              Esta factura ya se pagó
            </label>

            {payment.paid && (
              <>
                <FormField label="Método de pago">
                  <select
                    className={inputClass}
                    value={payment.method}
                    onChange={(e) => setPayment({ ...payment, method: e.target.value as "CASH" | "CHECK" })}
                  >
                    <option value="CASH">Efectivo</option>
                    <option value="CHECK">Cheque</option>
                  </select>
                </FormField>

                {payment.method === "CASH" && (
                  <p className="text-xs text-slate-500 bg-slate-50 rounded-md px-3 py-2">
                    Se descontará ${total.toFixed(2)} del efectivo en caja.
                  </p>
                )}

                {payment.method === "CHECK" && (
                  <>
                    <FormField label="Número de cheque">
                      <input
                        required
                        className={inputClass}
                        value={payment.checkNumber}
                        onChange={(e) => setPayment({ ...payment, checkNumber: e.target.value })}
                      />
                    </FormField>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Beneficiario">
                        <input
                          className={inputClass}
                          placeholder="Nombre del proveedor"
                          value={payment.payee}
                          onChange={(e) => setPayment({ ...payment, payee: e.target.value })}
                        />
                      </FormField>
                      <FormField label="Banco">
                        <input
                          className={inputClass}
                          value={payment.bankName}
                          onChange={(e) => setPayment({ ...payment, bankName: e.target.value })}
                        />
                      </FormField>
                    </div>
                    <FormField label="Fecha del cheque (si va posfechado, pon esa fecha)">
                      <input
                        type="date"
                        className={inputClass}
                        value={payment.issueDate}
                        onChange={(e) => setPayment({ ...payment, issueDate: e.target.value })}
                      />
                    </FormField>
                  </>
                )}
              </>
            )}
          </div>

          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          {warning && <p className="text-sm text-amber-600 mt-2">{warning}</p>}
          {success && <p className="text-sm text-status-success mt-2">Factura registrada correctamente.</p>}

          <button
            type="submit"
            disabled={submitAll.isPending}
            className="w-full mt-4 bg-brand-orange hover:bg-brand-orangeDark text-white text-sm rounded-md px-4 py-3 font-medium disabled:opacity-50"
          >
            {submitAll.isPending ? "Guardando..." : "Guardar Factura"}
          </button>
        </form>
      </Card>
    </div>
  );
}
