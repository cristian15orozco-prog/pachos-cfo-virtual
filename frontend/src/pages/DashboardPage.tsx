import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/apiClient";
import { Card, Metric, money, Badge, formatDateOnly } from "../components/ui";

interface DashboardData {
  bankBalance: number;
  cashOnHand: number;
  pendingInvoices: { count: number; total: number };
  overdueInvoices: { count: number; total: number };
  checksIssued: number;
  checksCleared: number;
  checksPending: { count: number; total: number };
  upcomingPayments: Array<{ id: string; invoiceNumber: string; total: string; dueDate: string; provider: { name: string } }>;
  cashFlowProjection: Record<string, number>;
  alerts: Array<{ id: string; message: string; severity: string }>;
}

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<{ data: DashboardData }>("/dashboard").then((r) => r.data),
  });

  if (isLoading || !data) return <p className="text-slate-500">Cargando dashboard...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Dashboard del Dueño</h2>
        <p className="text-slate-500 text-sm">Pachos Supermarket — resumen financiero en tiempo real</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Metric label="Saldo TD Bank" value={money(data.bankBalance)} tone="success" />
        <Metric label="Efectivo en caja" value={money(data.cashOnHand)} />
        <Metric label="Facturas pendientes" value={`${data.pendingInvoices.count} · ${money(data.pendingInvoices.total)}`} />
        <Metric label="Facturas vencidas" value={`${data.overdueInvoices.count} · ${money(data.overdueInvoices.total)}`} tone="danger" />
        <Metric label="Cheques emitidos" value={String(data.checksIssued)} />
        <Metric label="Cheques cobrados" value={String(data.checksCleared)} tone="success" />
        <Metric
          label="Cheques sin cobrar"
          value={`${data.checksPending.count} · ${money(data.checksPending.total)}`}
          tone="warning"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Flujo de caja proyectado">
          <div className="flex justify-between text-sm">
            {Object.entries(data.cashFlowProjection).map(([days, value]) => (
              <div key={days} className="text-center">
                <p className="text-slate-400">{days} días</p>
                <p className={`font-bold ${value < 0 ? "text-red-600" : "text-pachos-green"}`}>{money(value)}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Alertas financieras importantes">
          {data.alerts.length === 0 && <p className="text-sm text-slate-400">Sin alertas abiertas.</p>}
          <ul className="space-y-2">
            {data.alerts.slice(0, 6).map((alert) => (
              <li key={alert.id} className="flex items-center justify-between text-sm">
                <span>{alert.message}</span>
                <Badge tone={alert.severity === "CRITICAL" ? "danger" : alert.severity === "WARNING" ? "warning" : "default"}>
                  {alert.severity}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Próximos pagos (7 días)">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-100">
              <th className="py-2">Proveedor</th>
              <th>Factura</th>
              <th>Vence</th>
              <th className="text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {data.upcomingPayments.map((inv) => (
              <tr key={inv.id} className="border-b border-slate-50">
                <td className="py-2">{inv.provider?.name}</td>
                <td>{inv.invoiceNumber}</td>
                <td>{formatDateOnly(inv.dueDate)}</td>
                <td className="text-right">{money(inv.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
