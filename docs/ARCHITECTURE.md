# CFO Virtual — Pachos Supermarket
## Arquitectura del sistema

> Este sistema es exclusivamente para **Pachos Supermarket**. No incluye ni referencia a RR Importaciones.

## 1. Principio rector

El sistema **solo informa, organiza, analiza y alerta**. Nunca mueve dinero, nunca paga, nunca emite transferencias, cheques o ACH, y nunca guarda credenciales bancarias. Este principio está reflejado en el código, no solo en la documentación: no existe en el backend ningún endpoint, servicio o dependencia capaz de iniciar una transacción bancaria. Ver [SECURITY.md](./SECURITY.md).

## 2. Visión general de la arquitectura

```
┌──────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React SPA)                        │
│  Login · Dashboard · Facturas · Cheques · Proveedores · Banco        │
│  Conciliación · Flujo de Caja · Alertas · Reportes · Configuración   │
└───────────────────────────────┬────────────────────────────────────-─┘
                                 │ HTTPS (JWT Bearer)
┌───────────────────────────────▼────────────────────────────────────-─┐
│                        BACKEND API (Node.js / Express)                │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌─────────────────┐    │
│  │   Auth &   │ │   RBAC     │ │   Audit    │ │  Motor de        │    │
│  │   JWT      │ │ Middleware │ │  Logging   │ │  Alertas / CFO   │    │
│  └────────────┘ └────────────┘ └────────────┘ └─────────────────┘    │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌─────────────────┐    │
│  │ Facturas   │ │  Cheques   │ │ Proveedores│ │  Flujo de Caja   │    │
│  └────────────┘ └────────────┘ └────────────┘ └─────────────────┘    │
│  ┌───────────────────────────┐ ┌────────────────────────────────┐    │
│  │  Conciliación Bancaria    │ │  Conector Plaid (SOLO LECTURA)  │    │
│  └───────────────────────────┘ └────────────────────────────────┘    │
└───────┬───────────────────────────────────┬──────────────────────────┘
        │                                   │ read-only (transactions/get,
        │                                   │ accounts/balance/get)
┌───────▼───────────┐               ┌───────▼─────────────────────────┐
│  Supabase (Postgres)│               │  Plaid API → TD Bank            │
│  (datos del negocio,│               │  (token cifrado, sin acceso a  │
│   tokens cifrados)  │               │   usuario/contraseña de TD)    │
└────────────────────┘               └──────────────────────────────-─┘
```

> **Nota sobre Supabase**: se usa únicamente como base de datos PostgreSQL gestionada, a través de Prisma (`DATABASE_URL` con connection pooler + `DIRECT_URL` para migraciones — ver `backend/.env.example`). El backend nunca usa el cliente JS de Supabase para leer/escribir datos financieros; todo el acceso pasa por Prisma con el RBAC y la auditoría descritos en este documento, para mantener una única fuente de verdad de permisos en el servidor.

## 3. Stack tecnológico recomendado

| Capa | Tecnología | Justificación |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite | SPA rápida, tipado fuerte, ecosistema maduro |
| UI | TailwindCSS + shadcn/ui + Recharts | Dashboards financieros con gráficas, desarrollo rápido |
| Backend | Node.js 20 + TypeScript + Express | Mismo lenguaje que el frontend, ecosistema Plaid oficial en Node |
| ORM | Prisma | Migraciones tipadas, esquema declarativo, seguro contra SQL injection |
| Base de datos | **Supabase** (PostgreSQL 15+ gestionado) | Postgres administrado, backups automáticos, connection pooler (pgbouncer) incluido, panel de administración para inspeccionar datos sin acceso directo al servidor |
| Autenticación | JWT (access + refresh) + bcrypt | Estándar, permite RBAC por claims |
| Integración bancaria | **Plaid** (modo `read_only`, productos `auth`, `transactions`, `balance`) | Es el estándar de la industria para agregación bancaria de solo lectura; nunca expone credenciales del banco al sistema |
| Cifrado de tokens | AES-256-GCM (via `crypto` de Node) con clave en KMS/Vault | Los `access_token` de Plaid se cifran en reposo |
| Colas / jobs | node-cron o BullMQ + Redis | Sincronización diaria de transacciones, generación de reporte diario, recálculo de flujo de caja |
| Almacenamiento de archivos | S3 (o compatible) con URLs firmadas | Adjuntos de facturas (PDF/imágenes) |
| Auditoría | Tabla `audit_logs` append-only + hash encadenado opcional | Trazabilidad de cada acceso y acción |
| Infraestructura | Docker Compose (dev) → Railway/Render/AWS (prod) | Despliegue simple y reproducible |
| Observabilidad | pino (logs estructurados) + Sentry | Errores y auditoría técnica separada de auditoría de negocio |

