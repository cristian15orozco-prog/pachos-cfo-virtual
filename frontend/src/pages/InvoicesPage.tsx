import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/apiClient";
import { Card, Badge, money } from "../components/ui";

interface Invoice {
  id: string;
  invoiceNumber: string;
  total: string;
  dueDate: string;
  status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
  isDuplicateFlag: boolean;
  provider: { name: string };
}

const STATUS_TONE: Record<Invoice["status"], "default" | "warning" | "danger" | "success"> = {
  PENDING: "default",
  PARTIAL: "warning",
  PAID: "success",
  OVERDUE: "danger",
};

export function InvoicesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => api.get<{ data: Invoice[] }>("/invoices").then((r) => r.data),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Facturas de Proveedores</h2>
      </div>

      <Card>
        {isLoading && <p className="text-slate-400 text-sm">Cargando...</p>}
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-100">
              <th className="py-2">Proveedor</th>
              <th>Factura</th>
              <th>Vence</th>
              <th>Estado</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((inv) => (
              <tr key={inv.id} className="border-b border-slate-50">
                <td className="py-2">{inv.provider.name}</td>
                <td>
                  {inv.invoiceNumber} {inv.isDuplicateFlag && <Badge tone="danger">posible duplicado</Badge>}
                </td>
                <td>{new Date(inv.dueDate).toLocaleDateString()}</td>
                <td>
                  <Badge tone={STATUS_TONE[inv.status]}>{inv.status}</Badge>
                </td>
                <td className="text-right">{money(inv.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
