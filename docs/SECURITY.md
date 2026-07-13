# Seguridad — CFO Virtual Pachos Supermarket

## 1. Garantía estructural: el sistema no puede mover dinero

Esto no es solo una política — está garantizado por diseño técnico:

| Regla | Cómo se garantiza técnicamente |
|---|---|
| No puede hacer pagos | El backend nunca implementa ni importa productos de Plaid de escritura (`Transfer`, `Payment Initiation`). El SDK de Plaid se instancia únicamente con los productos `auth`, `transactions`, `identity`, `balance` (lectura). No existe cliente de ningún rail de pago (ACH originator, wire, etc.) en las dependencias del proyecto. |
| No puede emitir transferencias | No hay integración con ningún proveedor de transferencias (Stripe Treasury, Dwolla, ACH originators, etc.). |
| No puede mover dinero | La única conexión bancaria es Plaid en modo lectura. No hay credenciales de "originador ACH" ni API keys de movimiento de fondos en ningún `.env`. |
| No puede crear cheques físicos/electrónicos | El módulo "Cheques" es un **registro contable**: guarda cheques que el dueño ya emitió manualmente en su chequera física. No genera, imprime, ni envía cheques. |
| No puede autorizar ACH | No existe endpoint, tabla, ni servicio de autorización ACH. |
| No guarda usuario/contraseña de TD Bank | La conexión usa **Plaid Link**: el dueño ingresa sus credenciales directamente en la interfaz de Plaid (iframe/webview oficial), nunca en un formulario de este sistema. El backend solo recibe un `public_token` de un solo uso, que intercambia por un `access_token` opaco. El sistema nunca ve ni puede ver el usuario/contraseña real del banco. |
| Tokens cifrados | `access_token` de Plaid se cifra con AES-256-GCM antes de persistir (`bank_connections.access_token_encrypted`). La clave de cifrado vive en un secret manager (no en el repo, no en la base de datos). |
| Auditoría de cada acceso | Middleware `auditLogger` registra en `audit_logs` cada request a datos financieros: usuario, acción, entidad, IP, timestamp, resultado. La tabla es append-only (sin `UPDATE`/`DELETE` a nivel de permisos de base de datos para el rol de aplicación). |
| Roles y permisos | RBAC de 4 roles (Dueño, Administrador, Empleado, Contador) aplicado en middleware de backend, no solo ocultado en el frontend. |
| Control total del dueño | Solo el rol `OWNER` puede: crear/editar usuarios, conectar/desconectar el banco, ver todos los reportes, configurar permisos de empleados. |

## 2. Alcance permitido de la integración bancaria (Plaid)

Productos Plaid habilitados — **todos de solo lectura**:

- `accounts` — listar cuentas y saldos.
- `balance` — saldo disponible/actual.
- `transactions` (`/transactions/sync`) — depósitos, retiros, cheques cobrados, cargos.
- `identity` (opcional) — verificar que la cuenta conectada es la del negocio.

Productos explícitamente **prohibidos y no instalados**:

- `transfer` / `transfer/authorization` / `transfer/create`
- `payment_initiation`
- Cualquier SDK de originación ACH/wire

Este alcance se refleja literalmente en la inicialización del cliente de Plaid en el backend (ver `backend/src/integrations/plaid/plaidClient.ts`) y debe mantenerse así en cualquier cambio futuro. **Cualquier PR que agregue un producto de escritura de Plaid o un proveedor de movimiento de dinero debe ser rechazado.**

## 3. Autenticación y sesión

- Contraseñas de usuarios del sistema (no del banco) con `bcrypt` (cost ≥ 12).
- JWT de acceso de corta duración (15 min) + refresh token rotativo (7 días) almacenado como cookie `httpOnly`, `secure`, `sameSite=strict`.
- Bloqueo de cuenta tras 5 intentos fallidos.
- 2FA recomendado para el rol `OWNER` (TOTP) — fase 2.

## 4. RBAC (matriz de permisos)

