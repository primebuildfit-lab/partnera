# Partnera — Reporte General de Estado (solo lectura)

> **Fecha:** 2026-07-13 · **Rama:** `feat/creator-marketplace` (no fusionada a `main`) ·
> **Baseline verificado:** `pnpm verify` = 19 paquetes, **210 tests en verde**, typecheck + lint +
> build OK. **Este documento no modifica código.** Cuando la documentación y el código difieren,
> **el código es la fuente de verdad** y la discrepancia se marca como ⚠️.

## Resumen ejecutivo (1 párrafo)

Partnera es un monorepo TypeScript **domain-first, multi-tenant**, con dominio puro
(engines) + persistencia + servicios de aplicación + UI SSR. El **núcleo de afiliados** y el
**Creator Marketplace** (categorías/pagos configurables por empresa, capacidad/presupuesto, colas
de espera, revisión humana + IA advisory *mock*, pagos **simulados**, biblioteca de contenido,
desbloqueo por rango, comisión de plataforma persistida, backup/restore) están **implementados y
usables localmente**. Se añadió un **adaptador Shopify puro** (HMAC, ciclo de instalación,
webhooks idempotentes, onboarding, provisión idempotente de tenant) probado localmente. **Todo
corre sobre un store relacional en memoria + archivo JSON local**; **no hay base de datos alojada,
ni dinero real, ni IA real, ni instalación Shopify real, ni deploy**. Los tres mayores huecos
frente a la nueva visión son: (1) **el modelo Prisma canónico está desactualizado** y no cubre las
tablas nuevas; (2) **no existe motor financiero con wallet/escrow/depósitos/liberación
automática**; (3) **no hay UI embebida de Shopify ni persistencia alojada**.

---

# 1. Estado general del proyecto

**Estado actual.**
- **Fase:** producto **local funcional** + **adaptador Shopify listo para instalar** (no instalado).
- **Último módulo terminado:** *Shopify Pilot — adaptador* (paquete `@partnera/shopify` +
  `InstallationService`/`WebhookService`/`OnboardingService`, con aislamiento cross-shop probado).
- **Último módulo parcialmente desarrollado:** la **instalación real en Shopify** (código completo
  y probado localmente; falta la parte externa: app de Partner, hosting/DB, deploy, consentimiento).
- **Pendiente:** DB alojada (Postgres/Prisma real), UI embebida Shopify + App Bridge, extensión de
  tema, handlers de app-proxy, motor financiero (wallet/escrow), IA real, providers de storage,
  billing real. Ver §14 y §16.

**Dependencias entre módulos.** `core` (kernel) ← todos. Cada engine depende **solo** de `core`.
`persistence` agrega tipos de todos los engines. `application` orquesta engines sobre repos.
`web` consume **solo** `application`. `shopify` depende solo de `core` y es consumido por
`persistence`/`application`. Grafo acíclico.

**Clasificación de madurez (evidencia: código):**

| Parte | Estado |
|---|---|
| Afiliados: offers, tracking, atribución, comisiones (ledger append-only), fraude | ✅ Implementado (en memoria) |
| Creator Marketplace: programas/categorías/pagos/capacidad/presupuesto/colas/revisión/biblioteca/rangos | ✅ Implementado (en memoria) |
| Pagos (creador y afiliado) | 🧪 **Simulado** (sin rail real) |
| Adaptador Shopify (HMAC, install, webhooks, onboarding) | ✅ Implementado, **sin red/credenciales** |
| Persistencia local (JSON + backup/restore) | ✅ Listo local |
| Base de datos alojada (Postgres/Prisma) | ⛔ **No existe impl.**; solo artefactos de esquema (desactualizados) |
| IA de evaluación | 🧪 **Mock determinista** |
| UI embebida Shopify / extensión de tema / app-proxy handlers | ⛔ **No existe** (diseño en `docs/shopify-pilot/`) |
| Motor financiero (wallet/escrow/depósitos/liberación auto) | ⛔ **No existe** |
| Providers de storage (Drive/OneDrive/S3…) | ⛔ Solo contrato; "not_connected" |
| Billing real | ⛔ Solo contrato test-mode |
| Auth real (login/OAuth/MFA) | ⛔ Solo `DevAuthProvider` (sin credenciales) |

