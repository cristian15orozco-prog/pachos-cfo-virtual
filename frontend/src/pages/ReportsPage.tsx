import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/apiClient";
import { Card, money } from "../components/ui";

interface DailyReport {
  date: string;
  availableToday: number;
  depositsToday: number;
  paymentsToday: number;
  checksClearedToday: number;
  checksPending: { count: number; total: number };
  overdueInvoices: { count: number; total: number };
  dueSoonInvoices: { count: number };
  financialRisks: Array<{ message: string }>;
  recommendations: string[];
}

export function ReportsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["daily-report"],
    queryFn: () => api.get<{ data: DailyReport }>("/reports/daily/latest").then((r) => r.data),
  });

  if (isLoading || !data) return <p className="text-slate-500">Cargando reporte...</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Reporte Diario del Dueño</h2>
      <p className="text-sm text-slate-500 -mt-3">{new Date(data.date).toLocaleDateString()}</p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card title="Dinero disponible"><p className="text-xl font-bold">{money(data.availableToday)}</p></Card>
        <Card title="Depósitos de hoy"><p className="text-xl font-bold">{money(data.depositsToday)}</p></Card>
        <Card title="Pagos realizados"><p className="text-xl font-bold">{money(data.paymentsToday)}</p></Card>
        <Card title="Cheques cobrados hoy"><p className="text-xl font-bold">{data.checksClearedToday}</p></Card>
        <Card title="Cheques pendientes"><p className="text-xl font-bold">{data.checksPending.count} · {money(data.checksPending.total)}</p></Card>
        <Card title="Facturas vencidas"><p className="text-xl font-bold text-red-600">{data.overdueInvoices.count} · {money(data.overdueInvoices.total)}</p></Card>
      </div>

      <Card title="Riesgos financieros">
        {data.financialRisks.length === 0 && <p className="text-sm text-slate-400">Sin riesgos críticos activos.</p>}
        <ul className="list-disc pl-5 text-sm space-y-1">
          {data.financialRisks.map((r, i) => (
            <li key={i}>{r.message}</li>
          ))}
        </ul>
      </Card>

      <Card title="Recomendaciones del CFO virtual">
        <ul className="list-disc pl-5 text-sm space-y-1">
          {data.recommendations.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
