# Partnera Internal OS — Auto-Updater oficial de Tauri

**Aplicación:** `apps/internal-desktop` (`com.partnera.internal`) — Partnera Internal OS
**Fecha:** 2026-07-18
**Alcance:** SOLO esta aplicación. No se modificó ninguna otra app del ecosistema.
**Resultado:** ✅ Updater oficial de Tauri completamente funcional y **verificado con una
actualización real 0.2.0 → 0.2.1**, incluyendo reinicio automático, conservación de datos
y rechazo de un paquete manipulado.

---

## 1. Configuración encontrada (auditoría previa)

La app **ya tenía** una base correcta del updater oficial (commit `8221b05`), no partía de cero:

| Elemento | Estado encontrado |
|---|---|
| `tauri-plugin-updater` v2 | ✅ En `Cargo.toml` y registrado en `lib.rs` |
| `plugins.updater.pubkey` | ✅ Presente y **verificado**: coincide con la clave privada de `~/.partnera/updater.key` |
| Clave privada | ✅ Fuera del repo, git-ignorada, sin contraseña |
| `tauri.conf.release.json` (overlay CI) | ⚠️ **Roto** (ver §3) |
| Workflow `release-partnera-internal.yml` | ✅ Bien construido, latente hasta que exista remoto |
| `REPLACE_OWNER` / `REPLACE_REPO` | ✅ **Centinelas funcionales** comprobados en Rust — se conservaron intactos |
| Identificador / versionado / iconos / bundle | ✅ Correctos y coherentes |
| Capabilities | ✅ Deny-by-default; el panel en loopback sin IPC |
| Flujo de updater | ❌ Incompleto (ver §3) |

**No se encontraron** configuraciones duplicadas ni endpoints obsoletos apuntando a sitios muertos.

---

## 2. Problemas encontrados

### P1 — `tauri.conf.release.json` inválido (bloqueante, nunca detectado)
Contenía una clave `$comment`, que el esquema de Tauri rechaza:

```
Error `"tauri.conf.json"` error: Additional properties are not allowed ('$comment' was unexpected)
```

Cualquier build de release fallaba de inmediato. **El workflow de publicación habría fallado
en su primera ejecución.** Prueba de que nunca se había ejecutado una release real.

### P2 — Instalación automática sin consentimiento
El flujo descargaba e instalaba **solo**, y reiniciaba la app. Esta app supervisa un runtime
local con un operador potencialmente a mitad de tarea; arrancarla sin aviso no es aceptable.

### P3 — Cero visibilidad
`download_and_install(|_chunk, _total| {}, || {})`: sin progreso. Sin UI. Sin "ya estás
actualizado". Sin errores visibles. El único rastro era una línea de log.

### P4 — Sin comprobación manual
No existía ninguna forma de que el operador buscara actualizaciones.

### P5 — Runtime Node huérfano en cada actualización (encontrado **durante** la prueba real)
En Windows el instalador NSIS termina el proceso con `std::process::exit(0)`, por lo que
`RunEvent::Exit` **nunca se ejecuta** y el `node.exe` empaquetado quedaba vivo. Verificado:
2 procesos huérfanos tras la primera actualización. Además mantenían abierto
`resources/node.exe`, **lo que impedía el relanzamiento automático de la app**.

---

## 3. Cambios realizados

Todos dentro de `apps/internal-desktop`.

