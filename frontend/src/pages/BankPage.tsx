import { useEffect, useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePlaidLink } from "react-plaid-link";
import { Landmark, Wallet, Trash2 } from "lucide-react";
import { api } from "../lib/apiClient";
import { Card, Metric, Badge, money, formatDateOnly, PageHeading } from "../components/ui";
import { Modal, FormField, inputClass } from "../components/Modal";
import { useAuth } from "../hooks/useAuth";

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

interface BankMovement {
  id: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  amount: string;
  balanceAfter: string;
  notes: string | null;
  createdAt: string;
}

interface CheckSummary {
  id: string;
  amount: string;
  status: "PENDING" | "ISSUED" | "CLEARED" | "CANCELLED";
}

export function BankPage() {
  const { user } = useAuth();
  const isOwner = user?.role === "OWNER";
  const canManage = user?.role === "OWNER" || user?.role === "ADMIN";
  const queryClient = useQueryClient();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  const accounts = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: () => api.get<{ data: Account[]; isManual: boolean }>("/bank/accounts"),
  });

  const transactions = useQuery({
    queryKey: ["bank-transactions"],
    queryFn: () => api.get<{ data: Transaction[] }>("/bank/transactions").then((r) => r.data),
  });

  const manualMovements = useQuery({
    queryKey: ["bank-manual-movements"],
    queryFn: () => api.get<{ data: BankMovement[] }>("/bank/manual-balance/movements").then((r) => r.data),
    enabled: !!accounts.data?.isManual,
  });

  const checks = useQuery({
    queryKey: ["checks"],
    queryFn: () => api.get<{ data: CheckSummary[] }>("/checks").then((r) => r.data),
  });

  const pendingChecks = checks.data?.filter((c) => c.status === "ISSUED" || c.status === "PENDING") ?? [];
  const pendingChecksTotal = pendingChecks.reduce((sum, c) => sum + Number(c.amount), 0);
  const totalBankBalance =
    accounts.data?.data.reduce((sum, acc) => sum + (acc.balances.available ?? acc.balances.current ?? 0), 0) ?? 0;
  const virtualAvailable = totalBankBalance - pendingChecksTotal;

  const sync = useMutation({
    mutationFn: () => api.post("/bank/sync"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
    },
  });

  const createLinkToken = useMutation({
    mutationFn: () => api.post<{ data: { link_token: string } }>("/bank/link-token"),
    onSuccess: (res) => {
      setConnectError(null);
      setLinkToken(res.data.link_token);
    },
    onError: (err: Error) => setConnectError(err.message),
  });

  const exchangeToken = useMutation({
    mutationFn: (publicToken: string) => api.post("/bank/exchange-public-token", { publicToken }),
    onSuccess: () => {
      setLinkToken(null);
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
    },
    onError: (err: Error) => setConnectError(err.message),
  });

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (publicToken) => exchangeToken.mutate(publicToken),
    onExit: () => setLinkToken(null),
  });

  useEffect(() => {
    if (linkToken && ready) {
      open();
    }
  }, [linkToken, ready, open]);

  const [showManualForm, setShowManualForm] = useState(false);
  const [manualType, setManualType] = useState<"DEPOSIT" | "WITHDRAWAL">("DEPOSIT");
  const [manualAmount, setManualAmount] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);

  const adjustManualBalance = useMutation({
    mutationFn: () =>
      api.post("/bank/manual-balance/adjust", {
        type: manualType,
        amount: Number(manualAmount) || 0,
        notes: manualNotes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["bank-manual-movements"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["cashflow-summary"] });
      setShowManualForm(false);
      setManualAmount("");
      setManualNotes("");
      setManualError(null);
    },
    onError: (err: Error) => setManualError(err.message),
  });

  function handleManualSubmit(e: FormEvent) {
    e.preventDefault();
    adjustManualBalance.mutate();
  }

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteMovement = useMutation({
    mutationFn: (id: string) => api.delete(`/bank/manual-balance/movements/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["bank-manual-movements"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["cashflow-summary"] });
      setDeleteError(null);
    },
    onError: (err: Error) => setDeleteError(err.message),
  });

  const isManual = accounts.data?.isManual ?? false;

  return (
    <div className="space-y-4">
      <PageHeading
        icon={Landmark}
        title="Banco — TD Bank"
        subtitle={
          <>
            Conexión de <strong>solo lectura</strong> vía Plaid. El sistema nunca guarda tu usuario/contraseña del
            banco y nunca puede mover dinero.
          </>
        }
        action={
          <div className="flex gap-2 shrink-0">
            {canManage && isManual && (
              <button
                onClick={() => setShowManualForm(true)}
                className="inline-flex items-center gap-1.5 bg-brand-orange hover:bg-brand-orangeDark text-white text-sm rounded-md px-4 py-2"
              >
                <Wallet size={15} strokeWidth={2} /> Actualizar Saldo Manual
              </button>
            )}
            {isOwner && (
              <button
                onClick={() => createLinkToken.mutate()}
                disabled={createLinkToken.isPending || exchangeToken.isPending}
                className="border border-slate-300 text-slate-700 text-sm rounded-md px-4 py-2 disabled:opacity-50"
              >
                {createLinkToken.isPending || exchangeToken.isPending ? "Conectando..." : "Conectar Banco"}
              </button>
            )}
            <button
              onClick={() => sync.mutate()}
              disabled={sync.isPending}
              className={
                isManual
                  ? "border border-slate-300 text-slate-700 text-sm rounded-md px-4 py-2 disabled:opacity-50"
                  : "bg-brand-orange hover:bg-brand-orangeDark text-white text-sm rounded-md px-4 py-2 disabled:opacity-50"
              }
            >
              {sync.isPending ? "Sincronizando..." : "Sincronizar ahora"}
            </button>
          </div>
        }
      />

      {connectError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">
          No se pudo iniciar la conexión con Plaid: {connectError}. Verifica que{" "}
          <code>PLAID_CLIENT_ID</code> y <code>PLAID_SECRET</code> estén configurados en el backend.
        </div>
      )}

      {isManual && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-md px-4 py-3">
          <Badge tone="warning">Estimado manual</Badge> Este saldo no viene del banco real — es lo último que
          registraste a mano. En cuanto conectes TD Bank vía Plaid, el sistema usa el saldo real automáticamente.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {accounts.data?.data.map((acc) => (
          <Metric key={acc.account_id} label={acc.name} value={money(acc.balances.available ?? acc.balances.current ?? 0)} tone="success" />
        ))}
        <Metric
          label={`Cheques pendientes de cobrar (${pendingChecks.length})`}
          value={money(pendingChecksTotal)}
          tone="warning"
        />
        <Metric
          label="Saldo disponible real (ya descontando cheques)"
          value={money(virtualAvailable)}
          tone={virtualAvailable < 0 ? "danger" : "success"}
        />
      </div>

      {isManual && (
        <Card title="Historial de depósitos manuales">
          {deleteError && <p className="text-sm text-red-600 mb-3">{deleteError}</p>}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-100">
                <th className="py-2">Fecha</th>
                <th>Tipo</th>
                <th>Notas</th>
                <th className="text-right">Monto</th>
                <th className="text-right">Saldo</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {manualMovements.data?.map((m, i) => (
                <tr key={m.id} className="border-b border-slate-50">
                  <td className="py-2">{new Date(m.createdAt).toLocaleDateString()}</td>
                  <td>
                    <Badge tone={m.type === "DEPOSIT" ? "success" : "warning"}>
                      {m.type === "DEPOSIT" ? "Depósito" : "Retiro"}
                    </Badge>
                  </td>
                  <td className="text-slate-500">{m.notes ?? "—"}</td>
                  <td className="text-right">
                    {m.type === "DEPOSIT" ? "+" : "-"}
                    {money(m.amount)}
                  </td>
                  <td className="text-right font-medium">{money(m.balanceAfter)}</td>
                  {canManage && (
                    <td className="text-right pl-3 whitespace-nowrap">
                      {i === 0 && (
                        <button
                          onClick={() => {
                            if (confirm("¿Eliminar este movimiento? El saldo volverá al valor anterior."))
                              deleteMovement.mutate(m.id);
                          }}
                          disabled={deleteMovement.isPending}
                          className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                        >
                          <Trash2 size={13} strokeWidth={2} /> Eliminar
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {!manualMovements.data?.length && (
                <tr>
                  <td colSpan={6} className="py-3 text-slate-400">
                    Sin movimientos manuales todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {!isManual && (
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
                  <td className="py-2">{formatDateOnly(t.transactionDate)}</td>
                  <td>{t.description}</td>
                  <td>{t.type}</td>
                  <td className="text-right">{money(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {showManualForm && (
        <Modal title="Actualizar Saldo Manual de TD Bank" onClose={() => setShowManualForm(false)}>
          <form onSubmit={handleManualSubmit}>
            <p className="text-xs text-slate-500 bg-slate-50 rounded-md px-3 py-2 mb-3">
              Registra aquí los depósitos de tarjeta de crédito/débito que veas confirmados en tu banca en línea de
              TD Bank. Esto es solo un estimado manual, no un dato verificado del banco.
            </p>
            <FormField label="Tipo">
              <select
                className={inputClass}
                value={manualType}
                onChange={(e) => setManualType(e.target.value as "DEPOSIT" | "WITHDRAWAL")}
              >
                <option value="DEPOSIT">Depósito (entró dinero)</option>
                <option value="WITHDRAWAL">Retiro / corrección</option>
              </select>
            </FormField>
            <FormField label="Monto">
              <input
                required
                type="number"
                step="0.01"
                min="0"
                autoFocus
                className={inputClass}
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
              />
            </FormField>
            <FormField label="Notas (opcional)">
              <input
                className={inputClass}
                placeholder="Ej. Depósito de tarjetas del día"
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
              />
            </FormField>

            {manualError && <p className="text-sm text-red-600 mb-3">{manualError}</p>}

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowManualForm(false)}
                className="text-sm px-4 py-2 rounded-md border border-slate-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={adjustManualBalance.isPending}
                className="bg-brand-orange hover:bg-brand-orangeDark text-white text-sm rounded-md px-4 py-2 disabled:opacity-50"
              >
                {adjustManualBalance.isPending ? "Guardando..." : "Registrar"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
