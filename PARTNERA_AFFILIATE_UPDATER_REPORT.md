# Partnera Affiliate — Auto-Updater oficial de Tauri

**App:** `apps/affiliate-desktop` (`com.partnera.affiliate`, "Partnera Affiliate")
**Fecha:** 2026-07-18
**Alcance:** SOLO esta aplicación. No se modificó ninguna otra app del ecosistema.
**Sistema:** `tauri-plugin-updater` 2.10.1 — updater **oficial** de Tauri. No se
escribió ninguna lógica propia de descarga, verificación ni instalación.

---

## 1. Resumen ejecutivo

La app ya tenía el plugin oficial instalado y un `updater.rs` mínimo, pero el canal
**no era funcional** y arrastraba un fallo de seguridad real: usaba la **clave de
firma de otra aplicación**. Se corrigieron cuatro problemas bloqueantes, se
construyó la experiencia de usuario completa y se validó con una **actualización
real 0.1.0 → 0.1.1 sobre la app instalada**, más una prueba de rechazo de paquete
manipulado.

**Resultado: el updater queda completamente funcional y probado.** Lo único que
falta es un paso humano (repo remoto + secret de CI + primer release publicado),
descrito en §7.

---

## 2. Configuración encontrada (auditoría)

| Elemento | Estado inicial | Veredicto |
|---|---|---|
| `tauri-plugin-updater` | `2` en `Cargo.toml`, plugin registrado en `lib.rs` | ✅ correcto |
| `plugins.updater.pubkey` | minisign `DF1AF6BDCBDDCE57` | ❌ **clave de Operations** |
| `plugins.updater.endpoints` | `…/releases/latest/download/affiliate-latest.json` | ⚠️ centinela + URL de canal insegura |
| `bundle.createUpdaterArtifacts` | ausente | ❌ nunca se generaba `.sig` |
| `plugins.updater.windows.installMode` | `passive` | ✅ correcto |
| `bundle.targets` | `nsis` | ✅ correcto |
| Versionado | `tauri.conf.json` / `Cargo.toml` / `package.json` = 0.1.0 | ✅ alineado, sin guardia |
| `identifier` | `com.partnera.affiliate` | ✅ único en el ecosistema |
| Capabilities | `default` (`core:default`, ventana `main`) | ✅ deny-by-default |
| Workflow de release | **no existía** para esta app | ❌ |
| GitHub Release / canal | no existe (el repo aún no tiene remoto) | ⚠️ bloqueante humano |
| UI de actualización | **ninguna** | ❌ |
| Flujo Rust | `check` → `download_and_install` → `app.restart()` | ⚠️ con código inalcanzable |

### Problemas detectados

1. **CRÍTICO — clave de firma compartida.** `affiliate`, `business` y `operations`
   compartían la clave minisign `DF1AF6BDCBDDCE57` (la de Operations). Con una clave
   compartida, un paquete firmado para un producto es aceptado como válido por el
   cliente de otro producto. Además **no había clave privada disponible** que
   correspondiera a esa pública para Affiliate (solo existían las de `creator` y
   `operations` en `.secrets-tauri/`, y `~/.partnera/updater.key` es la de Internal
   OS): el canal era, en la práctica, imposible de usar.

2. **Nunca se generaban artefactos firmados.** Sin `bundle.createUpdaterArtifacts`,
   `tauri build` no produce `.sig` ni manifiesto. Aunque el endpoint existiera, no
   había nada firmado que publicar.

3. **URL de canal insegura en un repositorio compartido.**
   `releases/latest/download/…` resuelve al release más reciente **del repositorio**,
   no del producto. Como varios productos Partnera publican desde el mismo repo, el
   primer release de una app hermana dejaría a los clientes de Affiliate leyendo un
   manifiesto ajeno o recibiendo 404. El propio workflow de Internal OS advierte de
   esto en un comentario, pero la URL no lo respetaba.

4. **Sin experiencia de usuario.** No había comprobación manual, ni progreso de
   descarga, ni mensaje de "ya está actualizada", ni de error. Agravante propio de
   esta app: es un *thin client* que navega a un portal remoto, así que la pantalla
   local desaparece tras el arranque y **no quedaba ningún punto de entrada** para
   que el usuario pidiera una comprobación.

