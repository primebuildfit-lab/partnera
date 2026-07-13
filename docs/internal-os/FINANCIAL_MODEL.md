# Modelo financiero — Banco A (Partnera Revenue)

> `@partnera/platform-finance` · **dinero simulado** en esta fase.

## Banco A — Partnera Revenue Account
Dinero que **Partnera posee** (membresías, tarifas de plataforma, comisiones propias, servicios,
tarifas de transferencia, integraciones). Stream **append-only**; balance **derivado**; correcciones
por **eventos compensatorios** (refund/reversal), nunca ediciones.

### Eventos (`RevenueEvent`)
`revenue.recognized` (source) · `revenue.refunded` · `revenue.reversed` · `revenue.reserved` ·
`revenue.released` · `revenue.withdrawn`.

### Balance derivado (`foldRevenue`)
```
available = gross(recognized) − refunded − reversed − reserved − withdrawn
```
Campos: gross, refunded, reversed, reserved, withdrawn, available. Dinero exacto (bigint minor units).

## Cierre mensual (`computeMonthlyClose`) — solo Revenue
```
disponible = bruto − devoluciones − costes − impuestos − reserva − obligaciones
```
El operador registra una decisión: **retirar / reservar / reinvertir / colchón**. No mueve dinero.
El **Vault nunca** entra en el cierre (no es ingreso).

## Reglas
- Append-only; sin edición/borrado destructivo de movimientos.
- Nunca mezclar con el Vault (Banco B) — ids/streams/folds distintos.
- Balances siempre derivados de eventos.
- Simulado: la contabilidad real de ingresos y cualquier retiro requieren proveedor + conciliación.