**Prioridad de la sección:** N/A (panorama).

---

# 2. Arquitectura

**Estado actual.** Arquitectura **por capas, domain-first, framework-agnóstica** (D-201):

```
UI (@partnera/web, React SSR)  ──> solo consume Application
Delivery (@partnera/http-api)  ──> router sin framework (host = deploy)
Application (@partnera/application) ──> servicios permission-aware (tenancy, authz, idempotencia, audit)
Persistence (@partnera/persistence) ──> repos + RelationalStore (append-only, unique, versión, tx, tenant)
Domain / Engines ──> offer, tracking, commission, payment, fraud, notification, extension, analytics,
                      creator-marketplace, shopify, auth, platform  (cada uno depende solo de core)
Kernel (@partnera/core) ──> Money(bigint), Result, ids branded, tenancy, Clock, EventBus, errores
UI design system (@partnera/ui)  (aislado del dominio)
```

**Organización / carpetas.** Monorepo pnpm + Turborepo. 19 paquetes en `packages/*`. Docs en
`docs/` (00–24 + `PROJECT_CONTEXT`), `docs/creator-marketplace/` (39), `docs/shopify-pilot/` (11).
Scripts de arranque local en `scripts/`.

- **Backend (lógico):** engines puros + `application` (casos de uso) + `http-api` (adaptador HTTP,
  sin host productivo). **No hay NestJS/servidor productivo**; el host local es `packages/web/src/server.ts` (node `http`).
- **Frontend:** `@partnera/web` — React renderizado a HTML estático (`react-dom/server`, **sin
  bundler/hydration** para la app; `esbuild` solo empaqueta el server local). Progressive
  enhancement, funciona sin JS.
- **Base de datos:** **store relacional en memoria** (`RelationalStore`/`Collection`) + snapshot a
  `./.partnera/data.json`. Modelo Prisma **canónico solo como artefacto** y **desactualizado** (§5).
- **Servicios:** 14 servicios de aplicación (§4). **Repositorios:** por dominio + `UnitOfWork`.
  **Casos de uso:** métodos de los servicios. **Entidades:** tipos por engine.
  **Eventos:** `EventBus` en memoria (`InMemoryEventBus`) + nombres versionados por dominio.
  **Integraciones:** adaptador Shopify (sin red). **Configuración:** feature flags + config repo.

**¿Sigue siendo modular multi-tenant?** **Sí.** Cada registro operativo lleva `tenantId`; el
tenant se resuelve del contexto autenticado (o, en Shopify, del **shop verificado**), nunca del
input del navegador. Aislamiento probado (tests cross-tenant y cross-shop).

**Riesgos.** (a) El **host productivo** (NestJS/Next) no existe: `http-api` es un router aislado.
(b) La UI no tiene capa cliente (SPA/embebida) — bloquea Shopify embebido.
**Recomendación:** activar el seam de host + DB antes de crecer en features. **Prioridad: Alta.**

---

# 3. Estado del Frontend

**Estado actual.** SSR real sobre servicios reales (no maquetas): **5 módulos de página**
(`business.tsx`, `creator.tsx`, `affiliate.tsx`, `admin.tsx`, `login.tsx`), shell responsive
(sidebar desktop / `<details>` móvil), **52 rutas de navegación**, **28 handlers POST** (flujos
reales), accesible (skip link, landmarks, `aria-current`, labels), confirmaciones no-JS para
acciones de dinero.

**Pantallas que funcionan (datos reales):**
- **Business:** Overview, Analytics, Offers (+detalle/versiones), Campaigns, Tracking, Conversions,
  Commissions, Balances, Fraud, Notifications, Settings, Audit, Company; **Creators:** Overview
  (+ checklist de primer uso), Setup guide (wizard 10 pasos), Programa (esquema/categorías→pago,
  presupuesto, capacidad, **tarifa editable**), Opportunities, Reviews (2 scores IA + selector de
  categoría + desglose fee/neto), Waiting Queue, Payments (desglose simulado + confirmación),
  Content Library, Pilot checklist (persistido).
