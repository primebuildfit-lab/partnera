# Partnera Internal OS

> El **panel privado de plataforma** para Brian/operadores. **No** es el dashboard de empresas, ni
> el portal de creadores/afiliados. Separación **total** (rutas/layout/permisos/sesión/servicios):
> solo operadores de plataforma; cualquier usuario business/creator/affiliate recibe **403**.

## Estado (honesto)
Esta fase entrega el **núcleo** del Internal OS, verde y probado localmente:
- **Separación total** (`scope: "internal"`, guard deny-by-default, layout dark propio) — probado
  (operador ve el home; business/creator/afiliado → 403; sin fuga de datos).
- **Doble libro financiero** Revenue (Banco A) + Vault (Banco B), append-only, balances derivados,
  **nunca mezclados** (`@partnera/platform-finance`) — 5 tests de motor + páginas.
- **Home operativo** (§6): empresas, usuarios desglosados, órdenes de contenido, Ingresos Partnera,
  Vault, alertas + separación contable.
- **Páginas**: Home, Ingresos (Banco A), Vault (Banco B), Empresas, Salud del sistema, Alertas.

**Andamiado / diferido** (ruta placeholder, iteración siguiente): historial global, Eventra,
analítica avanzada, planes/membresías editor, integraciones, IA & modelos, automatizaciones,
content workspaces, impersonation, command palette, ajustes detallados. Ver
[PHASE8_REPORT.md](PHASE8_REPORT.md) para la tabla de estado por criterio.

## Docs
- [FINANCIAL_MODEL.md](FINANCIAL_MODEL.md) — Banco A (Revenue), cierre mensual.
- [VAULT.md](VAULT.md) — Banco B (fondos de terceros), reglas de custodia.
- [PHASE8_REPORT.md](PHASE8_REPORT.md) — reporte + tabla de aceptación.

## Identidad visual
Dark, sidebar por grupos, topbar, acento violeta, alta densidad — **identidad propia de Partnera**.
La inspiración de Shopify se limita a organización/claridad/eficiencia; **no** se copia código,
componentes, iconografía ni marca.

## Seguridad
Deny-by-default; el `tenantId`/actor nunca viene del navegador; el `PlatformService` exige
`isPlatformOperator` (o `platform.manage`) en cada método. Auth interna propia (independiente de
Nexus, que será integración futura).

## No conectado / simulado (declarado)
Dinero (Revenue/Vault) **simulado** — custodia real requiere proveedor + revisión legal + KYC/AML +
conciliación. Postgres alojado, Shopify, IA real, almacenamiento externo, Eventra: **no conectados**.
