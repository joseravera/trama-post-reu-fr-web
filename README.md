# Trama FR Assistant

Automatización del post-reunión de Fundraising de Trama ITBA. TP integrador de 81.76 — Tecnología para las finanzas.

El plan completo (alcance, arquitectura, contratos entre módulos, reparto de trabajo por persona y guion de
demo) está en [`plan-tp-trama-fundraising.md`](./plan-tp-trama-fundraising.md). **Leanlo primero** — este
README es solo el setup técnico del scaffold y asume que ya lo leyeron.

Quién hace qué (sección 3.6 y 5/6/7 del plan):

| Persona | Carpetas | Qué construye |
|---|---|---|
| **A** | `src/app/`, `src/ui/`, `src/extraccion/` | Web app, extracción con Gemini, orquestador del "Confirmar" |
| **B** | `src/crm/`, `src/sync/` | CRM en Sheets, máquina de estados, config, sync con Calendar/Gmail |
| **C** | `src/mail/`, `src/avisos/` | Template → borrador de Gmail, reglas de avisos, resúmenes, scheduler |

**Regla de oro:** cada una modifica solo su carpeta. `src/shared/` (los contratos que usamos las 3) se cambia
únicamente con PR aprobado por las otras dos.

**Estado actual (2026-11-22):** `src/crm/` y `src/sync/` (la parte de B) están implementados de verdad, no
son placeholders. `src/app/`, `src/ui/`, `src/extraccion/`, `src/mail/` y `src/avisos/` (A y C) siguen siendo
los stubs del scaffold inicial. Al implementar B hizo falta **agregar un método nuevo a `CrmService`** en
`src/shared/types.ts` (`registrarReunionCoordinada`, lo necesita el sync de Calendar) — queda marcado con un
comentario `⚠️` en el archivo. Avisar antes de resolver conflictos de merge ahí.

---

## 1. Prerrequisitos

- **Node.js 18+** y npm (`node -v` para chequear).
- Una cuenta de Google para loguearse con `clasp` (puede ser la de prueba del TP, no hace falta que sea la
  cuenta de Trama todavía).
- No hace falta instalar `clasp` global: el repo lo trae como dependencia y se corre con `npx clasp ...`.

## 2. Primer uso (clonar y verificar que todo anda)

```bash
git clone <url-del-repo>
cd trama-post-reu-fr
npm install
npm test          # corre los tests de Jest -> tienen que pasar los 3 suites
npm run typecheck # chequea tipos sin emitir -> no tiene que tirar nada
npm run build     # genera dist/Code.js (el bundle que después se sube a Apps Script)
```

Si las 3 cosas corren sin error, el scaffold está sano y pueden empezar a trabajar en su carpeta.

## 3. Scripts disponibles (`package.json`)

| Comando | Qué hace |
|---|---|
| `npm test` | Corre todos los tests de Jest (`*.test.ts` en `src/` y `test/`) |
| `npm run test:watch` | Jest en modo watch, para ir testeando mientras programan |
| `npm run typecheck` | `tsc --noEmit`, chequea tipos sin generar archivos |
| `npm run build` | `esbuild` bundlea `src/main.ts` → `dist/Code.js`, y copia los `.html` de `src/ui/` + `appsscript.json` a `dist/` |
| `npm run push` | `build` + `clasp push` (sube `dist/` a Apps Script) |
| `npm run open` | Abre el proyecto de Apps Script en el navegador |

## 4. Estructura del repo

```
src/
├── shared/      ← TODAS (PR aprobado por las otras 2): types.ts, constants.ts, clock.ts
├── app/         ← A: doGet, orquestador del "Confirmar"
├── ui/          ← A: HTML de la web app
├── extraccion/  ← A: cliente de Gemini, prompt, validación
├── crm/         ← B: CRM (Sheets), máquina de estados, historial, config
├── sync/        ← B: sincronización con Calendar y Gmail
├── mail/        ← C: template → HTML, borrador de Gmail, adjuntos
├── avisos/      ← C: reglas, escalamiento, resúmenes, notificador, scheduler
└── main.ts      ← bundlea todo y expone las funciones globales que necesita Apps Script
test/
├── fakes/       ← FakeCrmService y FakeMailService (ver sección 4 del plan)
└── *.test.ts    ← tests de integración entre módulos
```

