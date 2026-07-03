import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/apiClient";
import { Card, Badge, money } from "../components/ui";

interface Check {
  id: string;
  checkNumber: string;
  payee: string;
  bankName: string;
  amount: string;
  status: "PENDING" | "ISSUED" | "CLEARED" | "CANCELLED";
  issueDate: string;
  reconciled: boolean;
}

const STATUS_TONE: Record<Check["status"], "default" | "warning" | "danger" | "success"> = {
  PENDING: "default",
  ISSUED: "warning",
  CLEARED: "success",
  CANCELLED: "danger",
};

export function ChecksPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["checks"],
    queryFn: () => api.get<{ data: Check[] }>("/checks").then((r) => r.data),
  });

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Cheques</h2>
      <p className="text-sm text-slate-500 -mt-3">
        Registro de cheques emitidos manualmente. El sistema no imprime ni emite cheques.
      </p>

      <Card>
        {isLoading && <p className="text-slate-400 text-sm">Cargando...</p>}
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-100">
              <th className="py-2">No. Cheque</th>
              <th>Beneficiario</th>
              <th>Banco</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th>Conciliado</th>
              <th className="text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((c) => (
              <tr key={c.id} className="border-b border-slate-50">
                <td className="py-2">{c.checkNumber}</td>
                <td>{c.payee}</td>
                <td>{c.bankName}</td>
                <td>{new Date(c.issueDate).toLocaleDateString()}</td>
                <td>
                  <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
                </td>
                <td>{c.reconciled ? <Badge tone="success">Sí</Badge> : <Badge>No</Badge>}</td>
                <td className="text-right">{money(c.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
