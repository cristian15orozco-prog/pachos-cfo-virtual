import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/apiClient";
import { Card, Badge, money } from "../components/ui";
import { FormField, inputClass } from "../components/Modal";

interface User {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  employeeCanViewBalances: boolean;
  role: { name: string };
}

interface CashMovement {
  id: string;
  type: "DEPOSIT" | "WITHDRAWAL" | "PAYMENT";
  amount: string;
  balanceAfter: string;
  notes: string | null;
  createdAt: string;
}

const MOVEMENT_LABEL: Record<CashMovement["type"], string> = {
  DEPOSIT: "Depósito",
  WITHDRAWAL: "Retiro",
  PAYMENT: "Pago de factura",
};

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

  const { data: cashBalance } = useQuery({
    queryKey: ["cash-register"],
    queryFn: () => api.get<{ data: { balance: number } }>("/cash-register").then((r) => r.data.balance),
  });

  const { data: movements } = useQuery({
    queryKey: ["cash-register-movements"],
    queryFn: () => api.get<{ data: CashMovement[] }>("/cash-register/movements").then((r) => r.data),
  });

  const [adjustType, setAdjustType] = useState<"DEPOSIT" | "WITHDRAWAL">("DEPOSIT");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNotes, setAdjustNotes] = useState("");
  const [adjustError, setAdjustError] = useState<string | null>(null);

  const adjustCash = useMutation({
    mutationFn: () =>
      api.post("/cash-register/adjust", {
        type: adjustType,
        amount: Number(adjustAmount) || 0,
        notes: adjustNotes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-register"] });
      queryClient.invalidateQueries({ queryKey: ["cash-register-movements"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["cashflow-summary"] });
      setAdjustAmount("");
      setAdjustNotes("");
      setAdjustError(null);
    },
    onError: (err: Error) => setAdjustError(err.message),
  });

  function handleAdjustSubmit(e: FormEvent) {
    e.preventDefault();
    adjustCash.mutate();
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Configuración</h2>

      <Card title="Efectivo en caja">
        <p className="text-2xl font-bold text-pachos-green mb-3">{money(cashBalance ?? 0)}</p>

        <form onSubmit={handleAdjustSubmit} className="flex flex-wrap items-end gap-3 mb-4">
          <div className="w-36">
            <FormField label="Tipo">
              <select
                className={inputClass}
                value={adjustType}
                onChange={(e) => setAdjustType(e.target.value as "DEPOSIT" | "WITHDRAWAL")}
              >
                <option value="DEPOSIT">Depósito</option>
                <option value="WITHDRAWAL">Retiro</option>
              </select>
            </FormField>
          </div>
          <div className="w-32">
            <FormField label="Monto">
              <input
                required
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
              />
            </FormField>
          </div>
          <div className="flex-1 min-w-[160px]">
            <FormField label="Notas (opcional)">
              <input
                className={inputClass}
                value={adjustNotes}
                onChange={(e) => setAdjustNotes(e.target.value)}
              />
            </FormField>
          </div>
          <button
            type="submit"
            disabled={adjustCash.isPending}
            className="bg-pachos-green text-white text-sm rounded-md px-4 py-2 disabled:opacity-50 h-[38px]"
          >
            {adjustCash.isPending ? "Guardando..." : "Ajustar"}
          </button>
        </form>

        {adjustError && <p className="text-sm text-red-600 mb-3">{adjustError}</p>}

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-100">
              <th className="py-2">Fecha</th>
              <th>Tipo</th>
              <th>Notas</th>
              <th className="text-right">Monto</th>
              <th className="text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {movements?.slice(0, 10).map((m) => (
              <tr key={m.id} className="border-b border-slate-50">
                <td className="py-2">{new Date(m.createdAt).toLocaleDateString()}</td>
                <td>
                  <Badge tone={m.type === "DEPOSIT" ? "success" : "warning"}>{MOVEMENT_LABEL[m.type]}</Badge>
                </td>
                <td className="text-slate-500">{m.notes ?? "—"}</td>
                <td className="text-right">
                  {m.type === "DEPOSIT" ? "+" : "-"}
                  {money(m.amount)}
                </td>
                <td className="text-right font-medium">{money(m.balanceAfter)}</td>
              </tr>
            ))}
            {!movements?.length && (
              <tr>
                <td colSpan={5} className="py-3 text-slate-400">
                  Sin movimientos de efectivo todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card title="Conexión bancaria (TD Bank)">
        <p className="text-sm text-slate-500">
          Solo el Dueño puede conectar o desconectar el banco. La conexión es de solo lectura vía Plaid — el
          sistema nunca ve ni guarda tu usuario/contraseña de TD Bank. El botón para conectar está en la
          pantalla <strong>Banco TD Bank</strong> del menú.
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