Cada archivo nuevo arranca con un comentario `// Dueño: Persona X (sección Y del plan)` y, si todavía no
está implementado, tira `throw new Error('No implementado todavía')` con un `TODO` al lado explicando qué
va ahí. Son placeholders a propósito: **compilan y tipan bien**, así nadie se queda bloqueada esperando que
otra termine su parte, pero no hacen nada todavía.

Ya hay implementadas (de verdad, no placeholder) las piezas de lógica pura que el plan marca como
testeables desde el día 1, como ejemplo de cómo testear sin depender de Apps Script:

- `src/crm/maquinaEstados.ts` + su test — tabla de transiciones de la sección 3.5.
- `src/crm/sheetUtils.ts` + su test — mapeo de filas/columnas por encabezado, búsqueda, primera fila vacía.
- `src/crm/repo.ts` + su test — `normalizarNombreEmpresa`, el formato de línea de `Comentarios` con fecha,
  y el roundtrip fila del CRM ↔ valores de la hoja.
- `src/sync/matching.ts` + su test — a qué empresa corresponde un evento de Calendar (dominio del mail de
  un invitado, o nombre de la empresa en el título).
- `src/mail/fechas.ts` + su test — formato "de hoy" / "del martes 18/11" con huso horario.

El resto de `src/crm/` (`config.ts`, la orquestación de `repo.ts` que llama a `SpreadsheetApp`) y de
`src/sync/` (`calendar.ts`, `respuestasGmail.ts`, `triggersUsuario.ts`) está implementado pero depende de
`SpreadsheetApp`/`CalendarApp`/`GmailApp`/`ScriptApp` reales, así que no tiene test de Jest — se prueba con
`npm run push` contra el spreadsheet del proyecto (igual que piden los criterios de aceptación de B2 en el
plan). La lógica pura que sí se podía separar (el matching, el mapeo de filas) ya está afuera y testeada.

## 5. Cómo trabajar sin esperar a las demás (los fakes)

Mientras B no tiene lista la implementación real de `CrmService`/`MailService`, A y C pueden desarrollar y
testear contra los fakes de `test/fakes/`:

```ts
import { crearFakeCrmService } from '../test/fakes/fakeCrmService';
import { crearFakeMailService } from '../test/fakes/fakeMailService';

const crm = crearFakeCrmService();   // CRM en memoria, misma máquina de estados real
const mail = crearFakeMailService(); // devuelve HTML/links fake, sin tocar Gmail
```

`test/postReunion.test.ts` es un ejemplo completo de esto: ejercita el orquestador de A (`confirmarPostReunion`)
contra los dos fakes. Cuando B entregue el `CrmService` real (primero `buscarEmpresas`/`getFila`/`listarFilas`,
según la sección 6), se reemplaza el fake por el real sin tocar el resto del código — ese es el punto de
programar contra la interfaz de `src/shared/types.ts` y no contra la implementación.

## 6. Cómo está armado el build (por qué hay un `main.ts`)

Google Apps Script no soporta `import`/`export` en runtime: todo el código tiene que terminar en un único
archivo (`Code.js`) con funciones globales. Para no perder módulos de TypeScript normales mientras programamos:

1. Escribimos código normal, con `import`/`export` entre archivos de `src/`.
2. `src/main.ts` es el único punto que importa lo que un trigger o un endpoint de la UI necesita como
   función global (`doGet`, `instalarTriggersUsuario`, etc.) y lo cuelga en `globalThis` con
   `Object.assign(globalThis, { doGet, ... })`.
3. `esbuild` bundlea todo `src/main.ts` en un solo `dist/Code.js` (`npm run build`).
4. `npm run push` sube `dist/` (no `src/`) a Apps Script — por eso `.clasp.json` tiene `"rootDir": "dist"`.

**Ojo:** es `globalThis`, no `global` — `global` es un global de Node.js que **no existe** en el runtime V8
de Apps Script; si alguien lo usa por costumbre, la función no va a quedar expuesta y Apps Script no la va a
encontrar al correr el trigger ni al llamarla desde `google.script.run`.

Si agregan una función nueva que Apps Script necesita llamar por nombre (un trigger, algo que la UI invoca
con `google.script.run.miFuncion()`), hay que agregarla al objeto de `src/main.ts`. Los tests con Jest **no**
pasan por este build: corren directo sobre los `.ts` de `src/`.

