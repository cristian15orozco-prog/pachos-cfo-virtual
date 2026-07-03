# Reglas de negocio — CFO Virtual Pachos Supermarket

## 1. Estados de factura

- `PENDING` — registrada, sin pago aplicado, dentro de fecha.
- `PARTIAL` — suma de `payments` > 0 y < `total`.
- `PAID` — suma de `payments` ≥ `total`.
- `OVERDUE` — `due_date` < hoy y estado no es `PAID`. Recalculado por job diario.

## 2. Estados de cheque

- `PENDING` — registrado, aún no emitido físicamente.
- `ISSUED` — entregado al beneficiario, no confirmado en banco.
- `CLEARED` — detectado como cobrado en `bank_transactions` (o marcado manualmente).
- `CANCELLED` — anulado.

## 3. Detección automática (motor de reglas, corre tras cada mutación relevante y en el sync diario)

| Detección | Regla |
|---|---|
| Factura duplicada | Mismo `provider_id` + `invoice_number` ya existe, **o** mismo proveedor + monto total + fecha de factura dentro de ±3 días |
| Factura sin comprobante | `invoice.status != DRAFT` y no tiene registro en `attachments` |
| Factura vencida | `due_date < today` y `status not in (PAID)` |
| Monto distinto al pago bancario | Existe `payment` con `bank_transaction_id` cuyo `bank_transaction.amount` ≠ `invoice.total` (dentro de tolerancia configurable, default $0.00) |
| Proveedor cobrando dos veces | Dos `bank_transactions` distintas conciliadas contra el mismo `invoice_id`, o dos pagos por el mismo monto+proveedor en una ventana de 5 días sin dos facturas distintas que lo justifiquen |
| Cheque cobrado no registrado | `bank_transaction.type = CHECK` sin `reconciliation` que apunte a un `check_id` existente |
| Cargo desconocido | `bank_transaction` tipo retiro/fee sin conciliación ni clasificación manual tras 48h |

## 4. Conciliación bancaria — lógica de matching

Orden de intento de conciliación por cada `bank_transaction` nueva:

1. **Cheques**: si `type = CHECK`, buscar `checks` con `amount` igual y `status IN (ISSUED, PENDING)`. Si hay un único match → `CLEARED` + `reconciled = true`. Si hay múltiples candidatos → alerta `CRITICAL` para revisión manual (no se auto-resuelve una ambigüedad).
2. **Facturas/pagos**: si `type = WITHDRAWAL` y existe `payment` pendiente de conciliar con `amount` igual (± tolerancia) y proveedor cuyo nombre aparece en la descripción → `MATCHED`.
3. **Depósitos**: si `type = DEPOSIT`, comparar contra ventas/depósitos esperados (fase 2, integración POS); mientras tanto queda `UNKNOWN` con severidad `INFO` hasta clasificación manual.
4. Si no matchea nada tras los pasos anteriores → `status = UNMATCHED`, se crea alerta.

## 5. Flujo de caja — cálculo de proyección

```
disponible_hoy = saldo_actual_TD_Bank (Plaid, solo lectura) + efectivo_en_caja
entradas_esperadas(N días) = suma de ventas/depósitos recurrentes estimados dentro de N días
                              (fase 1: promedio móvil de depósitos históricos de bank_transactions;
                               fase 2: integración POS)
salidas_esperadas(N días)  = suma de invoices.total pendientes con due_date <= hoy+N
                            + suma de checks con status IN (ISSUED, PENDING) sin fecha de cobro conocida
                              (se asume cobro dentro de la ventana si no hay dato mejor)

proyectado(N) = disponible_hoy + entradas_esperadas(N) - salidas_esperadas(N)
```

Se calcula para N = 7, 15, 30 y se guarda snapshot diario en `cash_flow_projections`.
Si `proyectado(N) < 0` para cualquier N → `will_go_negative = true`, `negative_date` = primer día estimado, y se dispara alerta `CRITICAL`.

## 6. Catálogo de alertas inteligentes

| Código | Mensaje plantilla | Severidad |
|---|---|---|
| `INVOICE_DUE_TOMORROW` | "Esta factura vence mañana." | WARNING |
| `CHECK_NOT_CLEARED` | "Este cheque aún no ha sido cobrado." | INFO |
| `INVOICE_DUPLICATE` | "Este proveedor tiene una factura duplicada." | WARNING |
| `PAYMENT_NO_INVOICE_MATCH` | "Este pago no coincide con ninguna factura." | CRITICAL |
| `CASHFLOW_LOW_15D` | "El flujo de caja puede quedar bajo en los próximos 15 días." | CRITICAL |
| `UNCLASSIFIED_CHARGE` | "Hay un cargo bancario sin clasificar." | WARNING |
| `INVOICE_OVERDUE` | "Esta factura está vencida." | CRITICAL |
| `PROVIDER_DOUBLE_CHARGE` | "Este proveedor podría estar cobrando dos veces." | CRITICAL |
| `AMOUNT_MISMATCH` | "El monto pagado no coincide con el monto facturado." | WARNING |

## 7. Recomendaciones del CFO virtual (plantillas basadas en reglas, no IA generativa por defecto)

El `CfoAdvisorService` evalúa el estado actual y produce texto usando plantillas condicionales, por ejemplo:

- Si `cash_flow_projections.projected_15d < umbral_minimo` → "No emitas más cheques esta semana si quieres mantener caja positiva."
- Si una factura vence en >10 días y el flujo de caja a 7 días es ajustado → "Es mejor esperar antes de pagar esta factura."
- Si un proveedor tiene ≥3 facturas `PENDING` simultáneas → "Este proveedor tiene muchos pagos pendientes."
- Si hay `bank_transaction` con alerta `UNCLASSIFIED_CHARGE` > 3 días → "Este cargo debe revisarse."
- Si `disponible_hoy - salidas_esperadas(7)` sigue positivo después de sumar un grupo de facturas `PENDING` → "Puedes pagar estas facturas sin afectar el flujo de caja." (lista las facturas específicas)

Estas recomendaciones son **informativas**: nunca ejecutan la acción sugerida.

## 8. Reporte diario del dueño

Generado por job programado (ej. 6:00 AM hora local) y disponible bajo demanda. Contenido:

1. Dinero disponible (banco + caja).
2. Ventas/depósitos del día anterior.
3. Pagos registrados el día anterior.
4. Cheques cobrados el día anterior.
5. Cheques pendientes (total y lista).
6. Facturas vencidas (total y lista).
7. Facturas que vencen en los próximos 3 días.
8. Riesgos financieros activos (alertas `CRITICAL` abiertas).
9. Recomendaciones del CFO virtual.
