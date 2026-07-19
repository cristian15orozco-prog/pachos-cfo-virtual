import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/apiClient";
import { Card, Badge } from "../components/ui";

interface Alert {
  id: string;
  type: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  message: string;
  createdAt: string;
}

const SEVERITY_TONE: Record<Alert["severity"], "default" | "warning" | "danger"> = {
  INFO: "default",
  WARNING: "warning",
  CRITICAL: "danger",
};

export function AlertsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => api.get<{ data: Alert[] }>("/alerts?status=OPEN").then((r) => r.data),
  });

  const invalidateAfterResolve = () => {
    queryClient.invalidateQueries({ queryKey: ["alerts"] });
    queryClient.invalidateQueries({ queryKey: ["cash-register"] });
    queryClient.invalidateQueries({ queryKey: ["cash-register-movements"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const resolve = useMutation({
    mutationFn: (id: string) => api.patch(`/alerts/${id}`, { status: "RESOLVED" }),
    onSuccess: invalidateAfterResolve,
  });

  const resolveShortfall = useMutation({
    mutationFn: ({ id, takeFromSavings }: { id: string; takeFromSavings: boolean }) =>
      api.post(`/alerts/${id}/resolve-shortfall`, { takeFromSavings }),
    onSuccess: invalidateAfterResolve,
  });

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Alertas Inteligentes</h2>
      <Card>
        {isLoading && <p className="text-slate-400 text-sm">Cargando...</p>}
        {data?.length === 0 && <p className="text-sm text-slate-400">No hay alertas abiertas. Todo en orden.</p>}
        <ul className="divide-y divide-slate-100">
          {data?.map((alert) => (
            <li key={alert.id} className="py-3 flex items-center justify-between gap-3">
              <div>
                <Badge tone={SEVERITY_TONE[alert.severity]}>{alert.severity}</Badge>
                <span className="ml-3 text-sm">{alert.message}</span>
              </div>
              {alert.type === "AUTO_ALLOCATION_SHORTFALL" ? (
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => resolveShortfall.mutate({ id: alert.id, takeFromSavings: true })}
                    disabled={resolveShortfall.isPending}
                    className="text-xs text-white bg-brand-orange hover:bg-brand-orangeDark rounded-md px-3 py-1.5 disabled:opacity-50"
                  >
                    Sí, tomar de Ahorro
                  </button>
                  <button
                    onClick={() => resolveShortfall.mutate({ id: alert.id, takeFromSavings: false })}
                    disabled={resolveShortfall.isPending}
                    className="text-xs text-slate-600 border border-slate-300 rounded-md px-3 py-1.5 disabled:opacity-50"
                  >
                    No, esperar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => resolve.mutate(alert.id)}
                  className="text-xs text-slate-600 underline shrink-0"
                >
                  Marcar resuelta
                </button>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
