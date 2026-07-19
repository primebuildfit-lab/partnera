# Partnera Creator — Auto-Updater oficial de Tauri

**Aplicación:** Partnera Creator (`@partnera/creator-desktop`, `com.partnera.creator`)
**Ruta:** `D:\empresas\Partnera\apps\creator-desktop`
**Fecha:** 2026-07-18
**Alcance:** SOLO esta aplicación. No se ha modificado ninguna otra app del ecosistema.

Se usa exclusivamente el sistema **oficial** `tauri-plugin-updater` (v2.10.1). No se
ha creado ningún updater propio: la descarga, la verificación de firma minisign y
la instalación las realiza el plugin.

---

## 1. Configuración encontrada (auditoría)

Auditado antes de tocar nada: `tauri.conf.json`, `Cargo.toml`, `capabilities/`,
`src/lib.rs`, `src/updater.rs`, `scripts/`, `ui/`, bundle, identificadores,
versionado, firma, instaladores, permisos, plugins y variables de entorno.

### Ya correcto

| Elemento | Estado |
| --- | --- |
| `tauri-plugin-updater` en `Cargo.toml` | ✅ v2.10.1 |
| Plugin registrado en `lib.rs` | ✅ `tauri_plugin_updater::Builder::new().build()` |
| `pubkey` en `tauri.conf.json` | ✅ minisign válida |
| Clave privada local | ✅ `.secrets-tauri/creator-updater.key`, **gitignored** |
| Correspondencia clave pública ↔ privada | ✅ verificada (key ID `6B86524DAB330F8B`) |
| `bundle.targets` | ✅ `nsis` |
| `updater.windows.installMode` | ✅ `passive` |
| Identificador / versionado | ✅ coherentes, versión con fuente única en `tauri.conf.json` |

### Problemas detectados

| # | Severidad | Problema |
| --- | --- | --- |
| 1 | **Bloqueante** | `bundle.createUpdaterArtifacts` **ausente**. Sin esta clave, `tauri build` **nunca** genera los artefactos de actualización ni el `.sig`. El updater no podía funcionar de ninguna forma. |
| 2 | **Bloqueante** | Endpoint `REPLACE_OWNER/REPLACE_REPO` y **el repo Partnera no tiene ningún remoto git**. No existe canal de publicación. |
| 3 | Alta | Sin ninguna UX de actualización: los callbacks de progreso eran `\|_chunk, _total\| {}` (vacíos). No había búsqueda manual, ni aviso de "hay nueva versión", ni de "ya está actualizada". |
| 4 | Alta | Al arrancar, la versión anterior **descargaba e instalaba en silencio y reiniciaba la app**, sin avisar — podía cortar una sesión activa del portal del creator. |
| 5 | Media | `app.restart()` tras instalar es **incorrecto en Windows/NSIS**: el instalador ya relanza la app (`/R`) y espera a que el proceso salga; relanzar el ejecutable antiguo crea una carrera mientras se reemplaza. |
| 6 | Media | Endpoint duplicado y muerto: la URL `REPLACE_*` de `tauri.conf.json` nunca se usaba, porque `updater.rs` siempre sobrescribe los endpoints desde Rust. Configuración engañosa. |
| 7 | Baja | La descripción de `capabilities/default.json` afirma que el contenido web no tiene IPC, pero los comandos propios de Tauri 2 no se filtran por capabilities: el contenido remoto sí podía invocar `retry_boot` / `open_logs_dir`. |

---

## 2. Cambios realizados

Todos dentro de `apps/creator-desktop`.

