import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { api } from "../lib/apiClient";
import { Card, Metric, money, PageHeading } from "../components/ui";

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
      <PageHeading
        icon={BarChart3}
        title="Reporte Diario del Dueño"
        subtitle={new Date(data.date).toLocaleDateString()}
      />

      <Metric label="Dinero disponible" value={money(data.availableToday)} tone="success" size="lg" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Metric label="Depósitos de hoy" value={money(data.depositsToday)} tone="success" />
        <Metric label="Pagos realizados" value={money(data.paymentsToday)} />
        <Metric label="Cheques cobrados hoy" value={String(data.checksClearedToday)} tone="success" />
        <Metric
          label="Cheques pendientes"
          value={`${data.checksPending.count} · ${money(data.checksPending.total)}`}
          tone="warning"
        />
        <Metric
          label="Facturas vencidas"
          value={`${data.overdueInvoices.count} · ${money(data.overdueInvoices.total)}`}
          tone="danger"
        />
        <Metric label="Facturas por vencer pronto" value={String(data.dueSoonInvoices.count)} tone="warning" />
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