- **Creator Portal:** Home, Find companies, My Work, Earnings, Profile.
- **Affiliate:** Home/Performance, Links, Coupons, earnings (Pending/Approved/Paid/History/Payouts),
  Content Library (por rango).
- **Admin:** Overview, Health, **Data status** (`/admin/data`: modo, archivo, conteos, integridad),
  Logs, Organizations, Users, Permissions, Offers, Tracking, Fraud, Flags, Configuration, Audit.

**Solo visuales / faltantes.**
- ⛔ **UI embebida de Shopify (App Bridge, session-token)** — no existe.
- ⛔ **Páginas públicas hospedadas branded** por empresa (page-builder) — diseñadas, no implementadas.
- 🟡 Biblioteca de contenido de negocio sin grid/filtros/edición de metadata (datos sí soportan).
- 🟡 Consolas admin de canales promocionales y de planes (datos/semilla existen; pantallas mínimas).

**Componentes reutilizables:** `@partnera/ui` (Button, Input, Field, Card, Alert, Badge, Tag,
Table+Column, Dialog, Drawer, EmptyState, Spinner, Progress, tokens claro/oscuro) + `components.tsx`
(PageHeader, StatTile, StatusBadge, DefinitionList, PermissionGate, BarChart, **ConfirmButton**).

**Riesgos.** Sin hydration/cliente no hay experiencia embebida Shopify. **Recomendación:** definir
la estrategia de host + capa cliente (Next/App Bridge) como parte del deploy. **Prioridad: Alta.**

---

# 4. Estado del Backend

**Estado actual.** 14 servicios de aplicación (todos permission-aware, tenant desde contexto,
auditados):

| Servicio | Rol | Estado |
|---|---|---|
| `OrganizationService` | orgs/negocios/miembros | ✅ |
| `OfferService` | ofertas + versiones | ✅ |
| `TrackingService` | touch→order→atribución→conversión (spine) | ✅ |
| `LedgerService` | comisiones (ledger append-only) | ✅ |
| `PaymentService` | payouts (rail abstracta, **sin provider**) | 🧪 |
| `FraudService` | señales/casos | ✅ |
| `NotificationService` | notificaciones | ✅ |
| `ConfigurationService` / `AuditService` | config + auditoría | ✅ |
| `QueryService` | lecturas permission-gated para UI | ✅ |
| `CreatorService` | **muy grande**: perfiles, programas, esquemas, categorías→pago, capacidad, presupuesto, exposición, recomendación IA, `reviewWithScheme`, disposiciones, colas, pagos simulados, biblioteca, rangos, tarifa, checklist, integridad | ✅ (dinero 🧪) |
| `InstallationService` | install→tenant idempotente | ✅ |
| `WebhookService` | webhooks idempotentes + dead-letter | ✅ |
| `OnboardingService` | onboarding persistido | ✅ |

- **APIs/Endpoints:** `@partnera/http-api` mapea servicios→router (`buildApiRouter`) con
  `DomainError`→HTTP. **No hay host HTTP productivo**; el server local (`web/src/server.ts`) enruta
  por path a `handle()`. Endpoints Shopify (OAuth callback, webhooks, app-proxy) **aún no expuestos
  como rutas HTTP** — la lógica (verificación/servicios) existe y está probada; falta el adaptador
  de entrega.
- **Middleware/Guards/Validaciones:** `ServiceBase` centraliza principal + `require(permission)` +
  audit; validación por engine (Result/ValidationError). `protectRoute`/`WebSession` en web.
- **Eventos:** `EventBus` en memoria + nombres versionados (creator/shopify).
- **Placeholders reales:** `DevAuthProvider` (auth), `UnconfiguredPayoutRail`/`DemoRail` (payout),
  `DeterministicMockReviewer` (IA), storage/billing "not connected".

**Riesgos.** Sin host HTTP productivo ni endpoints Shopify montados, el backend no responde a
Shopify todavía. **Recomendación:** montar host + rutas OAuth/webhook/proxy sobre los servicios ya
probados. **Prioridad: Alta.**

---

# 5. Base de datos

**Estado actual.** Dos "realidades":
1. **Store relacional en memoria (fuente de verdad en runtime):** **58 colecciones** definidas en
   `UnitOfWork` con: append-only donde aplica, índices `unique` (idempotencia), `version`
   (concurrencia optimista), transacciones snapshot/rollback, scoping por tenant. Persistencia
   durable a `./.partnera/data.json` (serializador Date/Money) + backup/restore.
