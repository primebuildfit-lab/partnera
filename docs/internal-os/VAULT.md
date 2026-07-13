# Partnera Vault — Banco B (fondos de terceros)

> `@partnera/platform-finance` · **dinero simulado**. Custodia real = **gate externo** (proveedor +
> revisión legal + KYC/AML + conciliación + regulación).

## Qué es
Fondos que **Partnera administra temporalmente** y que **no le pertenecen**: depósitos de empresas,
pagos comprometidos/reservados, disputas, garantías, pagos en proceso/devueltos. **No es ingreso** y
**no puede usarse** para gastos de Partnera.

## Eventos (`VaultEvent`)
`vault.deposited` · `vault.committed` (toward) · `vault.reserved` · `vault.disputed` (caseId) ·
`vault.paid_out` (reference) · `vault.refunded` · `vault.released` · `vault.guarantee`.
Cada evento lleva `businessId` (dueño de los fondos).

## Balance derivado (`foldVault`)
```
held      = deposited − paid_out − refunded         (fondos retenidos actualmente)
available = held − committed − reserved − disputed − guarantee   (sin asignar)
```
Un `paid_out` reduce `committed` y `held`. Dinero exacto (bigint).

## Reglas (invariantes)
- El dinero del Vault **no es ingreso** (separado estructuralmente del Banco A).
- **No** se usa para gastos de Partnera.
- Toda transferencia deja **auditoría**; balances **derivados de eventos**.
- Sin ediciones destructivas; correcciones por **eventos compensatorios**.
- Estructuralmente separado de Revenue (ids/streams/folds distintos) → imposible mezclar.

## Simulado (declarado)
En esta fase no se mueve dinero real. La custodia real requiere un proveedor de dinero regulado,
KYC/AML cuando aplique, conciliación y revisión legal (D-050/D-106 upstream).
