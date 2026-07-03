import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/apiClient";
import { Card, Metric, money } from "../components/ui";

interface Account {
  account_id: string;
  name: string;
  balances: { available: number | null; current: number | null };
}

interface Transaction {
  id: string;
  description: string;
  amount: string;
  type: string;
  transactionDate: string;
}

export function BankPage() {
  const queryClient = useQueryClient();

  const accounts = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: () => api.get<{ data: Account[] }>("/bank/accounts").then((r) => r.data),
  });

  const transactions = useQuery({
    queryKey: ["bank-transactions"],
    queryFn: () => api.get<{ data: Transaction[] }>("/bank/transactions").then((r) => r.data),
  });

  const sync = useMutation({
    mutationFn: () => api.post("/bank/sync"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Banco — TD Bank</h2>
          <p className="text-sm text-slate-500">
            Conexión de <strong>solo lectura</strong> vía Plaid. El sistema nunca guarda tu usuario/contraseña
            del banco y nunca puede mover dinero.
          </p>
        </div>
        <button
          onClick={() => sync.mutate()}
          disabled={sync.isPending}
          className="bg-pachos-green text-white text-sm rounded-md px-4 py-2 disabled:opacity-50"
        >
          {sync.isPending ? "Sincronizando..." : "Sincronizar ahora"}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {accounts.data?.map((acc) => (
          <Metric key={acc.account_id} label={acc.name} value={money(acc.balances.available ?? acc.balances.current ?? 0)} tone="success" />
        ))}
        {!accounts.data?.length && (
          <Card>
            <p className="text-sm text-slate-500">
              Ninguna cuenta conectada todavía. El dueño debe conectar TD Bank mediante Plaid Link desde
              Configuración.
            </p>
          </Card>
        )}
      </div>

      <Card title="Movimientos recientes (solo lectura)">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-100">
              <th className="py-2">Fecha</th>
              <th>Descripción</th>
              <th>Tipo</th>
              <th className="text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {transactions.data?.map((t) => (
              <tr key={t.id} className="border-b border-slate-50">
                <td className="py-2">{new Date(t.transactionDate).toLocaleDateString()}</td>
                <td>{t.description}</td>
                <td>{t.type}</td>
                <td className="text-right">{money(t.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
