import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/apiClient";
import { Card, Badge, money } from "../components/ui";
import { Modal, FormField, inputClass } from "../components/Modal";

interface User {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  employeeCanViewBalances: boolean;
  role: { name: string };
}

type CashAccount = "DAILY_SALES" | "RENT" | "PAYROLL" | "SAVINGS";

interface CashMovement {
  id: string;
  account: CashAccount;
  type: "DEPOSIT" | "WITHDRAWAL" | "PAYMENT" | "TRANSFER_IN" | "TRANSFER_OUT";
  amount: string;
  balanceAfter: string;
  notes: string | null;
  createdAt: string;
}

const MOVEMENT_LABEL: Record<CashMovement["type"], string> = {
  DEPOSIT: "Depósito",
  WITHDRAWAL: "Retiro",
  PAYMENT: "Pago de factura",
  TRANSFER_IN: "Transferencia recibida",
  TRANSFER_OUT: "Transferencia enviada",
};

const CASH_ACCOUNTS: CashAccount[] = ["DAILY_SALES", "RENT", "PAYROLL", "SAVINGS"];

const ACCOUNT_LABEL: Record<CashAccount, string> = {
  DAILY_SALES: "Ventas del Día",
  RENT: "Renta",
  PAYROLL: "Pago de Trabajadores",
  SAVINGS: "Ahorro",
};

const ROLE_OPTIONS = ["OWNER", "ADMIN", "ACCOUNTANT", "EMPLOYEE"] as const;

const emptyNewUserForm = {
  fullName: "",
  email: "",
  password: "",
  roleName: "EMPLOYEE" as (typeof ROLE_OPTIONS)[number],
};