5. **Código inalcanzable en el flujo de instalación.** El código llamaba a
   `app.restart()` después de `download_and_install()`. En Windows el plugin lanza el
   instalador y termina el proceso con `std::process::exit(0)`, de modo que esa línea
   nunca se ejecuta. No causaba un fallo, pero describía mal el reinicio real.

---

## 3. Cambios realizados

Todos dentro de `apps/affiliate-desktop/`, más un workflow nuevo y este reporte.

| Archivo | Cambio |
|---|---|
| `.secrets-tauri/affiliate-updater.key(.pub)` | **Nuevo par de claves dedicado** (minisign `9365EE8087376568`). Gitignored (`.gitignore:22`). |
| `src-tauri/tauri.conf.json` | `pubkey` → clave propia; `capabilities` → `["default","updater"]`. |
| `src-tauri/src/updater.rs` | Reescrito: máquina de estados completa, progreso, comandos, logging, política de auto-instalación. |
| `src-tauri/src/lib.rs` | Registra `UpdaterState` y los 4 comandos; menú **Ayuda** con "Buscar actualizaciones…" y "Ver logs". |
| `ui/updater.html` | **Nueva** ventana local de actualización (progreso, estados, errores). |
| `src-tauri/capabilities/updater.json` | **Nueva** capability, solo para la ventana `updater`. |
| `src-tauri/tauri.conf.release.json` | **Nuevo** overlay de CI con `createUpdaterArtifacts`. |
| `.github/workflows/release-partnera-affiliate.yml` | **Nuevo** workflow de release, firma y canal. |
| `README.md` | Sección de auto-update reescrita. |
| versiones | `0.1.0` → `0.1.1` en `tauri.conf.json`, `Cargo.toml` y `package.json`. |

**No se modificó ninguna otra aplicación.** El árbol de trabajo ya contenía 67
archivos modificados de antes (incluido `apps/internal-desktop/`); son previos a
este trabajo y se dejaron intactos.

---

## 4. Detalle técnico

### 4.1 Clave de firma dedicada

Se generó un par nuevo con `tauri signer generate`. La pública va en
`tauri.conf.json`; la privada solo existe en `.secrets-tauri/` (gitignored) y debe
cargarse en CI como `PARTNERA_AFFILIATE_SIGNING_KEY`.

### 4.2 Flujo (todo sobre la API oficial del plugin)

```
check() → Some(update) → download(on_chunk) → [verificación minisign] → install(bytes) → exit(0) → el instalador relanza la app
                      ↘ None → "La aplicación ya está actualizada."
```

Estados emitidos a la UI por el evento `updater://state`:
`checking · up-to-date · available · downloading · ready · installing · disabled · error`.

Se usan `download()` e `install()` **por separado** (no `download_and_install`) para
poder mostrar progreso y dejar que el usuario decida cuándo reiniciar.

### 4.3 Seguridad y rollback

`Update::download` verifica la firma minisign sobre los bytes descargados **antes**
de devolverlos, e `install()` solo recibe esos bytes verificados. Un paquete sin
firmar, manipulado o firmado con otra clave falla en la descarga y **nunca llega al
instalador**: la instalación existente queda exactamente como estaba. Ese es el
modelo de rollback — no se llega nunca a un estado a medio actualizar del que haya
que recuperarse. Verificado en §5.4.

La ventana `updater` recibe su propia capability con `core:default` y **ninguna**
permission `updater:*`: el plugin se maneja íntegramente desde Rust, así que la
página no puede disparar descargas ni instalaciones por su cuenta. La ventana `main`
(contenido remoto) no recibe esa capability.

### 4.4 Instalación y reinicio

En Windows el plugin entrega el paquete NSIS verificado al instalador con
`/UPDATE /ARGS` (modo `passive`) y termina el proceso con `std::process::exit(0)`;
el instalador relanza la app al terminar. Se eliminó el `app.restart()` inalcanzable
y se registró el hook `on_before_exit` para dejar traza justo antes de ceder el
control al instalador.

Los datos de usuario (logs, estado de ventana, sesión) viven en
`%APPDATA%\com.partnera.affiliate`, fuera del directorio de instalación, y sobreviven
a la actualización. Verificado en §5.3.

### 4.5 Canal de publicación