## 4. Módulos del backend

- **auth/** — login, refresh token, hash de contraseñas, ningún dato bancario aquí.
- **rbac/** — matriz de roles/permisos, middleware `requireRole`, `requirePermission`.
- **audit/** — middleware que registra cada request sensible (quién, qué, cuándo, IP, resultado).
- **providers/** — CRUD proveedores + historial.
- **invoices/** — CRUD facturas + motor de detección de duplicados/vencidas/sin comprobante.
- **checks/** — CRUD cheques + estado + conciliación con banco.
- **bank/** — conector Plaid **solo lectura**: link token, exchange de public_token, sync de transacciones, saldo. **Sin endpoints de transferencia.**
- **reconciliation/** — motor de comparación factura↔pago↔cheque↔transacción bancaria.
- **cashflow/** — proyección de caja a 7/15/30 días.
- **alerts/** — generación y consulta de alertas inteligentes.
- **reports/** — reporte diario del dueño (PDF/JSON) + recomendaciones del CFO virtual.
- **attachments/** — subida/descarga de comprobantes.

## 5. Flujo de sincronización bancaria (solo lectura)

1. El dueño conecta TD Bank vía **Plaid Link** (widget oficial de Plaid) desde el frontend. El sistema nunca ve usuario/contraseña del banco: Plaid maneja esa pantalla directamente.
2. Plaid devuelve un `public_token` de un solo uso al frontend.
3. El frontend lo envía al backend, que lo intercambia por un `access_token` permanente llamando a Plaid (`/item/public_token/exchange`).
4. El `access_token` se **cifra (AES-256-GCM)** antes de guardarse en `bank_connections.access_token_encrypted`. Nunca se guarda en texto plano ni se expone al frontend.
5. Un job programado (cron) llama diariamente (y bajo demanda) a `transactions/sync` y `accounts/balance/get` — ambos endpoints de **solo lectura** de Plaid — y guarda el resultado en `bank_transactions`.
6. El motor de conciliación compara automáticamente esas transacciones contra facturas y cheques registrados.
7. Cada sincronización queda registrada en `audit_logs`.

No existe, en ningún punto del sistema, una llamada a productos de Plaid de escritura (`/transfer/*`, `/payment_initiation/*`) ni a APIs ACH. Ver [SECURITY.md](./SECURITY.md) para el detalle de por qué esto es estructuralmente imposible, no solo una regla de negocio.

## 6. Motor de alertas y CFO virtual

Un servicio `AlertEngine` corre después de cada sincronización bancaria y cada mutación relevante (nueva factura, nuevo cheque). Evalúa reglas (ver [BUSINESS_RULES.md](./BUSINESS_RULES.md)) y escribe filas en `alerts`. El `CfoAdvisorService` consume el estado de `alerts` + `cash_flow_projections` + facturas/cheques pendientes para producir recomendaciones en lenguaje natural (plantillas, no pagos ni acciones automáticas).

## 7. Documentos relacionados

- [DATABASE.md](./DATABASE.md) — modelo de datos completo.
- [API.md](./API.md) — endpoints.
- [SECURITY.md](./SECURITY.md) — reglas de seguridad y por qué el sistema no puede mover dinero.
- [BUSINESS_RULES.md](./BUSINESS_RULES.md) — reglas de negocio y alertas.
- [ROADMAP.md](./ROADMAP.md) — plan de implementación por fases.
