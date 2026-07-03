import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { api } from "../lib/apiClient";
import { Card, Metric, money } from "../components/ui";

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

export function CashFlowPage() {
  const summary = useQuery({
    queryKey: ["cashflow-summary"],
    queryFn: () => api.get<{ data: CashFlowSummary }>("/cashflow/summary").then((r) => r.data),
  });
  const history = useQuery({
    queryKey: ["cashflow-history"],
    queryFn: () => api.get<{ data: HistoryPoint[] }>("/cashflow/history").then((r) => r.data),
  });

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
      <h2 className="text-2xl font-bold">Flujo de Caja</h2>

      {summary.data?.willGoNegative && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">
          Alerta: el flujo de caja proyectado puede quedar negativo en {summary.data.negativeAtDays} días.
        </div>
      )}

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
    </div>
  );
}
