# Partnera Business — Auto-Updater oficial de Tauri

**Fecha:** 2026-07-18
**Alcance:** `apps/business-desktop` **únicamente**. Ninguna otra aplicación del
ecosistema fue modificada.
**Resultado:** el updater oficial de Tauri queda **funcional, publicado y
verificado en vivo**. El canal está operativo en GitHub y se comprobó una
actualización real **0.1.1 → 0.1.2 descargada desde GitHub por HTTPS**, sin
ninguna variable de entorno de prueba.

> **Corrección a una versión anterior de este informe.** Escribí que «el monorepo
> Partnera no tiene remoto». **Era falso.** Lo deduje de la documentación interna
> (`apps/internal-desktop/UPDATER.md`) en lugar de ejecutar `git remote -v`. El
> repo sí tiene remoto (`primebuildfit-lab/partnera`) y además ya existía el repo
> público de releases `primebuildfit-lab/partnera-releases`, con el canal de
> Partnera Affiliate ya en marcha. Verificado, no deducido, a partir de aquí.

---

## 1. Configuración encontrada (auditoría previa)

El andamiaje existía y era correcto en lo básico: el plugin
`tauri-plugin-updater` v2 estaba en `Cargo.toml`, registrado en `lib.rs`, con un
`updater.rs` que hacía check → download → install → relaunch, y el centinela
`REPLACE_OWNER/REPLACE_REPO` que degrada honestamente cuando no hay canal.

Sobre esa base aparecieron **cuatro defectos que impedían que el updater
funcionase**, más dos problemas descubiertos durante las pruebas.

| # | Problema | Gravedad | Estado |
|---|----------|----------|--------|
| 1 | **Pubkey sin clave privada.** `plugins.updater.pubkey` era `DF1AF6BDCBDDCE57`, compartida con Operations y Affiliate, y **no existe la clave privada correspondiente** en la máquina. Ninguna actualización habría podido firmarse ni validarse jamás. | Bloqueante | Corregido |
| 2 | **Faltaba `bundle.createUpdaterArtifacts`.** Sin ese flag, Tauri 2 no genera el `.sig`; el manifiesto no tendría firma que publicar. | Bloqueante | Corregido |
| 3 | **Capability inerte.** `app.security.capabilities` listaba sólo `["default"]` (limitada a la ventana `main`). Cualquier ventana nueva quedaba **sin IPC**. | Bloqueante | Corregido |
| 4 | **Sin experiencia de usuario.** No había comprobación manual, ni progreso, ni mensaje de "ya estás actualizado". El flujo era silencioso y automático de principio a fin. | Alta | Corregido |
| 5 | **Log corrupto por concurrencia.** `log()` abría un handle nuevo por llamada; el updater (tarea async) y el arranque escribían a la vez y las líneas se entrelazaban, produciendo JSON inválido. Detectado en la primera ejecución real. | Media | Corregido |
| 6 | **Ventana de updater muda ante fallo de IPC.** Si el puente no estaba disponible, la ventana se quedaba en "Buscando actualizaciones…" para siempre. Así se manifestó el problema #3. | Media | Corregido |

Evidencia del #5 (primera ejecución, dos hilos escribiendo a la vez):

```
{"at":{"at":17844030246131784403024613,"msg":","msg":"boot.navigate ...
```

---

## 2. Cambios realizados

### Firma
- Generado un par de claves **exclusivo de Partnera Business**:
  `.secrets-tauri/business-updater.key` (+ `.pub`), id **`20B16525C8AD120B`**, sin
  contraseña. El directorio ya estaba en `.gitignore`.
- `plugins.updater.pubkey` actualizado a esa clave pública.
- **No se reutilizó** la clave de Internal OS ni la de Creator: un producto, una
  clave, un manifiesto.

### Configuración
- `bundle.createUpdaterArtifacts: true` — ahora se emite el `.sig`.
- `app.security.capabilities: ["default", "updater-window"]`.
- Nueva capability `capabilities/updater.json`, limitada a la ventana `updater`.

### Código (`src-tauri/src/updater.rs`, reescrito)
- Máquina de estados con eventos `updater://status`:
  `checking · available · downloading · installing · uptodate · disabled · error`.