2. **Modelo Prisma canónico (artefacto, NO ejecutado):** `packages/persistence/prisma/schema.prisma`
   + `sql/0001_init.sql`.

**⚠️ INCONSISTENCIA CRÍTICA (código = verdad).** El Prisma canónico tiene **30 modelos**
(Organization, Business, User, Role, Membership, Offer, OfferVersion, TrackingLink, Coupon,
TrackingSession, Click, CouponUse, Order, Conversion, Refund, LedgerEvent, PayoutEvent,
BalanceSnapshot, FraudSignal/Score/Case, Notification/DeliveryRecord/Preference/Template, Extension,
ConfigValue, AuditLog, IdempotencyKey) — **solo el núcleo de afiliados**. **NO incluye** ninguna de
las **~28 tablas de Creator Marketplace** (evaluation_schemes, program_capacities, program_budgets,
program_fee_settings, content_opportunities, deliverable_requirements, creator_applications,
submissions, submission_versions, submission_reviews, submission_dispositions, content_assets,
content_licenses, rank_unlock_rules, creator_payments, creator_ledger_events, creator_disputes,
pilot_checklists, business_plans, business_trials, promotional_channels, promoted_placements…) ni
las **5 tablas Shopify** (shopify_installations, shopify_sessions, webhook_events, onboarding_states,
storage_connections). Evidencia: `grep -c` sobre el schema = **0** coincidencias creator/shopify.

**Índices/restricciones/migraciones/seed.** En memoria: sí (unique/append-only/version).
Migraciones reales: solo `0001_init.sql` (afiliados). Seed: `createDemoWorld()`/`createLocalWorld()`
a través de servicios reales (mundo PrimeBuild).

**¿Tablas a modificar antes de seguir?** **Sí, es el bloqueo #1:** el modelo canónico debe
**extenderse** para cubrir las 33 tablas nuevas + implementar un store Prisma real detrás de los
mismos ports (contract tests idénticos). Hasta entonces, "persistencia alojada" no existe.

**Riesgos.** Alto: la doc afirma "modelo DB canónico autorizado / activación mecánica", pero el
modelo no cubre ~57% de las colecciones actuales. **Recomendación:** regenerar el schema Prisma
desde `UnitOfWork` + escribir el driver Postgres. **Prioridad: Alta.**

---

# 6. Sistema financiero

**Estado actual (código = verdad).** Existe:
- **Ledger de comisiones de afiliado append-only** (`commission-engine`): eventos inmutables,
  balances **derivados** (pending/available/paid/reversed), reversas como compensación. ✅ (en memoria)
- **Stream append-only de pagos a creador** (`creator-marketplace/money.ts`): `payment.authorized →
  fee.recognized → processing → paid`, con `computeFee` (bps exactos), balances derivados,
  `platform_fee.reversed`. 🧪 **simulado** (sin dinero real).
- **Comisión de plataforma (fee) 2–4%** persistida y editable por programa (`program_fee_settings`),
  con **snapshot inmutable** al aceptar términos.
- **Presupuesto por programa** con campo **`reservedMinor`** (reserva) + exposición derivada
  (committed/paid/remaining/fee proyectado).
- **Payout engine** (`payment-engine`): stream de eventos + `PayoutRail` **abstracta** —
  solo `UnconfiguredPayoutRail`/`DemoRail`; **ningún provider real**.

**NO existe (buscado explícitamente en código):**
- ⛔ **Wallet / balance de empresa** (billetera con fondos depositados).
- ⛔ **Escrow** (retención en custodia).
- ⛔ **Depósitos / depósitos de garantía dinámicos** por antigüedad/reputación.
- ⛔ **Liberación automática de pagos** (solo hay separación de deberes manual approve≠authorize≠execute).
- ⛔ **Historial financiero unificado empresa** (hay ledger afiliado + stream creador **separados**).