## 7. Deploy a Apps Script (se hace una sola vez entre las 3, comparten el mismo proyecto)

1. `npx clasp login` (con la cuenta de Google que van a usar para el proyecto).
2. Crear el proyecto de Apps Script: `npx clasp create --type webapp --title "Trama FR Assistant"` — o pedir
   que agreguen como colaboradora a la que lo cree primero.
3. Completar el `scriptId` real en `.clasp.json` (lo da el paso anterior).
4. Completar el `SPREADSHEET_ID` real en `src/shared/constants.ts` — tiene que ser la **copia** del CRM,
   nunca el original (sección 3.3 del plan). Es el único lugar del código donde puede aparecer ese ID.
5. En el editor de Apps Script: **Configuración del proyecto → Script Properties** → agregar `GEMINI_API_KEY`.
6. `npm run push`.
7. Publicar la web app: **Implementar → Nueva implementación → Aplicación web**, ejecutar como
   *"El usuario que accede a la aplicación web"*, acceso según corresponda (dominio o cualquier cuenta).

## 8. Variables / IDs pendientes de completar

Nada de esto está en el scaffold todavía porque depende de recursos reales de Trama (hoja, Gemini, Docs):

| Dónde | Qué falta | Quién lo completa |
|---|---|---|
| `.clasp.json` → `scriptId` | ID del proyecto de Apps Script compartido | la que lo cree (paso 7.2) |
| `src/shared/constants.ts` → `SPREADSHEET_ID` | ID de la copia del CRM | B |
| Script Properties → `GEMINI_API_KEY` | API key de Gemini | A |
| Hoja `_Clubes` (la crea B, sección 6 B1) | ID del Doc template y de la carpeta de Drive por club | B |

`src/crm/config.ts` espera estos encabezados exactos (en minúscula) en las hojas de sistema:

| Hoja | Encabezados esperados |
|---|---|
| `_Usuarios` | `mail`, `nombre`, `club`, `rol` |
| `_Clubes` | `club`, `hoja`, `templateDocId`, `carpetaAdjuntosId`, `templatePingueoPrimerContactoDocId`, `templatePingueoPostReunionDocId` |
| `_Parametros` | `nombre`, `valor` |

`getParametro()` solo sirve para parámetros numéricos (`DIAS_PINGUEO_MAIL`, `PINGUEOS_ESCALA`, etc.). Para
`DIAS_ENVIO_AGENDA` (que es una lista como `"LUN,MIE,VIE"`, no un número), C tiene que leer `_Parametros`
directo o pedir que se ampíe `ConfigService` — el contrato actual lo tipa como `number`.

## 9. Convenciones de código (ya aplicadas en el scaffold, mantenerlas)

- Nunca `new Date()` directo: usar `now()` de `src/shared/clock.ts` (así el modo demo puede adelantar el reloj).
- Nunca `SpreadsheetApp.openById`/`openByUrl` salvo dentro de `abrirSpreadsheet()` (`src/crm/config.ts`).
- Columnas del CRM siempre por nombre de encabezado (`COLUMNAS_CRM` en `constants.ts`), nunca por índice fijo.
- Lógica que no necesita Apps Script va en un archivo separado y se testea con Jest (ver los ejemplos de la
  sección 4 de este README). Si una función necesita `SpreadsheetApp`/`GmailApp`/`UrlFetchApp`, no se puede
  testear directo con Jest — separar la parte pura (cálculo/validación) de la parte que llama a la API.

## 10. Problemas comunes

- **`Cannot find module './...'` al hacer `npm test`**: falta `npm install`, o el import tiene mal la ruta
  relativa (recordar que `test/` está un nivel afuera de `src/`).
- **`clasp push` sube archivos de más o de menos**: revisar que `.clasp.json` tenga `"rootDir": "dist"` y que
  hayan corrido `npm run build` antes (`npm run push` ya lo hace solo).
- **Un trigger/función no aparece en el editor de Apps Script**: falta agregarla al objeto que se asigna a
  `globalThis` en `src/main.ts` (ver sección 6) — y confirmar que es `globalThis`, no `global`.
- **Error de tipos al importar algo de `shared/types.ts`**: probablemente alguien cambió `shared/` sin PR
  aprobado por las otras 2 — avisar antes de pisarlo.