| Recurso / Acción | Dueño | Administrador | Contador | Empleado |
|---|---|---|---|---|
| Ver saldo bancario TD Bank | ✅ | según config del dueño | ✅ | ❌ |
| Conectar/desconectar banco (Plaid) | ✅ | ❌ | ❌ | ❌ |
| Registrar depósitos manuales de banco/caja | ✅ | ✅ | ❌ | ❌ |
| Ver listado/historial de facturas | ✅ | ✅ | ❌ (solo lectura) | ❌ |
| Crear una factura nueva | ✅ | ✅ | ❌ | ✅ (sin ver el historial de las demás) |
| Registrar cómo se pagó una factura (efectivo/cheque) | ✅ | ✅ | ❌ | ✅ (solo la que acaba de crear; no ve el saldo de caja resultante) |
| Subir comprobantes/adjuntos | ✅ | ✅ | ❌ | ✅ |
| Vincular un comprobante a una factura | ✅ | ✅ | ❌ | ✅ (solo los que subió él mismo) |
| Crear/editar cheques (registro directo) | ✅ | ✅ | ❌ (solo lectura) | ❌ |
| Ver conciliación bancaria | ✅ | ✅ | ✅ | ❌ |
| Ver flujo de caja / proyecciones | ✅ | ✅ | ✅ | ❌ |
| Ver reportes | ✅ | ✅ | ✅ | ❌ |
| Gestionar usuarios y roles | ✅ | ❌ | ❌ | ❌ |
| Ver auditoría | ✅ | ❌ | ❌ | ❌ |

La bandera `employee_can_view_balances` (config del dueño) permite ampliar excepcionalmente qué ve un Empleado. Por defecto, un Empleado (ej. una cajera usando la pantalla "Registrar Factura") puede **crear** una factura y marcar cómo se pagó, pero:
- Nunca ve el listado/historial completo de facturas (`GET /invoices` sigue restringido a Administrador/Contador/Dueño) — solo recibe de vuelta la factura que él mismo acaba de crear.
- Nunca ve el saldo de efectivo en caja ni el saldo bancario — puede *registrar* un pago en efectivo, pero el endpoint no le devuelve el saldo resultante.
- Si su factura resulta ser un posible duplicado de otra ya existente, no ve los datos de esa otra factura (proveedor/monto) — solo un aviso genérico; el detalle completo del duplicado solo lo ve Dueño/Administrador.

## 5. Cifrado y manejo de secretos

- `PLAID_CLIENT_ID`, `PLAID_SECRET`, `TOKEN_ENCRYPTION_KEY`, `JWT_SECRET` viven solo en variables de entorno / secret manager. Nunca en el repositorio.
- `access_token` de Plaid: AES-256-GCM, IV único por registro, guardado como `iv:ciphertext:authTag`.
- Adjuntos (fotos de facturas) se guardan como binario directo en Postgres (`attachments.file_data`), no en un servicio de almacenamiento externo — apropiado para el volumen de un solo supermercado. Se sirven vía `GET /attachments/:id/file`, que requiere sesión autenticada igual que el resto de la API.
- TLS obligatorio en tránsito (HTTPS) en todos los entornos, incluido desarrollo con certificado local si se prueba Plaid Link.

## 6. Auditoría

Tabla `audit_logs` (append-only) registra como mínimo:

- `user_id`, `role_at_time`
- `action` (ej. `INVOICE_CREATE`, `BANK_SYNC`, `CHECK_STATUS_CHANGE`, `LOGIN`, `VIEW_BALANCE`)
- `entity_type`, `entity_id`
- `ip_address`, `user_agent`
- `metadata` (JSON, diff de cambios cuando aplica)
- `created_at`

El rol de base de datos usado por la aplicación tiene `INSERT` pero no `UPDATE`/`DELETE` sobre `audit_logs`.

## 7. Qué revisar en cada Pull Request

Checklist obligatorio antes de mergear cualquier cambio al backend:

- [ ] ¿Se agregó algún endpoint que inicie un movimiento de dinero? → **rechazar**.
- [ ] ¿Se agregó un producto Plaid de escritura? → **rechazar**.
- [ ] ¿Se guardó alguna credencial bancaria en texto plano? → **rechazar**.
- [ ] ¿El nuevo endpoint sensible pasa por `auditLogger`? → requerido.
- [ ] ¿El nuevo endpoint valida rol/permiso? → requerido.
