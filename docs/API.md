# API — CFO Virtual Pachos Supermarket

Base URL: `/api/v1`. Autenticación: `Authorization: Bearer <JWT>` salvo `/auth/*`.
Todos los endpoints marcados 🔒 requieren rol mínimo indicado. Todos los endpoints que tocan datos financieros pasan por el middleware de auditoría.

## Auth
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/auth/login` | público | Login con email/password → access + refresh token |
| POST | `/auth/refresh` | público (cookie) | Renueva access token |
| POST | `/auth/logout` | autenticado | Invalida refresh token |
| GET | `/auth/me` | autenticado | Perfil y rol del usuario actual |

## Usuarios y roles
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/users` | 🔒 OWNER | Listar usuarios |
| POST | `/users` | 🔒 OWNER | Crear usuario (asigna rol) |
| PATCH | `/users/:id` | 🔒 OWNER | Editar usuario / rol / permisos |
| DELETE | `/users/:id` | 🔒 OWNER | Desactivar usuario |
| GET | `/roles` | 🔒 OWNER | Listar roles y matriz de permisos |

## Proveedores
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/providers` | ADMIN+ | Listar con balance pendiente y promedio mensual |
| GET | `/providers/:id` | ADMIN+ | Detalle + historial de facturas/pagos |
| POST | `/providers` | ADMIN+ | Crear proveedor |
| PATCH | `/providers/:id` | ADMIN+ | Editar proveedor |
| DELETE | `/providers/:id` | OWNER | Desactivar proveedor |

## Facturas
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/invoices` | ADMIN+ (lectura: ACCOUNTANT) | Filtros: estado, proveedor, vencimiento, categoría |
| GET | `/invoices/:id` | ADMIN+ / ACCOUNTANT | Detalle |
| POST | `/invoices` | ADMIN+ | Crear factura (dispara detección de duplicados) |
| PATCH | `/invoices/:id` | ADMIN+ | Editar / cambiar estado |
| DELETE | `/invoices/:id` | OWNER | Eliminar (soft delete) |
| POST | `/invoices/:id/attachments` | ADMIN+ / EMPLOYEE | Subir comprobante |
| GET | `/invoices/alerts/duplicates` | ADMIN+ | Lista de posibles duplicados |
| GET | `/invoices/alerts/overdue` | ADMIN+ | Facturas vencidas |
| GET | `/invoices/alerts/missing-receipt` | ADMIN+ | Facturas sin comprobante adjunto |

## Cheques
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/checks` | ADMIN+ / ACCOUNTANT | Filtros: estado, banco, rango de fecha |
| GET | `/checks/:id` | ADMIN+ / ACCOUNTANT | Detalle |
| POST | `/checks` | ADMIN+ | Registrar cheque emitido manualmente |
| PATCH | `/checks/:id` | ADMIN+ | Editar / cambiar estado |
| POST | `/checks/:id/mark-cleared` | ADMIN+ | Marcar cobrado manualmente (además de la detección automática) |

## Banco (TD Bank vía Plaid) — SOLO LECTURA
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/bank/link-token` | OWNER | Crea `link_token` para abrir Plaid Link |
| POST | `/bank/exchange-public-token` | OWNER | Intercambia `public_token` → `access_token` (se cifra y guarda) |
| GET | `/bank/accounts` | OWNER / ADMIN* | Cuentas conectadas y saldo actual (solo lectura de Plaid) |
| GET | `/bank/transactions` | OWNER / ADMIN* / ACCOUNTANT | Transacciones sincronizadas, con filtros |
| POST | `/bank/sync` | OWNER | Fuerza sincronización manual (`transactions/sync`, `accounts/balance/get`) |
| DELETE | `/bank/connection/:id` | OWNER | Desconecta el banco (revoca item en Plaid) |

*ADMIN solo si `employee_can_view_balances`/permiso equivalente está habilitado por el dueño.

> No existen, ni existirán, endpoints `/bank/transfer`, `/bank/payment`, `/bank/ach`. Ver [SECURITY.md](./SECURITY.md).

## Conciliación
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/reconciliation` | ADMIN+ / ACCOUNTANT | Estado de conciliación (matched/unmatched/flagged) |
| POST | `/reconciliation/run` | ADMIN+ | Ejecuta el motor de conciliación bajo demanda |
| POST | `/reconciliation/:id/resolve` | ADMIN+ | Marca una discrepancia como revisada/resuelta |

## Flujo de caja
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/cashflow/summary` | ADMIN+ / ACCOUNTANT | Disponible hoy, entradas/salidas esperadas |
| GET | `/cashflow/projection?days=7\|15\|30` | ADMIN+ / ACCOUNTANT | Proyección de saldo |
| GET | `/cashflow/history` | ADMIN+ / ACCOUNTANT | Snapshots históricos de proyección |

## Alertas
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/alerts?status=OPEN` | ADMIN+ / ACCOUNTANT | Lista de alertas |
| PATCH | `/alerts/:id` | ADMIN+ | Cambiar estado (acknowledge/resolve) |

## Reportes y CFO virtual
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/reports/daily?date=YYYY-MM-DD` | ADMIN+ / ACCOUNTANT | Reporte diario del dueño |
| GET | `/reports/daily/latest` | ADMIN+ / ACCOUNTANT | Último reporte generado |
| GET | `/cfo/recommendations` | ADMIN+ / ACCOUNTANT | Recomendaciones actuales del CFO virtual |

## Auditoría
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/audit-logs` | OWNER | Consulta de auditoría con filtros |

## Convenciones
- Todas las respuestas de error: `{ "error": { "code": "...", "message": "..." } }`.
- Paginación: `?page=&pageSize=` con respuesta `{ data: [], total, page, pageSize }`.
- Montos siempre como string decimal (`"1234.56"`) para evitar errores de precisión de punto flotante.