| Archivo | Cambio |
|---|---|
| `src-tauri/tauri.conf.release.json` | **Corregido**: eliminada la clave `$comment` inválida (P1) |
| `src-tauri/src/updater.rs` | Reescrito: máquina de estados `Phase`, progreso real, consentimiento, comprobación manual, `on_before_exit`, 4 tests |
| `src-tauri/src/lib.rs` | `stop_runtime()` reutilizable, bandeja del sistema, registro de comandos, `now_millis` compartido |
| `ui/updater.html` | **Nuevo**: ventana de actualizaciones (tauri://, confiable) |
| `src-tauri/capabilities/default.json` | Añadida la ventana `updater`; el plugin updater sigue **sin** exponerse a contenido web |
| `src-tauri/Cargo.toml` | Feature `tray-icon` |
| `src-tauri/tauri.conf.e2e.json` | **Nuevo**: overlay SOLO de pruebas (transporte inseguro en loopback) |
| `scripts/local-update-channel.mjs` | **Nuevo**: canal de actualización local real, con `--tamper` |
| `package.json` | `desktop:build:signed`, `update:channel`; versión 0.2.1 |
| `UPDATER.md` | Reescrito para reflejar el comportamiento real |

### Experiencia resultante

- **Al iniciar:** comprobación automática, no bloqueante. **Silenciosa** si no hay nada nuevo
  (solo log). Si hay versión nueva → ventana con versión, notas y botones.
- **Manual:** bandeja del sistema → *Buscar actualizaciones…*. Informa **siempre**, incluido
  "La aplicación está actualizada".
- **Progreso:** porcentaje y MB reales cuando el servidor envía `content-length`; barra
  indeterminada con bytes descargados cuando no. Eventos limitados a ~15/s.
- **Errores:** causa en castellano llano + detalle técnico desplegable + *Reintentar*.
- **Instalación:** solo tras clic explícito.

### Por qué la bandeja del sistema

La ventana principal carga el panel de administración por loopback, que **deliberadamente no
tiene IPC de Tauri**. Por tanto no puede invocar comandos del updater. La bandeja vive en el
lado nativo confiable. La ventana de actualizaciones es una página `tauri://` separada que
solo puede llamar a cuatro comandos propios (`updater_sync`, `updater_check`,
`updater_install`, `updater_close`) — **nunca a la superficie del plugin**.

---

## 4. Pruebas realizadas

### Puertas de calidad

| Prueba | Resultado |
|---|---|
| `pnpm typecheck` | ✅ 0 errores |
| `pnpm lint` | ✅ 0 errores (3 warnings preexistentes en `packages/web/src/server.ts`, ajenos) |
| `pnpm test` | ✅ 254/254 |
| `cargo check` | ✅ |
| `cargo test` | ✅ 4/4 (nuevos) |
| `tauri build` + NSIS | ✅ instaladores 0.2.0 y 0.2.1 |
| Firma de artefactos | ✅ `.sig` generado y validado contra el artefacto |

### Prueba REAL de actualización entre dos versiones

Método: dos builds firmados de verdad con la clave real, servidos por un canal Tauri
auténtico en loopback (`scripts/local-update-channel.mjs`).

| # | Escenario | Esperado | Resultado |
|---|---|---|---|
| 1 | 0.2.0 detecta 0.2.1, **sin** consentimiento | Detecta, no instala | ✅ `updater.available`, sigue en 0.2.0 |
| 2 | Payload **manipulado**, firma válida | Rechazo, instalación intacta | ✅ `The signature verification failed`, sigue en 0.2.0, app viva |
| 3 | Actualización completa | Descarga→verifica→instala→reinicia | ✅ **0.2.0 → 0.2.1** |
| 4 | Datos locales | Intactos | ✅ `data.json` sha256 idéntico; marcador de prueba sobrevivió |
| 5 | Reinicio automático | App vuelve en 0.2.1 | ✅ Relanzada sola, `boot.ready` en 0.2.1 |
| 6 | Sin huérfanos | 0 `node.exe` sueltos | ✅ El único `node.exe` es hijo legítimo del proceso vivo |
| 7 | Endpoint HTTP en build de release | Rechazado | ✅ `must use a secure protocol like https` |

Log real de la actualización correcta:

```
updater.available version=0.2.1 current=0.2.0
updater.unattended installing_without_consent
updater.download_start version=0.2.1
updater.download_done verifying_signature
updater.stopping_runtime_before_install      ← corrección P5
app.start                                     ← relanzada automáticamente
boot.spawn ... version=0.2.1
boot.ready
```

**Hallazgo clave:** el escenario 5 **fallaba** antes de corregir P5. El `node.exe` huérfano
bloqueaba `resources/node.exe` e impedía el relanzamiento. Tras usar el hook oficial
`on_before_exit`, el reinicio funciona. Relación causa-efecto confirmada empíricamente.

### Notas honestas sobre el método

- La prueba usó un canal **HTTP en loopback**, posible solo con el overlay
  `tauri.conf.e2e.json` (`dangerousInsecureTransportProtocol`). Ese flag **no existe** en
  `tauri.conf.json` ni en el overlay de CI: los builds distribuidos solo aceptan HTTPS
  (confirmado en el escenario 7). Todo lo demás —manifiesto, comparación de versiones,
  descarga, verificación minisign, instalación NSIS, reinicio— es idéntico a una release.
- El escenario 3 usó `PARTNERA_UPDATE_UNATTENDED=1` para saltar el clic de consentimiento
  sin humano. El escenario 1 prueba justamente que sin ese flag **no** se instala nada.
- No se publicó nada en GitHub ni en ningún servicio externo.

---

## 5. Publicación en GitHub — COMPLETADA Y VERIFICADA

El canal de releases está **vivo y publicando automáticamente**.

- **Código:** `primebuildfit-lab/partnera` (PRIVADO), rama `feat/partnera-admin-tauri`.
- **Canal público:** `primebuildfit-lab/partnera-releases` — obligatorio: el updater descarga
  **sin autenticar** y no puede leer assets de un repo privado.
- **Release publicada:** `partnera-internal-v0.2.2` (instalador + `.sig`).
- **Tag rodante:** `partnera-internal-channel-stable` → `internal-latest.json`.
- **Secretos:** `PARTNERA_INTERNAL_SIGNING_KEY` (clave propia 8ADBA54F) y
  `PARTNERA_RELEASES_TOKEN` (PAT cross-repo).

Publicar una versión nueva es ahora un solo paso:

```bash
# bump a X.Y.Z en package.json + Cargo.toml + tauri.conf.json, commit
git tag partnera-internal-vX.Y.Z && git push origin partnera-internal-vX.Y.Z
```

El workflow compila, firma, publica la release inmutable, reapunta el canal y **verifica que
el manifiesto queda accesible**. Ejecución verde: run `29668057674`.

### Prueba REAL contra GitHub por HTTPS

Instalado 0.2.1 (con el endpoint compilado dentro), sin ningún override local:

```
updater.available version=0.2.2 current=0.2.1     ← leído de GitHub por HTTPS
updater.download_start version=0.2.2
updater.download_done verifying_signature          ← 25 MB descargados de GitHub
updater.stopping_runtime_before_install
app.start                                          ← relanzada sola
updater.up_to_date version=0.2.2                   ← la nueva versión se comprueba y se ve al día
boot.spawn ... version=0.2.2 build=0.2.2+e1c779533.20260719T010811Z
```

El build id `0.2.2+e1c779533` **sin sufijo `.dirty`** demuestra que el binario instalado es el
artefacto compilado por CI del commit `e1c7795` y descargado de GitHub — no una compilación
local. Datos locales intactos (`data.json` sha256 idéntico, marcador sobrevivió), sin procesos
huérfanos.

### Problemas de CI encontrados y corregidos

| # | Problema | Corrección |
|---|---|---|
| C1 | `pnpm install --frozen-lockfile` fallaba: el lockfile de HEAD fija `pg`/`@types/pg` pero `packages/web/package.json` nunca se comiteó con ellos | Declaradas esas dos dependencias (commit aparte, fuera de esta app — ver §6) |
| C2 | `tauri-action` no detecta pnpm sin lockfile junto a `projectPath`, caía a npm y moría con `Missing script: tauri` | Llamada directa `pnpm exec tauri build`, el mismo comando usado en local |
| C3 | esbuild no resolvía `@partnera/*`: sus `dist/` son salidas de tsc y no están en git | Paso `pnpm build` antes de empaquetar |

C1 y C3 **solo aparecen en un checkout limpio**: en local funcionaban por artefactos residuales.

## 5b. Resultado final

El updater oficial de Tauri está **completo, publicado y verificado de extremo a extremo**:
detecta, comprueba la firma, descarga, muestra progreso, permite instalar, reinicia
correctamente, conserva los datos locales y registra todos los errores — tanto contra un canal
local como **contra la release real de GitHub por HTTPS**.

⚠️ **Riesgo a gestionar:** si se pierde `~/.partnera/updater.key`, ninguna instalación
existente podrá volver a actualizarse jamás. Conviene una copia offline.

---

## 6. Problemas de ECOSISTEMA (documentados, NO modificados)

Detectados de paso; **no se tocó ninguna otra aplicación**.

1. **`$comment` inválido en overlays de release.** El patrón `tauri.conf.release.json` con
   `$comment` fue copiado por el ecosistema. Cualquier otra app que lo use tiene el mismo
   fallo bloqueante de P1. Merece una revisión transversal.
2. **Runtime huérfano tras actualizar (P5).** Afecta a *toda* app Tauri del ecosistema que
   lance un sidecar Node y no use `on_before_exit`. Es un fallo silencioso: procesos
   acumulados y reinicio automático roto.
3. **Colisión de puerto en pruebas.** El puerto 8787 ya estaba ocupado por el canal de
   actualización de **PrimeBuild Official Store** desde otra sesión. Dos apps probando
   updaters en el mismo puerto pueden servirse manifiestos cruzados. Conviene un puerto por
   app. (Aquí se usó 8931.)
4. **Contención de compilación.** Seis builds Tauri release simultáneos en esta máquina
   (13,8 GB RAM) agotan la memoria y hacen que `rustc` muera con
   `STATUS_STACK_BUFFER_OVERRUN` / ICE. **No es corrupción del toolchain**: son fallos por
   falta de memoria y desaparecen al compilar de a una app.

---

## 7. Posibles mejoras

1. ~~Publicar la primera release real y probar contra GitHub por HTTPS~~ — **HECHO**, ver §5.
2. **Canales estable/beta**: `latest.json` + `beta.json` con selección en la UI.
3. **Recordatorio diferido**: "Más tarde" hoy solo cierra; podría reofrecer a las N horas.
4. **Reanudar descargas** interrumpidas (hoy se reinicia desde cero).
5. **Comprobación periódica** además de al arranque, para sesiones de días.
6. **Firmar el instalador con certificado Authenticode** — evitaría el aviso SmartScreen de
   Windows. Es independiente de la firma minisign del updater.
7. **Rollback real**: hoy la protección es que una firma inválida no instala nada (probado).
   Un rollback automático a la versión anterior exigiría conservar el paquete previo.
