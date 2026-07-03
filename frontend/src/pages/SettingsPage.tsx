import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/apiClient";
import { Card, Badge } from "../components/ui";

interface User {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  employeeCanViewBalances: boolean;
  role: { name: string };
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<{ data: User[] }>("/users").then((r) => r.data),
  });

  const toggleBalances = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) =>
      api.patch(`/users/${id}`, { employeeCanViewBalances: value }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Configuración</h2>

      <Card title="Conexión bancaria (TD Bank)">
        <p className="text-sm text-slate-500 mb-3">
          Solo el Dueño puede conectar o desconectar el banco. La conexión es de solo lectura vía Plaid — el
          sistema nunca ve ni guarda tu usuario/contraseña de TD Bank.
        </p>
        <p className="text-xs text-slate-400">
          La UI de conexión usa el widget oficial de Plaid Link (paquete `react-plaid-link`) inicializado con el
          `link_token` de <code>POST /bank/link-token</code>. Se agrega en la Fase 2 del roadmap.
        </p>
      </Card>

      <Card title="Usuarios y roles">
        {isLoading && <p className="text-slate-400 text-sm">Cargando...</p>}
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-100">
              <th className="py-2">Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Activo</th>
              <th>Ve saldos bancarios</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((u) => (
              <tr key={u.id} className="border-b border-slate-50">
                <td className="py-2">{u.fullName}</td>
                <td>{u.email}</td>
                <td>
                  <Badge>{u.role.name}</Badge>
                </td>
                <td>{u.isActive ? <Badge tone="success">Sí</Badge> : <Badge tone="danger">No</Badge>}</td>
                <td>
                  {u.role.name === "EMPLOYEE" ? (
                    <input
                      type="checkbox"
                      checked={u.employeeCanViewBalances}
                      onChange={(e) => toggleBalances.mutate({ id: u.id, value: e.target.checked })}
                    />
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