const emptyEditForm = {
  fullName: "",
  roleName: "EMPLOYEE" as (typeof ROLE_OPTIONS)[number],
  isActive: true,
  newPassword: "",
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

  const { data: cashData } = useQuery({
    queryKey: ["cash-register"],
    queryFn: () =>
      api.get<{ data: { balance: number; accounts: Record<CashAccount, number> } }>("/cash-register").then((r) => r.data),
  });

  const { data: movements } = useQuery({
    queryKey: ["cash-register-movements"],
    queryFn: () => api.get<{ data: CashMovement[] }>("/cash-register/movements").then((r) => r.data),
  });

  const invalidateCash = () => {
    queryClient.invalidateQueries({ queryKey: ["cash-register"] });
    queryClient.invalidateQueries({ queryKey: ["cash-register-movements"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["cashflow-summary"] });
    queryClient.invalidateQueries({ queryKey: ["cashflow-timeline"] });
  };

  const [adjustAccount, setAdjustAccount] = useState<CashAccount>("DAILY_SALES");
  const [adjustType, setAdjustType] = useState<"DEPOSIT" | "WITHDRAWAL">("DEPOSIT");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNotes, setAdjustNotes] = useState("");
  const [adjustError, setAdjustError] = useState<string | null>(null);

  const adjustCash = useMutation({
    mutationFn: () =>
      api.post("/cash-register/adjust", {
        account: adjustAccount,
        type: adjustType,
        amount: Number(adjustAmount) || 0,
        notes: adjustNotes || undefined,
      }),
    onSuccess: () => {
      invalidateCash();
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

  const [transferFrom, setTransferFrom] = useState<CashAccount>("DAILY_SALES");
  const [transferTo, setTransferTo] = useState<CashAccount>("SAVINGS");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferNotes, setTransferNotes] = useState("");
  const [transferError, setTransferError] = useState<string | null>(null);

  const transferCash = useMutation({
    mutationFn: () =>
      api.post("/cash-register/transfer", {
        fromAccount: transferFrom,
        toAccount: transferTo,
        amount: Number(transferAmount) || 0,
        notes: transferNotes || undefined,
      }),
    onSuccess: () => {
      invalidateCash();
      setTransferAmount("");
      setTransferNotes("");
      setTransferError(null);
    },
    onError: (err: Error) => setTransferError(err.message),
  });

  function handleTransferSubmit(e: FormEvent) {
    e.preventDefault();
    if (transferFrom === transferTo) {
      setTransferError("La cuenta de origen y destino no pueden ser la misma.");
      return;
    }
    transferCash.mutate();
  }

  // --- Crear usuario ---
  const [showNewUserForm, setShowNewUserForm] = useState(false);
  const [newUserForm, setNewUserForm] = useState(emptyNewUserForm);
  const [newUserError, setNewUserError] = useState<string | null>(null);

  const createUser = useMutation({
    mutationFn: () => api.post("/users", newUserForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowNewUserForm(false);
      setNewUserForm(emptyNewUserForm);
      setNewUserError(null);
    },
    onError: (err: Error) => setNewUserError(err.message),
  });

  function handleNewUserSubmit(e: FormEvent) {
    e.preventDefault();
    createUser.mutate();
  }

  // --- Editar usuario ---
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [editError, setEditError] = useState<string | null>(null);

  const updateUser = useMutation({
    mutationFn: async () => {
      if (!editingUser) return;
      await api.patch(`/users/${editingUser.id}`, {
        fullName: editForm.fullName,
        roleName: editForm.roleName,
        isActive: editForm.isActive,
      });
      if (editForm.newPassword) {
        await api.patch(`/users/${editingUser.id}/password`, { newPassword: editForm.newPassword });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditingUser(null);
      setEditError(null);
    },
    onError: (err: Error) => setEditError(err.message),
  });

  function openEditModal(user: User) {
    setEditingUser(user);
    setEditForm({
      fullName: user.fullName,
      roleName: user.role.name as (typeof ROLE_OPTIONS)[number],
      isActive: user.isActive,
      newPassword: "",
    });
    setEditError(null);
  }

  function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (editForm.newPassword && editForm.newPassword.length < 8) {
      setEditError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    updateUser.mutate();
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Configuración</h2>

      <Card title="Efectivo en caja">
        <p className="text-xs text-slate-400 mb-3">
          Total: <span className="text-lg font-bold text-pachos-green">{money(cashData?.balance ?? 0)}</span> — dividido
          en 4 cuentas de efectivo.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {CASH_ACCOUNTS.map((account) => (
            <div key={account} className="rounded-md border border-slate-200 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-slate-400">{ACCOUNT_LABEL[account]}</p>
              <p className="text-lg font-bold text-slate-900">{money(cashData?.accounts?.[account] ?? 0)}</p>
            </div>
          ))}
        </div>

        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Ajustar una cuenta</h4>
        <form onSubmit={handleAdjustSubmit} className="flex flex-wrap items-end gap-3 mb-2">
          <div className="w-44">
            <FormField label="Cuenta">
              <select
                className={inputClass}
                value={adjustAccount}
                onChange={(e) => setAdjustAccount(e.target.value as CashAccount)}
              >
                {CASH_ACCOUNTS.map((a) => (
                  <option key={a} value={a}>
                    {ACCOUNT_LABEL[a]}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
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
        {adjustError && <p className="text-sm text-red-600 mb-4">{adjustError}</p>}

        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Transferir entre cuentas</h4>
        <form onSubmit={handleTransferSubmit} className="flex flex-wrap items-end gap-3 mb-2">
          <div className="w-44">
            <FormField label="Desde">
              <select
                className={inputClass}
                value={transferFrom}
                onChange={(e) => setTransferFrom(e.target.value as CashAccount)}
              >
                {CASH_ACCOUNTS.map((a) => (
                  <option key={a} value={a}>
                    {ACCOUNT_LABEL[a]}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <div className="w-44">
            <FormField label="Hacia">
              <select
                className={inputClass}
                value={transferTo}
                onChange={(e) => setTransferTo(e.target.value as CashAccount)}
              >
                {CASH_ACCOUNTS.map((a) => (
                  <option key={a} value={a}>
                    {ACCOUNT_LABEL[a]}
                  </option>
                ))}
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
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
              />
            </FormField>
          </div>
          <div className="flex-1 min-w-[160px]">
            <FormField label="Notas (opcional)">
              <input
                className={inputClass}
                value={transferNotes}
                onChange={(e) => setTransferNotes(e.target.value)}
              />
            </FormField>
          </div>
          <button
            type="submit"
            disabled={transferCash.isPending}
            className="bg-slate-700 text-white text-sm rounded-md px-4 py-2 disabled:opacity-50 h-[38px]"
          >
            {transferCash.isPending ? "Transfiriendo..." : "Transferir"}
          </button>
        </form>
        {transferError && <p className="text-sm text-red-600 mb-3">{transferError}</p>}

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-100">
              <th className="py-2">Fecha</th>
              <th>Cuenta</th>
              <th>Tipo</th>
              <th>Notas</th>
              <th className="text-right">Monto</th>
              <th className="text-right">Saldo cuenta</th>
            </tr>
          </thead>
          <tbody>
            {movements?.slice(0, 15).map((m) => (
              <tr key={m.id} className="border-b border-slate-50">
                <td className="py-2">{new Date(m.createdAt).toLocaleDateString()}</td>
                <td className="text-slate-500">{ACCOUNT_LABEL[m.account]}</td>
                <td>
                  <Badge tone={m.type === "DEPOSIT" || m.type === "TRANSFER_IN" ? "success" : "warning"}>
                    {MOVEMENT_LABEL[m.type]}
                  </Badge>
                </td>
                <td className="text-slate-500">{m.notes ?? "—"}</td>
                <td className="text-right">
                  {m.type === "DEPOSIT" || m.type === "TRANSFER_IN" ? "+" : "-"}
                  {money(m.amount)}
                </td>
                <td className="text-right font-medium">{money(m.balanceAfter)}</td>
              </tr>
            ))}
            {!movements?.length && (
              <tr>
                <td colSpan={6} className="py-3 text-slate-400">
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
        <div className="flex justify-end mb-3">
          <button
            onClick={() => setShowNewUserForm(true)}
            className="bg-pachos-green text-white text-sm rounded-md px-4 py-2"
          >
            + Nuevo Usuario
          </button>
        </div>
        {isLoading && <p className="text-slate-400 text-sm">Cargando...</p>}
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-100">
              <th className="py-2">Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Activo</th>
              <th>Ve saldos bancarios</th>
              <th></th>
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
                <td className="text-right">
                  <button onClick={() => openEditModal(u)} className="text-xs text-pachos-green underline">
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {showNewUserForm && (
        <Modal title="Nuevo Usuario" onClose={() => setShowNewUserForm(false)}>
          <form onSubmit={handleNewUserSubmit}>
            <FormField label="Nombre completo">
              <input
                required
                className={inputClass}
                value={newUserForm.fullName}
                onChange={(e) => setNewUserForm({ ...newUserForm, fullName: e.target.value })}
              />
            </FormField>
            <FormField label="Email">
              <input
                required
                type="email"
                className={inputClass}
                value={newUserForm.email}
                onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
              />
            </FormField>
            <FormField label="Contraseña temporal">
              <input
                required
                type="password"
                minLength={8}
                className={inputClass}
                value={newUserForm.password}
                onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
              />
            </FormField>
            <FormField label="Rol">
              <select
                className={inputClass}
                value={newUserForm.roleName}
                onChange={(e) => setNewUserForm({ ...newUserForm, roleName: e.target.value as (typeof ROLE_OPTIONS)[number] })}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </FormField>

            {newUserError && <p className="text-sm text-red-600 mb-3">{newUserError}</p>}

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowNewUserForm(false)}
                className="text-sm px-4 py-2 rounded-md border border-slate-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={createUser.isPending}
                className="bg-pachos-green text-white text-sm rounded-md px-4 py-2 disabled:opacity-50"
              >
                {createUser.isPending ? "Guardando..." : "Crear usuario"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editingUser && (
        <Modal title={`Editar — ${editingUser.fullName}`} onClose={() => setEditingUser(null)}>
          <form onSubmit={handleEditSubmit}>
            <p className="text-xs text-slate-400 mb-3">{editingUser.email} (el email no se puede cambiar)</p>
            <FormField label="Nombre completo">
              <input
                required
                className={inputClass}
                value={editForm.fullName}
                onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
              />
            </FormField>
            <FormField label="Rol">
              <select
                className={inputClass}
                value={editForm.roleName}
                onChange={(e) => setEditForm({ ...editForm, roleName: e.target.value as (typeof ROLE_OPTIONS)[number] })}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </FormField>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3">
              <input
                type="checkbox"
                checked={editForm.isActive}
                onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
              />
              Usuario activo
            </label>
            <FormField label="Nueva contraseña (opcional)">
              <input
                type="password"
                minLength={8}
                placeholder="Dejar en blanco para no cambiarla"
                className={inputClass}
                value={editForm.newPassword}
                onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
              />
            </FormField>

            {editError && <p className="text-sm text-red-600 mb-3">{editError}</p>}

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-sm px-4 py-2 rounded-md border border-slate-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={updateUser.isPending}
                className="bg-pachos-green text-white text-sm rounded-md px-4 py-2 disabled:opacity-50"
              >
                {updateUser.isPending ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
