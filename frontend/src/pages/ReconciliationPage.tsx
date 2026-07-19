import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/apiClient";
import { Card, Badge, money, formatDateOnly } from "../components/ui";

interface Reconciliation {
  id: string;
  status: "MATCHED" | "PARTIAL_MATCH" | "UNMATCHED" | "FLAGGED";
  matchedType: string;
  amountDifference: string;
  bankTransaction: { description: string; amount: string; transactionDate: string };
}

const STATUS_TONE: Record<Reconciliation["status"], "default" | "warning" | "danger" | "success"> = {
  MATCHED: "success",
  PARTIAL_MATCH: "warning",
  UNMATCHED: "danger",
  FLAGGED: "danger",
};

export function ReconciliationPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["reconciliation"],
    queryFn: () => api.get<{ data: Reconciliation[] }>("/reconciliation").then((r) => r.data),
  });

  const run = useMutation({
    mutationFn: () => api.post("/reconciliation/run"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reconciliation"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Conciliación Bancaria</h2>
        <button
          onClick={() => run.mutate()}
          disabled={run.isPending}
          className="bg-brand-orange hover:bg-brand-orangeDark text-white text-sm rounded-md px-4 py-2 disabled:opacity-50"
        >
          {run.isPending ? "Ejecutando..." : "Ejecutar conciliación"}
        </button>
      </div>

      <p className="text-xs text-slate-400 -mt-2">
        Esto compara automáticamente tus transacciones bancarias (vía Plaid) contra cheques y facturas — mientras no
        haya un banco conectado, esta lista se queda vacía. Mientras tanto, marca los cheques como cobrados
        directamente en la pantalla <strong>Cheques</strong>.
      </p>

      <Card>
        {isLoading && <p className="text-slate-400 text-sm">Cargando...</p>}
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-100">
              <th className="py-2">Fecha</th>
              <th>Transacción</th>
              <th>Tipo de match</th>
              <th>Diferencia</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((r) => (
              <tr key={r.id} className="border-b border-slate-50">
                <td className="py-2">{formatDateOnly(r.bankTransaction.transactionDate)}</td>
                <td>
                  {r.bankTransaction.description} ({money(r.bankTransaction.amount)})
                </td>
                <td>{r.matchedType}</td>
                <td className={Number(r.amountDifference) !== 0 ? "text-status-danger font-medium" : "text-status-success"}>
                  {money(r.amountDifference)}
                </td>
                <td>
                  <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
