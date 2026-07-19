import { useState, FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/apiClient";
import { Card } from "../components/ui";
import { FormField, inputClass } from "../components/Modal";

export function RegisterSalePage() {
  const queryClient = useQueryClient();

  const [cardAmount, setCardAmount] = useState("");
  const [cardNotes, setCardNotes] = useState("");
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardSuccess, setCardSuccess] = useState(false);

  const [cashAmount, setCashAmount] = useState("");
  const [cashNotes, setCashNotes] = useState("");
  const [cashError, setCashError] = useState<string | null>(null);
  const [cashSuccess, setCashSuccess] = useState(false);

  const registerCardSale = useMutation({
    mutationFn: () =>
      api.post("/bank/manual-balance/adjust", {
        type: "DEPOSIT",
        amount: Number(cardAmount) || 0,
        notes: cardNotes || "Venta en tarjeta del día",
      }),
    onSuccess: () => {
      setCardAmount("");
      setCardNotes("");
      setCardError(null);
      setCardSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setTimeout(() => setCardSuccess(false), 4000);
    },
    onError: (err: Error) => setCardError(err.message),
  });

  const registerCashSale = useMutation({
    mutationFn: () =>
      api.post("/cash-register/daily-sale", {
        amount: Number(cashAmount) || 0,
        notes: cashNotes || undefined,
      }),
    onSuccess: () => {
      setCashAmount("");
      setCashNotes("");
      setCashError(null);
      setCashSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setTimeout(() => setCashSuccess(false), 4000);
    },
    onError: (err: Error) => setCashError(err.message),
  });

  function handleCardSubmit(e: FormEvent) {
    e.preventDefault();
    setCardError(null);
    if (!cardAmount || Number(cardAmount) <= 0) {
      setCardError("Ingresa un monto válido.");
      return;
    }
    registerCardSale.mutate();
  }

  function handleCashSubmit(e: FormEvent) {
    e.preventDefault();
    setCashError(null);
    if (!cashAmount || Number(cashAmount) <= 0) {
      setCashError("Ingresa un monto válido.");
      return;
    }
    registerCashSale.mutate();
  }

  return (
    <div className="space-y-4 max-w-xl">
      <div>
        <h2 className="text-2xl font-bold">Registrar Venta del Día</h2>
        <p className="text-sm text-slate-500">
          Agrega aquí lo vendido hoy en tarjeta y en efectivo. Solo se agrega — no se muestra ningún saldo en esta
          pantalla.
        </p>
      </div>

      <Card title="Venta en tarjeta">
        <form onSubmit={handleCardSubmit}>
          <FormField label="Monto vendido hoy en tarjeta">
            <input
              required
              type="number"
              step="0.01"
              min="0"
              className={inputClass}
              value={cardAmount}
              onChange={(e) => setCardAmount(e.target.value)}
            />
          </FormField>
          <FormField label="Notas (opcional)">
            <input
              className={inputClass}
              placeholder="Ej. Venta en tarjeta del día"
              value={cardNotes}
              onChange={(e) => setCardNotes(e.target.value)}
            />
          </FormField>
          {cardError && <p className="text-sm text-red-600 mb-3">{cardError}</p>}
          {cardSuccess && <p className="text-sm text-status-success mb-3">Venta en tarjeta registrada ✓</p>}
          <button
            type="submit"
            disabled={registerCardSale.isPending}
            className="w-full bg-brand-orange hover:bg-brand-orangeDark text-white text-sm rounded-md px-4 py-3 font-medium disabled:opacity-50"
          >
            {registerCardSale.isPending ? "Guardando..." : "Agregar venta en tarjeta"}
          </button>
        </form>
      </Card>

      <Card title="Venta en efectivo">
        <form onSubmit={handleCashSubmit}>
          <FormField label="Monto vendido hoy en efectivo">
            <input
              required
              type="number"
              step="0.01"
              min="0"
              className={inputClass}
              value={cashAmount}
              onChange={(e) => setCashAmount(e.target.value)}
            />
          </FormField>
          <FormField label="Notas (opcional)">
            <input
              className={inputClass}
              placeholder="Ej. Venta en efectivo del día"
              value={cashNotes}
              onChange={(e) => setCashNotes(e.target.value)}
            />
          </FormField>
          {cashError && <p className="text-sm text-red-600 mb-3">{cashError}</p>}
          {cashSuccess && <p className="text-sm text-status-success mb-3">Venta en efectivo registrada ✓</p>}
          <button
            type="submit"
            disabled={registerCashSale.isPending}
            className="w-full bg-brand-orange hover:bg-brand-orangeDark text-white text-sm rounded-md px-4 py-3 font-medium disabled:opacity-50"
          >
            {registerCashSale.isPending ? "Guardando..." : "Agregar venta en efectivo"}
          </button>
        </form>
      </Card>
    </div>
  );
}
