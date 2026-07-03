# CFO Virtual — Pachos Supermarket

Sistema para organizar facturas, cheques, proveedores, pagos, cuentas por pagar y flujo de caja de **Pachos Supermarket**, con integración de solo lectura a **TD Bank** vía Plaid.

> Este sistema es exclusivamente para Pachos Supermarket. No incluye RR Importaciones.

## Regla de oro

**El sistema solo informa, organiza, analiza y alerta. Nunca mueve dinero, nunca paga nada, nunca guarda claves bancarias.** Ver el detalle de por qué esto está garantizado a nivel de código en [docs/SECURITY.md](docs/SECURITY.md).

## Qué ve el dueño al abrir el sistema

1. Cuánto dinero tiene (saldo TD Bank + caja) — Dashboard.
2. Cuánto debe (facturas pendientes) — Dashboard / Facturas.
3. Qué facturas vencen pronto — Dashboard / Alertas.
4. Qué cheques siguen pendientes — Dashboard / Cheques.
5. Qué pagos ya salieron del banco — Banco / Conciliación.
6. Qué movimientos no están explicados — Conciliación / Alertas.
7. Si tendrá problemas de flujo de caja en 30 días — Flujo de Caja.

## Despliegue en producción (nube gratuita)

| Servicio | Proveedor | URL |
|---|---|---|
| Frontend | Vercel (free) | https://pachos-cfo-virtual-frontend.vercel.app |
| Backend | Render (free) | https://pachos-cfo-virtual-backend.onrender.com |
| Base de datos | Supabase (free) | proyecto `pachos-cfo-virtual` |
| Código fuente | GitHub | https://github.com/cristian15orozco-prog/pachos-cfo-virtual |

**Nota sobre el plan gratuito de Render**: el backend se "duerme" tras ~15 min sin tráfico; la primera petición después de eso tarda 30-50s en responder mientras despierta. Es aceptable para una herramienta interna de uso esporádico. Auto-deploy está activado: cualquier `git push` a `main` re-despliega el backend automáticamente; el frontend en Vercel también se puede re-desplegar con `cd frontend && vercel deploy --prod --scope pachos`.

**Nota sobre visibilidad del repo**: quedó público temporalmente porque la GitHub App de Render no logró leer el repo privado. No contiene secretos (el `.env` real nunca se subió, solo `.env.example`). Si se quiere volver a privado, verifica primero en GitHub → Settings → Applications → Render que el repo esté marcado en "Repository access", y confirma con un push de prueba que el auto-deploy de Render lo sigue detectando antes de depender de ello.

## Documentación

| Documento | Contenido |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arquitectura completa y stack tecnológico |
| [docs/DATABASE.md](docs/DATABASE.md) | Modelo de datos |
| [docs/API.md](docs/API.md) | Endpoints del backend |
| [docs/SECURITY.md](docs/SECURITY.md) | Reglas de seguridad y por qué el sistema no puede mover dinero |
| [docs/BUSINESS_RULES.md](docs/BUSINESS_RULES.md) | Reglas de negocio, detección automática y catálogo de alertas |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Plan de implementación por fases |

## Estructura del repositorio

```
Agente/
├── backend/          # Node.js + TypeScript + Express + Prisma
│   ├── prisma/        # schema.prisma, seed.ts
│   └── src/
│       ├── config/         # variables de entorno
│       ├── integrations/plaid/  # cliente Plaid, SOLO LECTURA
│       ├── lib/             # prisma client, cifrado de tokens
│       ├── middleware/      # authenticate, requireRole (RBAC), auditLogger
│       ├── modules/         # lógica de negocio por dominio
│       ├── routes/          # endpoints Express
│       └── jobs/            # sincronización diaria (cron)
├── frontend/         # React + TypeScript + Vite + Tailwind
│   └── src/
│       ├── pages/           # Login, Dashboard, Facturas, Cheques, Proveedores,
│       │                    # Banco, Conciliación, Flujo de Caja, Alertas, Reportes, Configuración
│       ├── components/      # layout y UI compartida
│       └── hooks/           # useAuth
└── docs/             # documentación completa (ver tabla arriba)
```

## Cómo correr el proyecto (desarrollo)

Requisitos: Node.js 20+, un proyecto de [Supabase](https://supabase.com) (base de datos PostgreSQL gestionada), cuenta de Plaid (sandbox para desarrollo).

### 0. Crear el proyecto en Supabase

1. Crea un proyecto nuevo en [supabase.com](https://supabase.com) (elige una región cercana, ej. `us-east-1`).
2. Ve a **Project Settings → Database → Connection string**.
3. Copia dos cadenas de conexión:
   - **Connection pooling** (puerto `6543`, modo `Transaction`) → esta es tu `DATABASE_URL`.
   - **Direct connection** (puerto `5432`) → esta es tu `DIRECT_URL` (Prisma la necesita solo para `migrate`).
4. El SQL de este proyecto vive en [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma) — no hay que escribir SQL a mano; Prisma genera y aplica las migraciones directamente sobre el proyecto de Supabase.

```bash
# 1. Base de datos y variables de entorno
cd backend
cp .env.example .env   # completar DATABASE_URL y DIRECT_URL (de Supabase), JWT secrets, TOKEN_ENCRYPTION_KEY, PLAID_*

# 2. Backend
npm install
npm run prisma:migrate     # crea las tablas en el proyecto de Supabase
npm run prisma:seed        # crea roles y usuario Dueño inicial
npm run dev                 # http://localhost:4000

# 3. Frontend (en otra terminal)
cd ../frontend
npm install
npm run dev                 # http://localhost:5173
```

El usuario Dueño inicial se crea con las credenciales de `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` del `.env` (cámbialas después del primer login). Puedes inspeccionar las tablas creadas desde el **Table Editor** de Supabase en cualquier momento.

## Plan de implementación

Ver [docs/ROADMAP.md](docs/ROADMAP.md) para el detalle fase por fase (Fase 0: fundaciones → Fase 6: producción).

## Checklist de seguridad antes de cualquier despliegue

- [ ] `TOKEN_ENCRYPTION_KEY` generada con `openssl rand -hex 32` y guardada en un secret manager, no en el repo.
- [ ] `PLAID_PRODUCTS` solo contiene productos de lectura (`transactions`, `auth`, `balance`, `identity`).
- [ ] Ningún endpoint del backend inicia transferencias, pagos o ACH (ver [docs/SECURITY.md](docs/SECURITY.md) sección 7).
- [ ] HTTPS habilitado en todos los entornos.
- [ ] Backups automáticos de PostgreSQL configurados.
