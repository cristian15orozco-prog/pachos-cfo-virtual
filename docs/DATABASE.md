# Modelo de datos — CFO Virtual Pachos Supermarket

Base de datos: **PostgreSQL gestionado por Supabase**. El esquema autoritativo vive en [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma) y se aplica al proyecto de Supabase con `npm run prisma:migrate` (no se escribe SQL a mano). Este documento es la referencia legible de las tablas y sus relaciones.

## Diagrama relacional (resumen)

```
users ─┬─< audit_logs
       ├─< invoices (created_by)
       ├─< checks (created_by)
       └─< attachments (uploaded_by)

roles ─< users

providers ─┬─< invoices
           └─< (derivado) checks vía invoices

invoices ─┬─< payments
          ├─< checks (opcional, un cheque puede pagar una factura)
          ├─< attachments
          └─< expense_categories (N:1)

checks ─┬─< reconciliations (opcional, cuando se concilia contra una transacción)
        └─> invoices (N:1 opcional)

bank_connections ─< bank_transactions ─< reconciliations

alerts ─> (polimórfico) invoice | check | bank_transaction | provider

cash_flow_projections (snapshots calculados, no relacional puro)
```

## Tablas

### users
Usuarios del sistema (NO credenciales bancarias).
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| full_name | text | |
| email | text unique | |
| password_hash | text | bcrypt |
| role_id | uuid FK → roles | |
| is_active | boolean | |
| employee_can_view_balances | boolean | override puntual, default false |
| last_login_at | timestamptz | |
| created_at / updated_at | timestamptz | |

### roles
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| name | enum: OWNER, ADMIN, ACCOUNTANT, EMPLOYEE | |
| permissions | jsonb | matriz de permisos granular, ver SECURITY.md |

### providers (proveedores)
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| name | text | |
| contact_name | text | |
| phone | text | |
| email | text | |
| address | text | |
| category | text | |
| notes | text | |
| is_active | boolean | |
| created_at / updated_at | timestamptz | |

Campos calculados (vía vista/servicio, no columnas): `monthly_average_spend`, `pending_balance`, `invoice_count`.

### expense_categories
| Campo | Tipo |
|---|---|
| id | uuid PK |
| name | text unique |
| description | text |

### invoices (facturas de proveedores)
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| provider_id | uuid FK → providers | |
| invoice_number | text | |
| invoice_date | date | |
| due_date | date | |
| subtotal | numeric(14,2) | |
| tax | numeric(14,2) | |
| total | numeric(14,2) | |
| category_id | uuid FK → expense_categories | |
| status | enum: PENDING, PARTIAL, PAID, OVERDUE | |
| notes | text | |
| is_duplicate_flag | boolean | seteado por el motor de detección |
| created_by | uuid FK → users | |
| created_at / updated_at | timestamptz | |

Índice único parcial sugerido: `(provider_id, invoice_number)` para apoyar detección de duplicados.

### payments (pagos aplicados a una factura — registro, no ejecución)
> Registra que "la factura X fue pagada con el cheque Y / con la transacción bancaria Z". No ejecuta ningún pago.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| invoice_id | uuid FK → invoices | |
| check_id | uuid FK → checks, nullable | |
| bank_transaction_id | uuid FK → bank_transactions, nullable | |
| amount | numeric(14,2) | |
| paid_at | date | |
| method | enum: CHECK, BANK_TRANSACTION, CASH, OTHER | |
| created_by | uuid FK → users | |
| created_at | timestamptz | |

### checks (cheques — registro contable de cheques ya emitidos manualmente)
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| check_number | text | |
| issue_date | date | |
| payee | text | |
| bank_name | text | default "TD Bank" |
| amount | numeric(14,2) | |
| invoice_id | uuid FK → invoices, nullable | |
| status | enum: ISSUED, CLEARED, CANCELLED, PENDING | |
| cleared_at | date, nullable | |
| reconciled | boolean | default false |
| notes | text | |
| created_by | uuid FK → users | |
| created_at / updated_at | timestamptz | |

### bank_connections
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| institution_name | text | "TD Bank" |
| plaid_item_id | text | |
| access_token_encrypted | text | AES-256-GCM, nunca en claro |
| status | enum: ACTIVE, ERROR, DISCONNECTED | |
| last_synced_at | timestamptz | |
| created_by | uuid FK → users | solo OWNER puede crear |
| created_at / updated_at | timestamptz | |

### bank_transactions (solo lectura, espejo de Plaid)
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| bank_connection_id | uuid FK → bank_connections | |
| plaid_transaction_id | text unique | |
| account_id | text | |
| amount | numeric(14,2) | positivo/negativo según convención Plaid |
| type | enum: DEPOSIT, WITHDRAWAL, CHECK, FEE, OTHER | derivado |
| description | text | |
| category | text | categoría de Plaid |
| transaction_date | date | |
| is_classified | boolean | default false |
| created_at | timestamptz | |

### reconciliations (conciliación bancaria)
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| bank_transaction_id | uuid FK → bank_transactions | |
| matched_type | enum: INVOICE, CHECK, DEPOSIT_SALE, UNKNOWN | |
| matched_invoice_id | uuid FK → invoices, nullable | |
| matched_check_id | uuid FK → checks, nullable | |
| amount_difference | numeric(14,2) | 0 si coincide exacto |
| status | enum: MATCHED, PARTIAL_MATCH, UNMATCHED, FLAGGED | |
| notes | text | |
| created_at | timestamptz | |

### alerts
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| type | enum (ver BUSINESS_RULES.md) | |
| severity | enum: INFO, WARNING, CRITICAL | |
| message | text | |
| entity_type | text | "invoice" \| "check" \| "bank_transaction" \| "provider" \| "cashflow" |
| entity_id | uuid, nullable | |
| status | enum: OPEN, ACKNOWLEDGED, RESOLVED | |
| created_at | timestamptz | |
| resolved_at | timestamptz, nullable | |

### attachments
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| invoice_id | uuid FK → invoices, nullable | |
| check_id | uuid FK → checks, nullable | |
| file_url | text | URL firmada / referencia a storage |
| file_name | text | |
| mime_type | text | |
| uploaded_by | uuid FK → users | |
| created_at | timestamptz | |

### audit_logs (append-only)
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users, nullable (nullable para intentos de login fallidos) | |
| role_at_time | text | |
| action | text | ej. `BANK_SYNC`, `INVOICE_CREATE`, `VIEW_BALANCE` |
| entity_type | text | |
| entity_id | uuid, nullable | |
| ip_address | text | |
| user_agent | text | |
| metadata | jsonb | |
| created_at | timestamptz | |

### cash_flow_projections
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| snapshot_date | date | fecha del cálculo |
| available_today | numeric(14,2) | |
| projected_7d | numeric(14,2) | |
| projected_15d | numeric(14,2) | |
| projected_30d | numeric(14,2) | |
| expected_inflows | numeric(14,2) | |
| expected_outflows | numeric(14,2) | |
| will_go_negative | boolean | |
| negative_date | date, nullable | primer día proyectado en negativo |
| created_at | timestamptz | |

Ver implementación en [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma).
