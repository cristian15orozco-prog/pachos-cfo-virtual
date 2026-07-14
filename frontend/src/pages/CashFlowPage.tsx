import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { api } from "../lib/apiClient";
import { Card, Metric, Badge, money } from "../components/ui";
import { Modal, FormField, inputClass } from "../components/Modal";
import { useAuth } from "../hooks/useAuth";

interface CashFlowSummary {
  availableToday: number;
  projections: Record<string, number>;
  willGoNegative: boolean;
  negativeAtDays: number | null;
}

interface HistoryPoint {
  snapshotDate: string;
  projected7d: string;
  projected15d: string;
  projected30d: string;
}

interface TimelineEntry {
  id: string;
  source: "CASH" | "BANK";
  date: string;
  description: string;
  type: string;
  amount: number;
  balanceAfter: number | null;
  account?: "DAILY_SALES" | "RENT" | "PAYROLL" | "SAVINGS";
}

const TYPE_LABEL: Record<string, string> = {
  DEPOSIT: "Depósito",
  WITHDRAWAL: "Retiro",
  PAYMENT: "Pago de factura",
  TRANSFER_IN: "Transferencia recibida",
  TRANSFER_OUT: "Transferencia enviada",
  CHECK: "Cheque cobrado",
  FEE: "Cargo bancario",
  OTHER: "Otro",
};

const ACCOUNT_LABEL: Record<string, string> = {
  DAILY_SALES: "Ventas del Día",
  RENT: "Renta",
  PAYROLL: "Pago de Trabajadores",
  SAVINGS: "Ahorro",
};