Los clientes instalados consultan el tag fijo
`partnera-affiliate-channel-stable`, que contiene solo `affiliate-latest.json` de
este producto. El workflow lo reapunta en cada release; las URLs de descarga dentro
del manifiesto apuntan a los assets inmutables de la release versionada. Esto evita
la colisión descrita en §2.3.

### 4.6 Corrección durante el trabajo

Se añadió una clave `$comment` documental dentro de `plugins.updater` y en el overlay
de release. El esquema de Tauri 2 **rechaza propiedades adicionales** y el build
falló con `Additional properties are not allowed ('$comment' was unexpected)`. Se
retiró de ambos y la documentación se movió a comentarios de Rust y al README. Nota
de ecosistema en §6.3.

### 4.7 Variables de entorno

| Variable | Momento | Efecto |
|---|---|---|
| `PARTNERA_UPDATE_ENDPOINT` | runtime | Sustituye la URL del manifiesto (pruebas E2E locales). |
| `PARTNERA_UPDATE_AUTOINSTALL` | runtime | `1` instala el paquete **ya verificado** sin esperar clic (despliegues gestionados). No omite la verificación de firma. |
| `PARTNERA_UPDATE_OWNER` / `_REPO` | build | Fijan el canal de GitHub. Por defecto `REPLACE_*` → updater deshabilitado honestamente. |

---

## 5. Pruebas

### 5.1 Comprobaciones estáticas

| Prueba | Resultado |
|---|---|
| `cargo check` | ✅ limpio |
| `cargo build --release` | ✅ |
| `pnpm typecheck` (monorepo) | ✅ |
| `pnpm lint` (monorepo) | ✅ 0 errores (3 warnings preexistentes en `packages/web`, ajenos) |
| `pnpm test` (monorepo) | ✅ **254/254** en 35 archivos |
| `tauri build --config src-tauri/tauri.conf.release.json` | ✅ **comando exacto del CI**: `Partnera Affiliate_0.1.1_x64-setup.exe` + `.sig` |
| `tauri build` (overlay E2E) | ✅ instalador NSIS + `.sig` para ambas versiones de prueba |

### 5.2 Actualización real 0.1.0 → 0.1.1 (la prueba principal)

Método: se compilaron y firmaron **dos versiones distintas** con la clave nueva; se
sirvió `affiliate-latest.json` + el paquete 0.1.1 desde `http://127.0.0.1:8799`; se
**instaló realmente la 0.1.0** y se lanzó apuntando a ese canal.

Log real de la app (`desktop.log`):

```
{"msg":"app.start"}
{"msg":"boot.navigate host=partnera-web-production.up.railway.app"}
{"msg":"updater.available version=0.1.1"}
{"msg":"updater.verified version=0.1.1 bytes=1826751"}
{"msg":"updater.autoinstall enabled"}
{"msg":"updater.installing version=0.1.1"}
{"msg":"app.start"}                  ← relanzada por el instalador
{"msg":"boot.navigate host=…"}
{"msg":"updater.up_to_date"}         ← ya en 0.1.1, se reporta al día
```

Peticiones registradas por el servidor: `affiliate-latest.json` (702 B) y
`Partnera-Affiliate_0.1.1_x64-setup.exe` (1 826 751 B).

Estado del sistema **antes → después**:

| Evidencia | Antes | Después |
|---|---|---|
| Registro `DisplayVersion` | `0.1.0` | **`0.1.1`** |
| `partnera-affiliate-desktop.exe` FileVersion | `0.1.0` | **`0.1.1`** |
| Proceso tras actualizar | — | relanzado automáticamente |

✅ Detección, verificación de firma, descarga, instalación y reinicio: **reales y
verificados sobre la app instalada**, no simulados.

### 5.3 Conservación de datos locales

Se creó `%APPDATA%\com.partnera.affiliate\e2e-marker.txt` antes de actualizar.
Después de la actualización el archivo seguía presente e íntegro (60 bytes, mismo
contenido), junto con `.window-state.json` y `logs/desktop.log`. ✅

### 5.4 Rechazo de paquete manipulado (prueba negativa)

Se publicó un manifiesto anunciando `0.1.2` cuyo binario fue **alterado**
(inyección de bytes en el offset 90000) conservando la firma del paquete legítimo.

```
{"msg":"updater.available version=0.1.2"}
{"msg":"updater.download_failed version=0.1.2 The signature verification failed"}
```

