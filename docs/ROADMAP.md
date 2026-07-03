# Plan de implementación por fases — CFO Virtual Pachos Supermarket

## Fase 0 — Fundaciones (1-2 semanas)
- Repositorio, monorepo (`backend/`, `frontend/`, `docs/`).
- Base de datos PostgreSQL + Prisma, migraciones iniciales (todas las tablas de [DATABASE.md](./DATABASE.md)).
- Auth (login, JWT, bcrypt) + RBAC (roles Dueño/Administrador/Contador/Empleado).
- Middleware de auditoría (`audit_logs`) aplicado desde el día 1.
- CI básico (lint, typecheck, tests).

## Fase 1 — Núcleo contable (2-3 semanas)
- CRUD de Proveedores.
- CRUD de Facturas + adjuntos (attachments) + categorías de gasto.
- CRUD de Cheques (registro manual).
- Motor de detección: duplicados, sin comprobante, vencidas.
- Pantallas: Login, Dashboard (versión básica), Facturas, Cheques, Proveedores.

## Fase 2 — Integración bancaria de solo lectura (2 semanas)
- Alta de cuenta Plaid (sandbox) → producción con TD Bank.
- `bank/link-token`, `bank/exchange-public-token`, cifrado de `access_token`.
- Job de sincronización (`transactions/sync`, `balance/get`).
- Pantalla "Banco TD Bank": saldo, movimientos.
- Auditoría de cada sync.

## Fase 3 — Conciliación y flujo de caja (2-3 semanas)
- Motor de conciliación (cheques ↔ transacciones, facturas ↔ pagos).
- Pantalla de Conciliación con estados matched/unmatched/flagged.
- Cálculo de flujo de caja (7/15/30 días) + snapshots diarios.
- Pantalla de Flujo de Caja con alertas de saldo negativo proyectado.

## Fase 4 — Alertas, reportes y CFO virtual (2 semanas)
- Motor de alertas completo (catálogo de [BUSINESS_RULES.md](./BUSINESS_RULES.md)).
- Pantalla de Alertas.
- Reporte diario automático (job + endpoint + vista/])
- `CfoAdvisorService` con recomendaciones basadas en reglas.
- Dashboard del dueño completo (todas las métricas).

## Fase 5 — Roles, configuración y hardening (1-2 semanas)
- Pantalla de Configuración (gestión de usuarios, permisos, `employee_can_view_balances`).
- Revisión de seguridad completa contra el checklist de [SECURITY.md](./SECURITY.md).
- Pruebas de penetración ligeras / revisión de dependencias.
- Backups automáticos de base de datos, plan de recuperación.

## Fase 6 — Pulido y producción (1-2 semanas)
- Exportables (PDF/Excel) de reportes.
- Notificaciones (email/SMS/push) para alertas críticas.
- Observabilidad (Sentry, logs estructurados, métricas).
- Despliegue a producción, dominio, TLS, monitoreo.

## Fuera de alcance (explícitamente, por decisión del dueño)
- Cualquier capacidad de pago, transferencia, ACH o emisión de cheques.
- Integración con RR Importaciones u otro negocio — este sistema es exclusivo de Pachos Supermarket.
- Guardar credenciales de TD Bank.