export function CashFlowPage() {
  const { user } = useAuth();
  const canRegisterSale = user?.role === "OWNER" || user?.role === "ADMIN";
  const queryClient = useQueryClient();

  const summary = useQuery({
    queryKey: ["cashflow-summary"],
    queryFn: () => api.get<{ data: CashFlowSummary }>("/cashflow/summary").then((r) => r.data),
  });
  const history = useQuery({
    queryKey: ["cashflow-history"],
    queryFn: () => api.get<{ data: HistoryPoint[] }>("/cashflow/history").then((r) => r.data),
  });
  const timeline = useQuery({
    queryKey: ["cashflow-timeline"],
    queryFn: () => api.get<{ data: TimelineEntry[] }>("/cashflow/timeline").then((r) => r.data),
  });
  const businessSettings = useQuery({
    queryKey: ["business-settings"],
    queryFn: () => api.get<{ data: { dailyRentAmount: string } }>("/business-settings").then((r) => r.data),
    enabled: canRegisterSale,
  });

  const [showSaleForm, setShowSaleForm] = useState(false);
  const [saleAmount, setSaleAmount] = useState("");
  const [saleNotes, setSaleNotes] = useState("");
  const [saleError, setSaleError] = useState<string | null>(null);

  const registerSale = useMutation({
    mutationFn: () =>
      api.post("/cash-register/daily-sale", {
        amount: Number(saleAmount) || 0,
        notes: saleNotes || "Venta en efectivo del día",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cashflow-summary"] });
      queryClient.invalidateQueries({ queryKey: ["cashflow-timeline"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["cash-register"] });
      queryClient.invalidateQueries({ queryKey: ["cash-register-movements"] });
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      setShowSaleForm(false);
      setSaleAmount("");
      setSaleNotes("");
      setSaleError(null);
    },
    onError: (err: Error) => setSaleError(err.message),
  });

  function handleSaleSubmit(e: FormEvent) {
    e.preventDefault();
    registerSale.mutate();
  }

  const chartData = (history.data ?? [])
    .slice()
    .reverse()
    .map((h) => ({
      date: new Date(h.snapshotDate).toLocaleDateString(),
      "7 días": Number(h.projected7d),
      "15 días": Number(h.projected15d),
      "30 días": Number(h.projected30d),
    }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Flujo de Caja</h2>
        {canRegisterSale && (
          <button
            onClick={() => setShowSaleForm(true)}
            className="bg-pachos-green text-white text-sm rounded-md px-4 py-2"
          >
            + Venta en Efectivo del Día
          </button>
        )}
      </div>

      {summary.data?.willGoNegative && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">
          Alerta: el flujo de caja proyectado puede quedar negativo en {summary.data.negativeAtDays} días.
        </div>
      )}

      <p className="text-xs text-slate-400 -mt-2">
        Los pagos con tarjeta/transferencia ya llegan solos vía Plaid. Registra aquí solo las ventas en{" "}
        <strong>efectivo</strong> — ese dinero no pasa por el banco y si no se registra, la proyección de abajo lo
        subestima.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Metric label="Disponible hoy" value={money(summary.data?.availableToday ?? 0)} tone="success" />
        {summary.data &&
          Object.entries(summary.data.projections).map(([days, value]) => (
            <Metric key={days} label={`Proyección ${days} días`} value={money(value)} tone={value < 0 ? "danger" : "default"} />
          ))}
      </div>

      <Card title="Histórico de proyección">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip />
            <Line type="monotone" dataKey="7 días" stroke="#1B5E3A" />
            <Line type="monotone" dataKey="15 días" stroke="#D4A017" />
            <Line type="monotone" dataKey="30 días" stroke="#94a3b8" />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Línea de tiempo — efectivo y banco (solo lectura)">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-100">
              <th className="py-2">Fecha</th>
              <th>Origen</th>
              <th>Descripción</th>
              <th className="text-right">Monto</th>
              <th className="text-right">Saldo de cuenta</th>
            </tr>
          </thead>
          <tbody>
            {timeline.data?.map((t) => (
              <tr key={`${t.source}-${t.id}`} className="border-b border-slate-50">
                <td className="py-2">{new Date(t.date).toLocaleDateString()}</td>
                <td>
                  <Badge tone={t.source === "CASH" ? "success" : "default"}>
                    {t.source === "CASH" ? `Efectivo${t.account ? ` · ${ACCOUNT_LABEL[t.account]}` : ""}` : "Banco"}
                  </Badge>
                </td>
                <td>
                  {t.description} <span className="text-slate-400 text-xs">({TYPE_LABEL[t.type] ?? t.type})</span>
                </td>
                <td className={`text-right ${t.amount < 0 ? "text-red-600" : "text-pachos-green"}`}>
                  {t.amount < 0 ? "-" : "+"}
                  {money(Math.abs(t.amount))}
                </td>
                <td className="text-right text-slate-500">{t.balanceAfter !== null ? money(t.balanceAfter) : "—"}</td>
              </tr>
            ))}
            {!timeline.data?.length && (
              <tr>
                <td colSpan={5} className="py-3 text-slate-400">
                  Sin movimientos todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {showSaleForm && (
        <Modal title="Venta en Efectivo del Día" onClose={() => setShowSaleForm(false)}>
          <form onSubmit={handleSaleSubmit}>
            <FormField label="Monto vendido en efectivo hoy">
              <input
                required
                type="number"
                step="0.01"
                min="0"
                autoFocus
                className={inputClass}
                value={saleAmount}
                onChange={(e) => setSaleAmount(e.target.value)}
              />
            </FormField>
            {businessSettings.data && (
              <p className="text-xs text-slate-500 bg-slate-50 rounded-md px-3 py-2 mb-3">
                De este monto se separarán automáticamente {money(Number(businessSettings.data.dailyRentAmount))} para
                Renta.
              </p>
            )}
            <FormField label="Notas (opcional)">
              <input
                className={inputClass}
                placeholder="Venta en efectivo del día"
                value={saleNotes}
                onChange={(e) => setSaleNotes(e.target.value)}
              />
            </FormField>

            {saleError && <p className="text-sm text-red-600 mb-3">{saleError}</p>}

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowSaleForm(false)}
                className="text-sm px-4 py-2 rounded-md border border-slate-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={registerSale.isPending}
                className="bg-pachos-green text-white text-sm rounded-md px-4 py-2 disabled:opacity-50"
              >
                {registerSale.isPending ? "Guardando..." : "Registrar venta"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