Estado tras el intento: `DisplayVersion=0.1.1`, `FileVersion=0.1.1`. ✅ El paquete
manipulado **se descargó pero se rechazó antes de instalarse**; la instalación quedó
intacta. Repetido con `PARTNERA_UPDATE_AUTOINSTALL=1`: también rechazado, es decir,
la auto-instalación **no** puentea la verificación.

### 5.5 Ventana de actualización

Con una actualización pendiente se enumeraron las ventanas visibles del proceso:

```
Partnera Affiliate
Actualizaciones — Partnera Affiliate
```

✅ La ventana local de actualización se crea y se muestra correctamente.

### 5.6 Frecuencia de comprobación

Una ejecución observada durante 30 s realizó **exactamente una** comprobación (sin
bucles de reintento), tanto con firma válida como con firma inválida. Un doble
chequeo observado en una pasada intermedia se reprodujo como un **segundo proceso
residual** de la prueba anterior, no como un reintento: la app no tiene guardia de
instancia única (ver §7).

### 5.7 Actualización real contra el canal de GitHub (HTTPS, producción)

Publicado el canal real, se repitió la prueba **sin servidor local**:

- Repo de código: `primebuildfit-lab/partnera` (**privado**).
- Repo de canal: `primebuildfit-lab/partnera-releases` (**público**, sin código).
- Release `partnera-affiliate-v0.1.2` + tag rodante `partnera-affiliate-channel-stable`.
- Manifiesto e instalador comprobados alcanzables **sin credenciales** (HTTP 200).

Log real de la app instalada 0.1.1:

```
{"msg":"updater.available version=0.1.2"}
{"msg":"updater.verified version=0.1.2 bytes=1826138"}
{"msg":"updater.installing version=0.1.2"}
{"msg":"app.start"}              ← relanzada por el instalador
{"msg":"updater.up_to_date"}
```

`DisplayVersion` y `FileVersion`: `0.1.1` → **`0.1.2`**. El archivo
`prueba-canal-real.txt` sobrevivió íntegro.

**Ruta de producción pura:** relanzada la 0.1.2 **sin ninguna variable de
entorno**, consulta el canal con el endpoint horneado en el binario
(`PARTNERA_UPDATE_OWNER/REPO`) y reporta `updater.up_to_date`. ✅ Esto elimina
las reservas de HTTPS y "canal real" que figuraban aquí.

> **Por qué el canal es público aunque el código sea privado:** GitHub sirve los
> assets de un release de un repo privado solo a llamadas autenticadas, y el
> updater descarga sin credenciales. Con todo privado las actualizaciones no
> bajarían. El repo público contiene únicamente instaladores firmados y
> manifiestos.

### 5.8 Qué NO se probó

- **Clic humano en "Reiniciar e instalar" y en Ayuda → Buscar actualizaciones…**: el
  manejador de menú y los comandos están cableados y la ventana se abre y renderiza
  (§5.5), pero la instalación se ejercitó por la vía `PARTNERA_UPDATE_AUTOINSTALL`,
  que llama exactamente al mismo comando `updater_install`. La ruta del clic en sí no
  se simuló.
- **El workflow de CI end-to-end**: la publicación de §5.7 se hizo con `gh` desde
  esta máquina, con los mismos comandos que ejecuta el workflow, pero **el workflow
  en sí no ha corrido nunca en Actions**. Le falta el secret
  `PARTNERA_RELEASES_TOKEN` (ver §7); sin él, el paso de publicación fallaría.
  Su YAML sí está validado (parsea, y los tres bloques `run` pasan `bash -n`).
- ~~HTTPS y canal real~~ → **ya probados** en §5.7.

---

## 6. Problemas de ecosistema (documentados, NO modificados)

> Afectan a otras apps. Siguiendo la instrucción, **no se tocó ninguna**.

**6.1 Claves de firma compartidas entre productos.** Tres apps comparten
`DF1AF6BDCBDDCE57`:

| App | Clave minisign |
|---|---|
| ~~affiliate~~ | ~~DF1AF6BD…~~ → **corregida a `9365EE80…`** |
| **business** | `DF1AF6BDCBDDCE57` ← compartida con operations |
| **operations** | `DF1AF6BDCBDDCE57` |
| creator | `6B86524DAB330F8B` (propia) |
| internal | `8ADBA54F419376D9` (propia) |