**Riesgos.** La nueva visión ("motor financiero automático, escrow, depósitos dinámicos, liberación
automática") es **un módulo nuevo completo**, hoy inexistente. Además Partnera es **no-custodial**
por decisión provisional (D-050) — escrow/custodia toca regulación (gated por consejo legal, D-106).
**Recomendación:** diseñar el "Financial Engine" como engine nuevo sobre el ledger append-only
existente; mantener no-custodial hasta consejo legal. **Prioridad: Alta** (para la nueva visión).

---

# 7. Sistema de afiliados

**Estado actual.** ✅ **Implementado (en memoria) end-to-end:** identidad/tenancy/RBAC, ofertas
(bloques configurables + versionado + simulación), tracking (links/coupons, atribución
last/first-touch, ventana, precedencia, ingesta idempotente de orden), **ledger de comisiones
append-only** (estados, clawback/reversa, balances derivados), payouts **simulados** con separación
de deberes, fraude (señales/score/bandas/casos/floors). UI: Affiliate Portal + Business Dashboard.

**Qué falta / solo documentado:** rails de pago reales (D-105), adaptador de comercio real
(Shopify ingesta `NormalizedOrder` — la lógica existe, falta la entrega/red), partnerships B2B (solo
documentado, docs/09), server-side tracking. **Prioridad: Media.**

---

# 8. Marketplace

**Estado actual (Creator Marketplace, ✅ implementado en memoria).** Existen como registros
persistidos y flujos reales:
- **Empresas** (tenants) · **Afiliados** · **Creadores** (actor con relación por empresa) ·
  **Campañas** (`content_campaigns`) · **Oportunidades** (`content_opportunities` + deliverables) ·
  **Solicitudes** (`creator_applications` con snapshot de fee) · **Material multimedia**
  (`submissions`/`submission_versions` — **metadata demo**, sin binarios) · reseñas, disposiciones,
  pagos simulados, biblioteca (`content_assets`+licencias), desbloqueo por rango.
- "Marketplace de descubrimiento" público/hospedado y páginas branded por empresa: **diseñados, no
  implementados**.

**Riesgos.** El material multimedia es solo metadata (sin storage real). **Prioridad: Media.**

---

# 9. Sistema de almacenamiento

**Estado actual.** **Capa de conectores provider-independent (contrato) implementada** en
`@partnera/shopify/storage.ts`: `StorageProvider` = `["none","google_drive","onedrive","dropbox",
"s3","manual_link","partnera_sync"]`, `StorageConnection` (estado `not_connected` por defecto),
plantilla de carpetas (incoming/review/waiting/approved/affiliate_library/internal/archive),
`FileReference` (metadata, `demo:true`).

- ¿Abstracto? **Sí.** ¿Multi-provider? **Sí, por diseño.** ¿Depende de un único servicio hoy?
  **No depende de ninguno** — **ningún provider está implementado/conectado**; todo es metadata/mock.

**Riesgos.** No se pueden manejar binarios reales aún. **Recomendación:** implementar 1 provider
(p. ej. S3-compatible o Drive) detrás del contrato cuando se autorice. **Prioridad: Media.**

---

# 10. IA

**Estado actual.** **Solo mock determinista.** `@partnera/creator-marketplace/ai.ts` exporta:
`AIReviewer` (interfaz), `DeterministicMockReviewer`, `mockTwoScoreReview` (score técnico +
comercial + categoría recomendada + confianza), `mayAutoApprove` (límites de auto-aprobación).
`authorizesPayment:false` **siempre**.

- ¿Evaluación IA? **Sí, mock.** ¿Configuración IA? **Parcial** — la empresa configura su **esquema
  de categorías→pago** y `approvalMode`, pero **no** hay configuración de proveedor/modelo/prompt.
- ¿Prompts / proveedores / modelos? **No existen** (0 referencias a openai/anthropic/gemini/prompt).

**Riesgos.** La nueva visión "IA configurable por empresa" requiere: proveedor por tenant, prompts,
modelos, y contrato de proveedor real (hoy inexistente). **Recomendación:** definir `AIProvider`
port + config por empresa; mantener mock por defecto. **Prioridad: Media/Alta** (según visión).

---

# 11. Integraciones

**Estado actual.**

| Integración | Estado | Evidencia |
|---|---|---|
| **Shopify** | 🟡 Adaptador puro **sin red/credenciales** | `@partnera/shopify` (HMAC/install/webhooks/onboarding); **sin app real, sin OAuth de red, sin instalar** |
| **Webhooks** | ✅ Lógica (HMAC+idempotencia+dead-letter) probada; ⛔ endpoint HTTP no montado | `webhooks.ts`, `WebhookService` |
| **OAuth** | 🟡 Verificación HMAC de callback ✅; ⛔ intercambio de token (red) no impl. | `verifyOAuthHmac` |
| **Google Drive / OneDrive / Dropbox / S3** | ⛔ Solo enumerados en contrato de storage | `storage.ts` |
| **AWS / Cloudflare** | ⛔ No existen | — |
| **Stripe / PayPal / Wise** | ⛔ Solo mencionados como rails futuros (abstracción) | `payment-engine/rail.ts` |
| **Partnera Sync** | ⛔ Solo nombre en enum de storage | `storage.ts` |
| **Auth provider real** | ⛔ Solo `DevAuthProvider` | `web/src/auth.ts` |

**Conclusión:** **ninguna integración externa está conectada.** Todo es adaptador/contrato/mock.
**Prioridad: Alta** (Shopify real es el objetivo inmediato — §17).

---

# 12. Seguridad

**Estado actual.** ✅ Sólida a nivel dominio/aplicación:
- **Autenticación:** modelo de sesión + `DevAuthProvider` (sin provider real; OAuth/MFA/SSO son seams).
- **Autorización:** RBAC data-driven (`@partnera/auth`): catálogo de permisos, 10 roles de sistema,
  wildcards, **deny-by-default** `PermissionEngine`; `ServiceBase.require()`.
- **Roles/permisos:** plantillas de sistema + roles custom por tenant.
- **Multiempresa / aislamiento:** cada registro con `tenantId`; tenant desde contexto (o shop
  **verificado** en Shopify). Probado: tests cross-tenant y **cross-shop**; provisión idempotente;
  webhooks idempotentes; HMAC constante y con secreto inyectado; **tokens nunca en claro/al navegador**
  (solo `tokenRef`); `validateEnvironment` rechaza config insegura/mixta.

**Faltante para producción (documentado en `docs/shopify-pilot/SECURITY.md`):** verificación de
session-token App Bridge en cada request embebido, CSRF/state en OAuth, rate limiting en
proxy/webhook, cifrado de token en reposo, honrar `customers/redact`. **Sin provider de login real.**

**Riesgos.** El endurecimiento de la capa de entrega no se ha ejercido contra un host. **Prioridad:
Media** (bloqueante solo al desplegar).

---

# 13. Estado de la documentación

**Estado actual.** Muy extensa: **raíz** (README, PROJECT_CONTEXT, ARCHITECTURE, ROADMAP, DECISIONS,
BUILD_STATUS, CHANGELOG, TECHNICAL_HANDOFF, INSTALL, TESTING, CONTRIBUTING), **`docs/`** (00–24 +
PROJECT_CONTEXT), **`docs/creator-marketplace/`** (39 docs), **`docs/shopify-pilot/`** (11 docs).

| Documento | Estado |
|---|---|
| PROJECT_CONTEXT / BUILD_STATUS / CHANGELOG / DECISIONS / ROADMAP / TECHNICAL_HANDOFF | ✅ Actualizados a 2026-07-13 (incluyen Shopify pilot) |
| ARCHITECTURE.md | 🟡 Actualizado a MM4; menciona shopify en seam pero no las capas nuevas |
| docs/creator-marketplace/* (FINAL_CERTIFICATION, IMPLEMENTATION_STATUS, PRIMEBUILD_PILOT_DATA_STATUS…) | ✅ Actualizados |
| docs/shopify-pilot/* (11) | ✅ Nuevos, honestos (marcan external gates) |
| **docs/23-persistence.md / docs/03-data-model.md** | ⚠️ **Desactualizados**: describen el modelo de datos **solo afiliados**; no cubren creator/shopify |
| **prisma/schema.prisma** (artefacto) | ⚠️ **Desactualizado** (ver §5) |
| docs/22-engineering.md | ⚠️ Drift conocido D-100 vs D-200 (ya anotado en PROJECT_CONTEXT §5) |

**Recomendación:** marcar `docs/03` y `docs/23` como "solo núcleo afiliados" y remitir a
`docs/creator-marketplace/DATA_MODEL.md` para lo nuevo. **Prioridad: Media.**

---

# 14. Deuda técnica

**Evidencia:** `grep TODO|FIXME|HACK|XXX` en `src` = **0** (no hay marcadores en código; el pendiente
vive en docs). Deuda real (por inspección):

| # | Deuda | Prioridad |
|---|---|---|
| DT-1 | **Modelo Prisma canónico desactualizado** (no cubre 33 tablas creator/shopify) + **sin driver Postgres real** | **Alta** |
| DT-2 | **Sin host HTTP productivo** ni endpoints Shopify montados (OAuth/webhook/proxy) | **Alta** |
| DT-3 | **Sin UI cliente/embebida** (react-dom/server estático; no App Bridge) | **Alta** |
| DT-4 | **Dinero simulado** en todo (creator + afiliado); rails vacías | Alta (según visión) |
| DT-5 | **IA solo mock**; sin provider/prompt/config por empresa | Media |
| DT-6 | **Storage sin provider**; binarios no soportados | Media |
| DT-7 | Offer engine: cálculos `level`/`bonus` y límites por periodo/presupuesto retornan error explícito (modelados, no completos) | Media |
| DT-8 | Balances por *fold* completo (sin snapshots materializados a escala) | Media |
| DT-9 | `CreatorService` es muy grande (god-service) — candidato a dividir | Baja |
| DT-10 | `Flash`/`PostButton` duplicados entre páginas | Baja |
| DT-11 | Doc drift: `docs/03`, `docs/23`, `docs/22` (D-100), Prisma | Media |
| DT-12 | Auth real ausente (`DevAuthProvider`); sin sesiones firmadas reales | Alta (deploy) |
| DT-13 | Rama `feat/creator-marketplace` **no fusionada** ni respaldada (sin remoto) | Media |

---

# 15. Próximo paso recomendado

**Recomendación (justificación, sin desarrollar):** el siguiente módulo debe ser
**"Persistencia Alojada + Host de Entrega" (Infra de activación)**, en este orden:

1. **Regenerar el esquema Prisma** para cubrir las 58 colecciones (DT-1) e **implementar el store
   Postgres/Prisma** detrás de los `Collection`/`UnitOfWork` ports existentes (mismos contract tests).
2. **Montar el host HTTP** (Next/NestJS) sobre `application`/`web`, exponiendo **rutas Shopify**
   (OAuth callback, webhooks, app-proxy) que ya tienen lógica probada (DT-2).
3. **Proveedor de auth real** que construya `RequestContext` desde la sesión verificada (DT-12).

**Por qué primero:** (a) es el **cuello de botella** común a TODO lo demás — sin DB alojada + host,
no hay instalación Shopify real, ni pruebas físicas, ni motor financiero, ni storage, ni IA real;
(b) **no añade features nuevas riesgosas**: reutiliza los servicios ya probados (210 tests) detrás
de los mismos ports; (c) desbloquea directamente el **objetivo inmediato** (§17: app física
funcional instalada en Shopify como app privada/dev). Todo lo demás (motor financiero, IA real,
storage) se apoya sobre esta base.

---

# 16. Comparación con la nueva visión

| Capacidad de la nueva visión | ¿Soportado hoy? | Acción |
|---|---|---|
| **Empresa:** crear campañas, solicitar contenido, gestionar presupuesto, métricas | ✅ (campañas/oportunidades/presupuesto/exposición/analítica) | Ampliar UI |
| **Empresa:** subir contenido propio | 🟡 metadata; sin storage real | Implementar provider |
| **Empresa:** configurar IA propia | ⛔ solo categorías/`approvalMode` | **Nuevo:** `AIProvider` + config por tenant |
| **Empresa:** depositar fondos | ⛔ no existe wallet/depósito | **Nuevo:** Financial Engine |
| **Creador:** aceptar trabajos, descargar material, subir videos, evaluación IA, aprobación, cobro | 🟡/🧪 flujo existe; descarga real y cobro real faltan; IA mock | Storage real + rails + IA real |
| **Creador:** cobrar **automáticamente** | ⛔ pago **manual simulado** (approve≠authorize≠execute) | **Nuevo:** liberación automática |
| **Afiliado:** registrarse, enlaces, compartir, métricas, conversiones, **pagos automáticos** | ✅ tracking/comisiones; ⛔ pago automático real | Rails + automatización |
| **Motor financiero automático** | ⛔ no existe | **Nuevo módulo** (Alta) |
| **Escrow / depósitos de garantía dinámicos (antigüedad/reputación)** | ⛔ no existe (solo `reservedMinor`); no-custodial por D-050 | **Nuevo** + revisión legal |
| **Liberación automática de pagos** | ⛔ no existe | **Nuevo** |
| **IA configurable por empresa** | ⛔ (mock) | **Nuevo** |
| **Múltiples providers de storage** | 🟡 contrato listo, sin impl | Implementar 1+ |
| **Integraciones opcionales** | 🟡 contratos; nada conectado | Según roadmap |
| **Multi-tenant completo** | ✅ | Mantener |
| **Automatización máxima (sin admin manual)** | 🟡 parcial (jobs contrato; hoy flujos manuales) | Job engine + automatización |

**Ya soporta la visión:** tenancy multiempresa, RBAC, ledger append-only, categorías/pagos/
capacidad/presupuesto configurables por empresa, tracking/comisiones de afiliado, fee transparente,
contratos de storage/jobs/billing/IA (puertos), adaptador Shopify.
**Debe rediseñarse/ampliarse:** **motor financiero (wallet/escrow/depósitos/liberación auto)**,
**IA real por empresa**, **storage real**, **persistencia alojada + host**, **UI embebida Shopify**,
**automatización por jobs**.

**Prioridad general:** Alta para infra+financiero; Media para IA/storage.

---

# 17. Objetivo final inmediato

**Objetivo:** una **versión física funcional** con la nueva arquitectura, **instalada en Shopify
como app privada/dev**, lista para pruebas reales (no lanzamiento).

**Camino más limpio y mantenible (orden recomendado, sin desarrollar aún):**
1. **DB alojada + driver Prisma** (cubrir las 58 colecciones) — DT-1. *[requiere: proveedor DB — externo]*
2. **Host + rutas Shopify** (OAuth/webhook/app-proxy) sobre servicios probados — DT-2.
3. **Auth real** (sesión → `RequestContext`) — DT-12.
4. **App embebida mínima** (App Bridge/session-token) para el dashboard de negocio — DT-3.
5. **Instalar en un dev store clon** vía el flujo idempotente ya probado (`InstallationService`).
6. **Migrar el pilot PrimeBuild** al tenant alojado (idempotente, ya diseñado en
   `docs/shopify-pilot/TENANT_MIGRATION.md`).
7. *(Después)* Financial Engine, IA real, storage real, automatización por jobs.

**Gates externos (requieren a Brian):** cuenta Shopify Partner + app + secretos, hosting + DB, DNS,
consentimiento de deploy/instalación. Ver `docs/shopify-pilot/PRIMEBUILD_INSTALLATION.md`.

---

## Anexo — Inconsistencias documentación vs código (código = verdad)

1. ⚠️ **Prisma/`docs/23`/`docs/03` afirman un "modelo DB canónico" pero solo cubren afiliados**; el
   runtime tiene 58 colecciones (creator + shopify no están en Prisma). → Regenerar (DT-1).
2. ⚠️ Docs hablan de "persistencia alojada / activación mecánica"; **no existe driver DB** — todo es
   memoria + JSON.
3. ⚠️ Certificaciones dicen "READY FOR REAL-WORLD LOCAL PILOT" / "adapter installation-ready" — **correcto
   y honesto**, pero **no** equivale a instalado/hospedado; el reporte lo confirma.
4. ⚠️ `docs/22-engineering.md`: IDs D-100 citados como decididos (son abiertos; los reales son
   D-200+). Cosmético.
5. ✅ El resto de docs (creator-marketplace, shopify-pilot, PROJECT_CONTEXT, BUILD_STATUS, DECISIONS,
   CHANGELOG) están **alineados con el código** a 2026-07-13.

*(Reporte generado por inspección de solo lectura. No se modificó código.)*