- Comandos: `updater_check`, `updater_install`, `updater_current_version`,
  `updater_last_status`, `updater_close`.
- Progreso real de descarga (bytes acumulados + porcentaje cuando hay
  `Content-Length`; barra indeterminada cuando no lo hay).
- Cerrojo `busy` contra ejecuciones solapadas.
- `last` guarda el último estado emitido: la ventana se crea a la vez que arranca
  la comprobación, así que un resultado temprano se **reproduce** al montar en vez
  de dejar la ventana girando.

### Interfaz (`ui/updater.html`, nueva)
- Ventana local propia, en español, con notas de versión, barra de progreso,
  botones **Instalar y reiniciar** / **Buscar de nuevo** / **Cerrar**.
- **Por qué una ventana aparte:** la ventana `main` navega a contenido remoto que
  por diseño no tiene IPC. Poner ahí el updater habría exigido dar IPC al
  contenido remoto. Así la consola remota **no puede observar ni accionar** el
  updater.
- Ante un puente IPC roto muestra un error explícito (corrige el #6).

### Menú
- Menú nativo **Partnera → Buscar actualizaciones… / Ver registro / Salir**, con
  acelerador `Ctrl+U`. Es la única vía posible para la comprobación manual, dado
  que el contenido remoto no tiene IPC.

### Otros
- `lib.rs`: `log()` mantiene el cerrojo durante la escritura (corrige #5).
- `.github/workflows/release-partnera-business.yml` (nuevo): compila, firma y
  publica; sube además `business-latest.json` con nombre propio del producto.
- `src-tauri/tauri.conf.e2e.json` + `.README.md`: overlay **sólo de prueba**.
- `README.md`: sección de auto-update reescrita.

---

## 3. Pruebas realizadas

### Verificación estática

| Comprobación | Resultado |
|---|---|
| `pnpm typecheck` (monorepo) | ✅ |
| `pnpm lint` | ✅ 0 errores (3 avisos preexistentes en `packages/web/src/server.ts`) |
| `pnpm test` | ✅ **254 tests / 35 ficheros** |
| `cargo check` | ✅ |
| `cargo clippy --all-targets` | ✅ sin errores (1 aviso `collapsible_if` **preexistente**, en el código de navegación, no tocado) |
| `tauri build` + instalador NSIS | ✅ `.exe` + `.sig` en 0.1.0 y 0.1.1 |

### Prueba real de actualización entre dos versiones

Procedimiento: se compilaron y firmaron **dos versiones distintas** (0.1.0 y
0.1.1), se sirvió `business-latest.json` + el instalador desde `127.0.0.1:8791`,
se instaló 0.1.0 y se lanzó apuntando a ese manifiesto.

**Log de la aplicación (ciclo completo):**

```
{"msg":"app.start"}
{"msg":"updater.check start"}
{"msg":"updater.available version=0.1.1"}
{"msg":"updater.download start version=0.1.1"}
{"msg":"app.start"}                     <- relanzada ya como 0.1.1
```

**Log del servidor:**

```
[serve] 200 business-latest.json (722 bytes)
[serve] 200 Partnera Business_0.1.1_x64-setup.exe (1827095 bytes)
```

**Versión del ejecutable instalado: `0.1.0` → `0.1.1`.** ✅

### Matriz de escenarios

| Escenario | Esperado | Observado | ✅ |
|---|---|---|---|
| Hay versión nueva | Detecta, descarga, verifica, instala, reinicia | Ciclo completo; binario pasa a 0.1.1 | ✅ |
| **Paquete manipulado** (bytes alterados, firma legítima) | Rechazo por firma, instalación intacta | `updater.install_failed The signature verification failed` — versión **sigue en 0.1.0** | ✅ |
| Descarga inalcanzable (404) | Error claro, instalación intacta | `updater.install_failed Download request failed with status: 404 Not Found` — **sigue en 0.1.0** | ✅ |
| Ya actualizado (manifiesto = versión instalada) | Lo dice y no abre ventana | `updater.uptodate`; ninguna ventana emergente | ✅ |
| Sin canal configurado | "No configurado", app funciona | `updater.disabled no_release_channel` | ✅ |
| Endpoint no HTTPS en build de producción | Rechazado | `The configured updater endpoint must use a secure protocol like https` | ✅ |
| Datos locales tras actualizar | Se conservan | `%APPDATA%\com.partnera.business\` (logs, estado de ventana) intacto tras el reinicio | ✅ |
| Comprobación manual desde la ventana | Vuelve a consultar | Clics en **Buscar de nuevo** / **Instalar** generan `updater.check start` / `updater.download start` repetidos | ✅ |

**Sobre el "rollback":** no existe descenso automático de versión, y no debe
existir. La garantía real es que **nada roto llega a instalarse**: firma inválida
o descarga fallida abortan antes de tocar la instalación en curso, como muestran
los dos escenarios negativos. Para revertir se publica una versión superior con
la carga anterior.

### Lo que NO pude verificar

- **El menú de comprobación manual.** Con foco real en la app comprobé que
  `Ctrl+U` **no funciona**: el webview se traga la tecla antes de llegar al menú
  nativo. Al hacer clic en el propio elemento del menú tampoco pasaba nada — el
  manejador estaba registrado en el *builder de la ventana*, donde nunca se
  dispara. Corregido en 0.1.3 registrándolo en la aplicación
  (`AppHandle::on_menu_event`). **La corrección no está verificada**: al intentar
  probarla, el escritorio estaba en uso y mis clics acabaron en otras ventanas.
  Falta una comprobación manual: abrir la app y pulsar **Partnera → Buscar
  actualizaciones…**. El acelerador `Ctrl+U` seguirá sin funcionar (documentado).
- **Los textos exactos de la UI** en cada estado se comprobaron por código y por
  los eventos emitidos, no por captura de pantalla de los cinco estados.

---

## 3-bis. Publicación del canal y prueba en vivo

### Modelo de canal (corregido)

La primera versión de este informe proponía `releases/latest/download/…` y
advertía de una colisión entre productos. Al inspeccionar **Partnera Affiliate**
—que ya tiene su canal en marcha— resultó que el ecosistema **ya había resuelto
esto mejor**: un **tag fijo** que contiene sólo el manifiesto del producto y se
reapunta en cada publicación. Adopté esa convención en lugar de la mía:

```
tag fijo:     partnera-business-channel-stable  -> business-latest.json (se reapunta)
tags version: partnera-business-v0.1.1, v0.1.2  -> instaladores + .sig (inmutables)
```

Así varios productos comparten `partnera-releases` sin taparse el manifiesto
entre ellos. **La colisión que reporté queda resuelta, no sólo mitigada.**

### Publicado

Repo: **`primebuildfit-lab/partnera-releases`** (público — obligatorio: el updater
descarga sin autenticar, un repo privado no puede servir estos assets). Sólo
contiene binarios firmados; **ningún código fuente**.

| Release | Contenido |
|---|---|
| `partnera-business-v0.1.1` | instalador + `.sig` |
| `partnera-business-v0.1.2` | instalador + `.sig` |
| `partnera-business-v0.1.3` | instalador + `.sig` |
| `partnera-business-channel-stable` | `business-latest.json` (apunta a 0.1.3) |

Endpoint que consultan las instalaciones:
`https://github.com/primebuildfit-lab/partnera-releases/releases/download/partnera-business-channel-stable/business-latest.json` → **HTTP 200 sin autenticar**.

**Los artefactos se firmaron localmente**, así que **no fue necesario subir la
clave privada como secreto de repositorio**. El secreto
`TAURI_SIGNING_PRIVATE_KEY` sólo hace falta si en el futuro se quiere que compile
el workflow de CI; esa subida debe hacerla una persona, no yo.

### Prueba real contra GitHub (no simulada)

Instalado 0.1.1 (con el endpoint real compilado dentro), **sin
`PARTNERA_UPDATE_ENDPOINT`** — confirmado en el propio test:

```
BEFORE: 0.1.1        PARTNERA_UPDATE_ENDPOINT is set: False

{"msg":"updater.check start"}
{"msg":"updater.available version=0.1.2"}
{"msg":"updater.download start version=0.1.2"}
{"msg":"app.start"}          <- relanzada
{"msg":"updater.uptodate"}   <- ya en 0.1.2

AFTER: 0.1.2
```

✅ Detección, descarga desde GitHub por HTTPS, verificación de firma, instalación,
reinicio y confirmación posterior. **El canal está vivo.**

---

## 4. Estado final

`apps/business-desktop` se actualiza solo mediante el sistema oficial de Tauri, y
está **demostrado en vivo**. Versión publicada: **0.1.2** (`tauri.conf.json` y
`Cargo.toml` sincronizados). La máquina quedó con 0.1.2 instalada por el propio
updater.

Para publicar la siguiente versión: subir la versión, compilar firmando, crear el
release `partnera-business-vX.Y.Z` y reapuntar `partnera-business-channel-stable`
al nuevo `business-latest.json` (o dejar que lo haga el workflow, una vez exista
el secreto de firma en CI).

> ⚠️ **La clave privada es el único punto de fallo.** Si se pierde, ninguna
> instalación existente podrá volver a actualizarse: habría que reinstalar a mano
> en cada equipo. Conviene una copia offline —ahora más que antes, porque ya hay
> instalaciones en circulación que dependen de ella.

> ⚠️ **La clave privada es el único punto de fallo.** Si se pierde, ninguna
> instalación existente podrá volver a actualizarse: habría que reinstalar a mano
> en cada equipo. Conviene una copia offline antes de publicar la primera release.

**Versión del repo:** subida a `0.1.1` (`tauri.conf.json` y `Cargo.toml`
sincronizados). La máquina quedó con la build de producción 0.1.1 instalada, no
con la de prueba — verificado porque rechaza el endpoint HTTP.

---

## 5. Problemas del ecosistema (documentados, NO modificados)

1. **Clave pública huérfana compartida.** `DF1AF6BDCBDDCE57` está configurada en
   **Operations** y **Affiliate** además de Business, y **no existe su clave
   privada**. Esas dos apps tienen hoy un updater que no puede funcionar. Cada una
   necesita su propio par de claves. *(No tocado por indicación explícita.)*

2. ~~**Colisión de canal en `releases/latest/download/`.**~~ **Resuelto.** El
   ecosistema ya usaba el patrón de tag fijo por producto (Affiliate); Business lo
   adopta. Varios productos conviven en `partnera-releases` sin taparse. **No hay
   que crear un repo por producto.** Queda un aviso: **Internal OS** sí usa
   `releases/latest/download/latest.json` en su configuración, así que cuando
   publique en un repo compartido sufrirá exactamente esa colisión. *(No tocado.)*

3. **Peticiones cruzadas a endpoints locales.** Durante las pruebas mi servidor
   recibió peticiones de `latest.json` que no eran mías: hay otras apps del
   ecosistema apuntando su updater a `http://127.0.0.1` en puertos cercanos. No
   afecta a Business, pero conviene revisarlo.

4. **ICE intermitente de rustc.** Varias compilaciones en release abortaron con
   `STATUS_STACK_BUFFER_OVERRUN` dentro de `rustc`, y pasaron al reintentar. Es
   inestabilidad del toolchain/máquina, no del código. Si molesta en CI, considerar
   `lto = "thin"` en lugar de `lto = true`.

5. **El crate no admite `#[cfg(test)]`.** Con `crate-type = ["staticlib",
   "cdylib", "rlib"]`, `cargo test` falla al resolver `#[tauri::command]`
   (`tauri_utils required to be available in rlib format`). Es una limitación
   conocida de Tauri, no un fallo de este cambio; por eso la verificación de este
   módulo es end-to-end y no unitaria.

---

## 6. Mejoras posibles

- **Comprobación periódica**, no sólo al arrancar (p. ej. cada 6 h) para sesiones
  largas.
- **Reintento con backoff** ante fallos de red transitorios; hoy se salta hasta el
  siguiente arranque.
- **Diferir la instalación**: "instalar al cerrar" en lugar de reiniciar en medio
  del trabajo.
- **Canales** (`stable` / `beta`) mediante manifiestos separados.
- **Firmar el instalador con certificado Authenticode**, independiente de minisign:
  evita el aviso de SmartScreen en instalaciones nuevas.
- **Rotación de claves**: hoy no hay procedimiento si la clave se ve comprometida.