Recomendación: dar a `business` su propia clave antes de publicar cualquier release.
Mientras compartan clave, un paquete de Operations es criptográficamente válido para
un cliente de Business.

**6.2 URL de canal en repositorio compartido.** `apps/internal-desktop` (y el
`release-partnera-business.yml` no versionado que existe en el árbol) usan
`releases/latest/download/latest.json`. En un monorepo que publica varios productos,
eso rompe en cuanto un segundo producto publique. El patrón de tag rodante de §4.5
es una solución aplicable.

**6.3 `$comment` inválido en config de Tauri.**
`apps/internal-desktop/src-tauri/tauri.conf.release.json` contiene una clave
`$comment` en la raíz. El esquema de Tauri 2 rechaza propiedades adicionales; con la
CLI 2.x actual ese archivo **hará fallar el build de release de Internal OS** con
`Additional properties are not allowed`. No se modificó, pero conviene revisarlo
antes del próximo release de esa app.

**6.4 Higiene de builds.** Interrumpir un `tauri build` a mitad de la fase de
codegen dejó artefactos incrementales corruptos que después hicieron caer a `rustc`
con `STATUS_STACK_BUFFER_OVERRUN` de forma reproducible (dos veces). Un
`cargo build --release` completo los regeneró y el problema desapareció. También se
observó acumulación de procesos `cargo`/`rustc` huérfanos compitiendo por el lock del
`target/`. Si un build falla de forma extraña, comprobar procesos huérfanos y
reconstruir en limpio antes de sospechar del código.

---

## 7. Estado final y mejoras posibles

### Estado

El auto-updater oficial está **implementado, integrado y verificado con una
actualización real entre dos versiones distintas**, incluida la conservación de datos
y el rechazo criptográfico de paquetes manipulados.

**El canal está VIVO** (2026-07-19). Ya no es infraestructura dormida:

| Pieza | Estado |
|---|---|
| `primebuildfit-lab/partnera` (código, **privado**) | ✅ creado, rama subida |
| `primebuildfit-lab/partnera-releases` (canal, **público**) | ✅ creado |
| Secret `PARTNERA_AFFILIATE_SIGNING_KEY` | ✅ cargado en el repo de código |
| Release `partnera-affiliate-v0.1.2` + canal rodante | ✅ publicados |
| Actualización real por HTTPS desde GitHub | ✅ verificada (§5.7) |

**Falta un paso humano, uno solo:** crear el secret **`PARTNERA_RELEASES_TOKEN`**
(PAT con scope `repo` sobre `partnera-releases`) en
`primebuildfit-lab/partnera` → Settings → Secrets → Actions. El `GITHUB_TOKEN`
integrado solo alcanza al repo donde corre el workflow y no puede publicar en el
repo de releases, así que **sin ese secret el workflow falla en el paso de
publicación**. Deliberadamente no reutilicé el token OAuth de `gh` de esta máquina:
es de cuenta completa y de larga vida, y no corresponde dejarlo fijado como secret
de repositorio.

Hecho eso, el ciclo queda automático: etiquetar `partnera-affiliate-v<version>`
publica, firma y reapunta el canal, y las instalaciones existentes se actualizan
solas.

> ⚠️ **Copia de seguridad de la clave privada.** `.secrets-tauri/affiliate-updater.key`
> existe **solo en esta máquina** y está gitignored. Si se pierde, ninguna instalación
> existente aceptará nunca una actualización futura y habría que redistribuir la app a
> mano. Conviene respaldarla fuera del equipo antes del primer release.

### Mejoras posibles

1. **Guardia de instancia única** (como en `creator-desktop`): evita que dos copias
   comprueben y descarguen en paralelo.
2. **Comprobación periódica**, no solo al arrancar — útil en instalaciones que
   quedan abiertas días.
3. **Notas de versión enriquecidas**: la ventana ya muestra `notes` del manifiesto;
   basta con que el workflow publique un cuerpo con formato.
4. **Reintento con backoff** ante fallos de red transitorios (hoy se reporta el error
   y se espera a la siguiente comprobación).
5. **Firmar el instalador con un certificado Authenticode**, además de la firma
   minisign del updater, para eliminar el aviso SmartScreen de Windows.
6. **Rotación de la clave de `business`** (§6.1) antes de su primer release.
