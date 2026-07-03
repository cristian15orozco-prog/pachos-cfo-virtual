import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/apiClient";
import { Card, money } from "../components/ui";

interface Provider {
  id: string;
  name: string;
  category: string | null;
  phone: string | null;
  email: string | null;
  invoiceCount: number;
  pendingBalance: number;
}

export function ProvidersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["providers"],
    queryFn: () => api.get<{ data: Provider[] }>("/providers").then((r) => r.data),
  });

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Proveedores</h2>
      <Card>
        {isLoading && <p className="text-slate-400 text-sm">Cargando...</p>}
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-100">
              <th className="py-2">Nombre</th>
              <th>Categoría</th>
              <th>Contacto</th>
              <th># Facturas</th>
              <th className="text-right">Balance pendiente</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((p) => (
              <tr key={p.id} className="border-b border-slate-50">
                <td className="py-2 font-medium">{p.name}</td>
                <td>{p.category ?? "—"}</td>
                <td>{p.phone ?? p.email ?? "—"}</td>
                <td>{p.invoiceCount}</td>
                <td className="text-right">{money(p.pendingBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