### `src-tauri/tauri.conf.json`
- **`bundle.createUpdaterArtifacts: true`** — corrige el problema #1.
- `updater.endpoints` → `[]`, eliminando la URL `REPLACE_*` muerta (#6). Los
  endpoints los resuelve Rust, que es la única fuente de verdad.
- `app.security.capabilities` → `["default", "updater-window"]`.
- `version` → `0.1.1`.

### `src-tauri/Cargo.toml`
- `tauri` con feature **`tray-icon`** (necesaria para la búsqueda manual).
- `version` → `0.1.1`.

### `src-tauri/src/updater.rs` (reescrito)
- Máquina de estados completa emitida a la UI: `not-configured`, `checking`,
  `up-to-date`, `available`, `downloading` (con bytes y %), `verifying`,
  `installing`, `restarting`, `failed`.
- `download()` e `install()` separados (en vez de `download_and_install`) para
  poder informar honestamente de la fase de **verificación de firma**.
- Progreso real de descarga en lugar de callbacks vacíos (#3).
- El arranque ahora **informa** en vez de instalar en silencio (#4).
- `app.exit(0)` en lugar de `app.restart()` tras instalar (#5).
- `resolve_endpoint()` dividido en una función pura `endpoint_from()` testeable.
- **Endpoint por canal fijo** `partnera-creator-channel-stable`, **no**
  `releases/latest/download/…`. Partnera es un repo multiproducto: "latest" es el
  producto que haya publicado más recientemente, así que una release de Business
  o Affiliate acabaría sirviendo su manifiesto a las instalaciones de Creator.
  (Mismo criterio que ya usa Partnera Affiliate.)
- Los tres comandos `updater_*` **rechazan cualquier llamada que no venga de la
  ventana local `updater`**, de modo que el portal remoto no puede lanzar una
  instalación (mitiga #7 para la superficie nueva).
- Estado `last` cacheado: la comprobación de arranque ocurre antes de que exista
  la ventana, así que la ventana reproduce la última fase real al abrirse.

### `src-tauri/src/lib.rs`
- Registra `UpdateState` y los comandos `updater_check` / `updater_install` /
  `updater_bootstrap`.
- **Icono de bandeja** con menú: *Abrir Partnera Creator*, *Buscar
  actualizaciones…*, *Ver logs*, *Salir*. Es el punto de entrada de la búsqueda
  manual: la ventana principal muestra el portal remoto a pantalla completa y no
  tiene cromo de aplicación donde colgar un menú.
- Un fallo al crear la bandeja se registra pero no es fatal.

### `src-tauri/capabilities/updater.json` (nuevo)
- Capability limitada a la ventana `updater`. **No** concede `updater:default`:
  todo el flujo se conduce desde Rust.

### `ui/updater.html` (nuevo)
- Ventana local en español, con el mismo lenguaje visual que el splash.
- Muestra versión actual → nueva, notas de la versión, barra de progreso con
  bytes y porcentaje, verificación de firma, instalación y errores.
- **Todos los valores procedentes del manifiesto remoto se escapan** antes de
  interpolarse en `innerHTML`: `version`, `date` y los textos de error se leen
  *antes* de verificar la firma, así que son entrada no confiable en una ventana
  con acceso a IPC.

### `scripts/make-release-manifest.mjs` (nuevo) + `package.json`
- Genera `creator-latest.json` emparejando el instalador NSIS con su `.sig`.
- Falla de forma ruidosa si falta la firma o si el instalador no corresponde a la
  versión actual, en vez de publicar un manifiesto que apunte a un binario viejo.
- Script `release:manifest`.

### `README.md`
- Sección de auto-actualización y procedimiento de publicación documentados.

---

## 3. Pruebas

### Cadena de compilación

| Prueba | Resultado |
| --- | --- |
| `cargo check` | ✅ limpio, sin warnings |
| `cargo test` | ✅ 4/4 (`endpoint_from`: placeholders, repo configurado, override runtime, override en blanco) |
| `tauri build` (release, NSIS) | ✅ instalador 0.1.1 generado |
| Firma de artefactos | ✅ `.sig` generado — **antes era imposible**, éste fue el fallo bloqueante #1 |
| Manifiesto `creator-latest.json` | ✅ generado y validado contra el `.sig` real |

**Verificación criptográfica independiente** (sin usar Tauri): el key ID de la
firma y el de la clave pública configurada coinciden — `8b0f33ab4d52866b` — y la
firma corresponde al fichero `Partnera Creator_0.1.1_x64-setup.exe`.

### Prueba real de actualización 0.1.0 → 0.1.1

Método: se compilaron dos instaladores reales y firmados. El 0.1.1 es
**exactamente el artefacto que se publica**. El 0.1.0 es un artefacto desechable
que sólo añade `dangerousInsecureTransportProtocol` para poder servir el
manifiesto desde `http://127.0.0.1` (en release, Tauri exige HTTPS). Esa opción
**nunca** está en la configuración que se publica.

Se instaló 0.1.0, se plantó un fichero de datos local, y se lanzó apuntando al
servidor local.

| Comprobación | Resultado |
| --- | --- |
| Detección automática de nueva versión al iniciar | ✅ `updater.available version=0.1.1` |
| Descarga desde el endpoint | ✅ el log del servidor registra la descarga (1 877 910 bytes) |
| Verificación de firma | ✅ `updater.verified version=0.1.1 bytes=1877910` |
| Instalación (NSIS) | ✅ |
| Reinicio | ✅ la app volvió a arrancar sola |
| **Versión instalada tras actualizar** | ✅ **0.1.1** (binario nuevo en disco) |
| **Datos locales conservados** | ✅ `creator-local-data.json`, `.window-state.json` y logs intactos |
| Registro de todo el flujo | ✅ |

### Prueba de manipulación (rollback / integridad)

Se sirvió el mismo instalador con dos bytes alterados en el centro:

| Comprobación | Resultado |
| --- | --- |
| Rechazo del paquete | ✅ `updater.download_failed The signature verification failed` |
| Nada se instaló | ✅ la app siguió en **0.1.0** |
| La instalación siguió usable | ✅ (el "rollback" es que no se toca nada hasta verificar) |

Esto confirma lo importante: la firma se verifica **dentro de `Update::download`,
antes** de que un solo byte llegue al instalador.

### Enforcement de HTTPS

La build 0.1.1 que se publica (sin la opción insegura) **rechazó** el endpoint
HTTP:

```
updater.check_failed No se pudo configurar el updater
(The configured updater endpoint must use a secure protocol like `https`.)
```

### Endpoint inalcanzable (degradación)

Con el servidor apagado, la app registró
`updater.check_failed ... error sending request` y **arrancó con normalidad**: un
fallo de red nunca bloquea el inicio ni deja la app en un estado raro.

### Aislamiento de IPC

El log confirma que la instalación sólo puede pedirse desde la ventana local:
`updater.install_requested from=updater`. El portal remoto de la ventana `main`
recibe `forbidden`.

### ⚠️ Lo que NO se pudo verificar en esta máquina

**El requisito "el usuario decide cuándo instalar" no pudo probarse aquí.** Durante
las pruebas la instalación se disparaba sola, ~2 s después de aparecer la ventana,
sin intervención. La instrumentación identificó la causa:

```
ui[updater] click id=primary trusted=true type=click detail=1 x=212 y=284 active=primary
```

Son **clics reales del sistema** (`isTrusted=true`) que caen sobre el botón
primario. `clientX` se mantiene fijo en 212 mientras `clientY` cambia (284 → 277)
según se recolocaba el botón: el puntero está fijo y algo genera clics en ese
punto. Persistió tras mover el cursor a (5,5), así que se inyectan de forma
sintética a nivel de sistema (típico de automatización vía UI Automation).

**Es un artefacto del entorno, no de la app** — pero destapó un defecto real de
diseño mío, que sí se ha corregido:

- la ventana se abría **con foco**, colocando una acción destructiva (reemplaza el
  ejecutable y reinicia) justo debajo del cursor;
- un clic que el usuario dirigía a otra cosa la ejecutaba de inmediato.

Mitigaciones aplicadas: la ventana ya **no roba el foco** al anunciarse
automáticamente (`focused(false)`), sólo se aceptan gestos **de confianza**
(`isTrusted`), y el botón de instalar **ignora clics durante los primeros 1500 ms**
tras aparecer (mismo criterio que los diálogos de permisos del navegador).

Queda pendiente que alguien confirme a mano, en una máquina sin esa automatización,
que la ventana espera al usuario. Todo lo demás del flujo está verificado arriba.

---

---

## 3.bis PUBLICADO — canal en vivo (2026-07-19)

El canal ya está **publicado y funcionando**.

- Repo: `primebuildfit-lab/partnera` (se hizo **PÚBLICO**; decisión explícita de Brian).
- Release / tag rodante: `partnera-creator-channel-stable`
- Assets: `Partnera.Creator_0.1.1_x64-setup.exe`, su `.sig`, y `creator-latest.json`
- Endpoint que consulta la app instalada:
  `https://github.com/primebuildfit-lab/partnera/releases/download/partnera-creator-channel-stable/creator-latest.json`

### Prueba real contra GitHub (sin ningún override de entorno)

Se compiló un 0.1.0 con el endpoint **de GitHub incrustado**, se instaló, y se lanzó
sin `PARTNERA_UPDATE_ENDPOINT`:

```
updater.available version=0.1.1          ← detectado desde GitHub por HTTPS
updater.install_requested from=updater    ← clic real en "Instalar y reiniciar"
updater.download_start version=0.1.1
updater.verified version=0.1.1 bytes=1877951   ← firma minisign verificada
app.start                                 ← relanzado solo
updater.up_to_date
```

Versión instalada después: **0.1.1**. El fichero local de prueba sobrevivió intacto.

**Además, esta vez la ventana SÍ esperó al usuario** (~12 min entre `available` e
`install_requested`, que fue el clic explícito): es la primera evidencia de que la
corrección de foco funciona, aunque sigue conviniendo confirmarlo en una máquina
sin la automatización que inyecta clics.

### ⚠️ Un fallo real detectado al publicar: GitHub renombra los assets

GitHub sustituye por puntos todo carácter fuera de `[A-Za-z0-9._-]`, así que
`Partnera Creator_0.1.1_x64-setup.exe` se sirve como
`Partnera.Creator_0.1.1_x64-setup.exe`. El primer manifiesto apuntaba al nombre
local (`%20`) y **daba 404**: el updater detectaba la versión, avisaba al usuario y
luego fallaba al descargar. Corregido en `make-release-manifest.mjs` con un
sanitizador `githubAssetName()`, y verificado que la URL responde 200.

**Todas las apps de Partnera tienen un espacio en `productName`, así que esto les
afecta a todas** — conviene comprobar que sus manifiestos resuelven 200.

### Nota de arquitectura (divergencia respecto al resto del ecosistema)

Internal OS, Affiliate y Business publican en el repo **público separado**
`primebuildfit-lab/partnera-releases`, manteniendo el código privado. **Creator
diverge**: su canal está en `partnera` mismo, que ahora es público. Funciona
igual, pero es una inconsistencia deliberada, no un descuido — si algún día se
quiere unificar, basta con republicar en `partnera-releases` y recompilar con
`PARTNERA_UPDATE_REPO=partnera-releases`.

---

## 4. Problemas del ecosistema (documentados, NO modificados)

Afectan a más aplicaciones. **No se ha tocado ninguna otra app.**

1. **No existe canal de publicación.** `D:\empresas\Partnera` no tiene remoto git.
   Ninguna app de Partnera puede publicar releases hoy.
2. **`createUpdaterArtifacts` probablemente ausente en las demás apps Tauri.** Era
   el fallo bloqueante aquí; conviene auditar las otras 12 apps del ecosistema.
3. **Claves de firma compartidas / dentro del repo.** Solo existen localmente las
   privadas de `creator` y `operations`. Si se pierden, las apps instaladas ya no
   podrán actualizarse jamás. Necesitan copia de seguridad fuera de la máquina.
4. **Memoria de la máquina.** Con `lto = true` + `codegen-units = 1` y ~2.4 GB
   libres, el enlazador falla con `LNK1102: out of memory` si se compila en
   paralelo. Hay que usar `CARGO_BUILD_JOBS=1`.
5. **`TAURI_SIGNING_PRIVATE_KEY_PATH` no funciona en `tauri build`.** El bundler
   solo lee `TAURI_SIGNING_PRIVATE_KEY` (contenido de la clave). Con `_PATH` el
   build termina sin firmar y solo avisa al final.
6. **Algo inyecta clics sintéticos en esta máquina** (ver sección de pruebas).
   Afecta a cualquier verificación interactiva de GUI de todo el ecosistema, no
   sólo a esta app. Conviene identificarlo antes de fiarse de pruebas manuales.

---

## 5. Resultado final

El updater oficial de Tauri queda **funcional de extremo a extremo**: detecta,
descarga, **verifica firma**, instala, reinicia, conserva los datos locales y lo
registra todo. Está demostrado con una actualización real 0.1.0 → 0.1.1 y con una
prueba de manipulación que se rechaza correctamente.

**El canal está PUBLICADO y probado contra GitHub** (ver §3.bis). La app instalada
se actualiza sola, sin variables de entorno.

Para publicar una versión nueva:

```bash
# 1. subir `version` en src-tauri/tauri.conf.json y Cargo.toml
export TAURI_SIGNING_PRIVATE_KEY="$(cat D:/empresas/Partnera/.secrets-tauri/creator-updater.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
export PARTNERA_UPDATE_OWNER=primebuildfit-lab PARTNERA_UPDATE_REPO=partnera
export CARGO_BUILD_JOBS=1          # obligatorio en esta máquina (LNK1102)
pnpm --filter @partnera/creator-desktop desktop:build

# 2. manifiesto (ya aplica el renombrado de assets de GitHub)
pnpm --filter @partnera/creator-desktop release:manifest \
  --base-url https://github.com/primebuildfit-lab/partnera/releases/download/partnera-creator-channel-stable

# 3. reemplazar los assets del canal rodante
gh release upload partnera-creator-channel-stable <exe> <exe>.sig creator-latest.json \
  --repo primebuildfit-lab/partnera --clobber

# 4. COMPROBAR que la URL del instalador devuelve 200 antes de fiarse
```

## 6. Posibles mejoras

- **Copia de seguridad de la clave privada fuera de la máquina.** Si se pierde,
  ninguna app instalada podrá volver a actualizarse. Es el riesgo más alto que
  queda.
- Confirmar a mano el flujo "esperar al usuario" en una máquina limpia.
- Publicar también `latest.json` por canal (estable/beta) si se quiere anillo de
  pruebas.
- Reanudar descargas interrumpidas (hoy se reinicia desde cero).
- Considerar armar el botón de instalar sólo tras una interacción real con la
  ventana (movimiento de ratón o tecla), en vez de por tiempo — es más robusto
  que el retardo de 1500 ms frente a clics automatizados.
