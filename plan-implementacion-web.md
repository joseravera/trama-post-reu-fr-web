# Plan — Trama FR Assistant (web) sobre el Apps Script y CRM nuevos

> Documento vivo: lo vamos refinando. Última actualización: 25/11/2026 (fases 1 y 2 hechas, deploy publicado).

## 1. Objetivo

Llevar el sistema que ya tenemos (web app post-reunión + seguimientos + avisos) a:

| | Valor |
|---|---|
| Apps Script | **Trama FR Assistant - web** — `1jyOTOto-SglFtbi1Ne-FOR7GKidCcYFMGhDn0BhyUxAMKLeEegOjbVX2` |
| CRM (solo las hojas de cada club) | **Copia de 💸 Contactos '26-'27 💸** — `1OERRE_Z03hhWMnMYfGl9bj130eKJfeTH2ytUJEXKcaA` |
| Configuración del sistema (usuarios, clubes, parámetros, logs) | **.config** — `1LfHeTQ9HrjPrX-MtHugN18j_keWi6vu5ghtONbUt2bo` |
| Fuente de usuarios (solo lectura, para armar `_Usuarios`) | **Datos Equipo '26-'27** — `1NIKz8GhxrNTLuGcUfrYHEYK803Fpw-UP5-sRNANdA4U` (hoja `Equipo '26 - '27`) |

`.clasp.json`, `SPREADSHEET_ID` y `CONFIG_SPREADSHEET_ID` (`src/shared/constants.ts`) apuntan al
Apps Script, al CRM y a `.config` nuevos.

## Estado (25/11/2026)

| Fase | Estado |
|---|---|
| 1. Configuración (`.config` + CRM) | ✅ hecha |
| 2. Cambios de código (4.1 a 4.10) | ✅ hechos, 204 tests de Jest pasando |
| 3. Deploy | 🟡 código subido y web app publicada; faltan los pasos manuales de la sección 5 |
| 4. Pruebas con usuarios reales | ⏳ pendiente |

**Regla:** en el CRM no se agrega ninguna hoja. Todo lo que es del sistema vive en `.config`, que
no es una planilla de trabajo del equipo, así nadie lo toca "de pasada".

### Alcance

- **Se cargan los usuarios de todos los clubes** (codirectoras, coordinadores y FR).
- **Se implementa a full solo para Emprendedores**: es el único club con templates de mail, carpeta de
  adjuntos y templates de pingueo. Los otros clubes quedan dados de alta pero sin templates; no es
  objetivo de esta etapa que generen borradores de mail.
- La hoja **`Codis`** del CRM se ignora por ahora (el sistema no la lee ni la escribe).

## 2. Usuarios (`_Usuarios`)

Formato: `mail | nombre | club | rol | admin`. Mail = columna "MAIL ITBA" de la planilla de equipo, en
minúscula. Nombre = "NOMBRE Y APELLIDO" sin espacios/tabs sobrantes. `admin` = `TRUE` solo para
quien tenga acceso total (ver 2.1); vacío para el resto.

Reglas de mapeo desde la planilla de equipo:

| Planilla de equipo | `_Usuarios` |
|---|---|
| Bloque "Directoras" | `rol = Codirectora`, `club` vacío |
| ROL "Coordinador" / "Coordinadores" | `rol = Coordinador` |
| ROL "Fundraising" | `rol = FR` |
| ROL "Equipo" (Lab y Consultoría, que no tienen sub-equipo de FR) | `rol = FR` |
| ROL "Workshops" / "Recruiting" | no se cargan |
| CLUB "Lab" | `club = Trama Lab` |

Resultado (23 usuarios):

| Club | Codirectora | Coordinador | FR |
|---|---|---|---|
| — | Faustina Arecco, Pilar Bertani | | |
| Emprendedores | | Martin Isaac Bargach Mitre, Josefina Ravera | Juan Grispo, Lisandro Galceran, Martin Mejliker |
| Agro | | Lucas Ponzio Nasjleti, Matilde Campasso | Agustin Zannier, Cruz Rosolen, Tomas Jaureguialzo |
| Finanzas y Tecnología | | Ioel Merkier, Victoria Verónica Gaude Negri | Facundo Latorre Martin, Constanza Navarrine |
| Consultoría | | Ignacio Burgos | Maria del Milagro Biondi Sirena, Felipe Manuel Romero Victorica, Julián Yaregui Murphy |
| Trama Lab | | Joaquín de Alba | Renata Massolo, Maria del Pilar Navarro |

> ⚠️ El nombre en `_Usuarios` tiene que coincidir con lo que se escribe en la columna
> "Tramero encargado" del CRM: con eso se arman los seguimientos de cada FR y se resuelven los
> destinatarios de los avisos (ver 4.4).

### 2.1 Admin (acceso total, para implementación y testeo)

**Josefina Ravera** tiene `admin = TRUE`, además de su rol de Coordinador de Emprendedores.

Se modela como una columna aparte y no como un rol nuevo para que siga siendo coordinadora: los
resúmenes y escalamientos de Emprendedores la siguen incluyendo (`getUsuarios({ rol: 'Coordinador', club })`).

Qué habilita `admin`:

- Elegir y operar sobre **cualquier club**, igual que una codirectora (`clubesDe` en `src/app/webapp.ts`).
- Todo lo que hoy la UI deja solo a codirectoras (ej. el campo editable de `src/ui/client.js.html`).
- **"Ver como" otro usuario**: elegir a cualquier FR/coordinador/codirectora de `_Usuarios` y ver la
  app como esa persona (sus seguimientos, su club), para probar sin pedirle la cuenta a nadie.
  - Se ve siempre un aviso de que estás viendo como otra persona, con un botón para volver a tu usuario.
  - Lo que se guarda en el CRM mientras estás en "ver como" queda registrado a nombre de esa
    persona (ej. "Tramero encargado"), igual que si lo hubiera cargado ella; en `_Historial` se
    anota además que lo hizo el admin.
  - Los borradores de mail se crean en **tu** Gmail (Apps Script corre con la cuenta de quien usa
    la app), no en el de la persona elegida.
- No cambia a quién le llegan los avisos: el admin no recibe los resúmenes de codirectoras.

Para sacarle el acceso total alcanza con vaciar la celda `admin`.

## 3. Configuración (Fase 1 — sin código)

### 3.1 Spreadsheet `.config` — ✅ cargado el 25/11/2026

1. **`_Usuarios`** — la tabla de la sección 2 (23 filas, `admin = TRUE` para Josefina Ravera).
2. **`_Clubes`** — `club | hoja | templateDocId | carpetaAdjuntosId | templatePingueoPrimerContactoDocId | templatePingueoPostReunionDocId`
   - Emprendedores: mismos IDs que en el CRM anterior
     (`1NJcAAtWhswZYh-OO9fk_y94wpqeMHZT4-wRIZ7bQnZA`, `18zl24IV0WC3MITh7GI2tR41DQo_9Hc52`,
     `1CmQmpS793sCON0_gwL4x_mG6-GL6HOL9ziDd3oQkG8M`, `1WBmUhizZZddhwZkCwQrD1NJepSCoIuYiCHHZUG3Yx0U`).
   - Agro, Consultoría, Finanzas y Tecnología, Trama Lab: fila con `club` y `hoja`, resto vacío.
   - Columna **`activo`**: `TRUE` solo para Emprendedores (ver 4.7).
3. **`_Parametros`** — `nombre | valor`, copiado del CRM anterior:

   | nombre | valor |
   |---|---|
   | DIAS_PINGUEO_MAIL | 7 |
   | DIAS_COORDINAR | 3 |
   | HORAS_CARGA_POST | 24 |
   | DIAS_SEGUIMIENTO | 7 |
   | DIAS_TRATATIVAS_FR | 5 |
   | DIAS_TRATATIVAS_ESCALA | 14 |
   | PINGUEOS_ESCALA | 2 |
   | DIAS_VENCIDO_ESCALA | 3 |
   | DIAS_ENVIO_AGENDA | LUN,MIE,VIE |
   | DIA_ENVIO_FR | LUN |

4. **`_LogAvisos`** — encabezado `clave | timestamp | tipo | club | empresa | destinatarios | estado`.
5. **`_Snapshot`** (`club | empresa | estado | timestamp`) y **`_Historial`** (`timestamp | club | empresa | fr | tipo | estadoAnterior | estadoNuevo | origen`), creadas vacías.
6. Protecciones aplicadas (ver 3.3): todo menos `_Historial`, con Josefina como única editora.

### 3.2 CRM — ✅

- **Emprendedores**: ya tiene la columna **"Pingueos sin respuesta"** (P). También tiene columnas
  propias ("Es traspaso?", "Comentarios FRs viejos") que el sistema no toca (ver 4.1).
- Ninguna hoja nueva en el CRM.

### 3.3 Permisos

La web app corre como el usuario que entra (`executeAs: USER_ACCESSING`), así que cada usuario
necesita acceso propio a los dos spreadsheets:

| Spreadsheet | Quién | Acceso |
|---|---|---|
| CRM | todos los de `_Usuarios` | editor (ya lo tienen hoy para trabajar) |
| `.config` | todos los de `_Usuarios` | editor: al confirmar un post-reunión el sistema escribe en `_Historial` con la cuenta del usuario |
| `.config` | Josefina | dueña |

Para que nadie edite la configuración a mano aunque tenga acceso de editor:

| Hoja | Quién la escribe | Protección |
|---|---|---|
| `_Usuarios`, `_Clubes`, `_Parametros` | nadie (el sistema solo las lee) | solo Josefina |
| `_LogAvisos` | triggers centrales de avisos (corren con la cuenta de Josefina) | solo Josefina |
| `_Snapshot` | trigger diario de historial (cuenta de Josefina) | solo Josefina |
| `_Historial` | cada usuario al confirmar un post-reunión | sin proteger: si se protege, el post-reunión falla |

- Requisito: los triggers centrales (avisos y diario de historial) los instala Josefina.
- `_Historial` queda editable para todos: no es configuración, es un log; lo peor que puede pasar es
  que alguien lo ensucie a mano, sin efecto sobre cómo funciona el sistema.
- No difundir el link de `.config`: el sistema lo abre por ID, la gente no necesita abrirlo nunca.

## 4. Cambios de código (Fase 2)

### 4.1 Guardar una fila ya no pisa columnas que el sistema no conoce — ✅

`escribirFila` (`src/crm/repo.ts`) escribe solo las celdas de `COLUMNAS_CRM`, en tramos de
columnas contiguas (`celdasDesdeFilaCRM` + `tramosDeEscritura`). "Es traspaso?", "Comentarios FRs
viejos" y cualquier columna nueva de un club quedan como estaban.

Además:
- Una empresa nueva va a la primera fila con "Empresa" vacía (antes buscaba una fila 100% vacía,
  y en Emprendedores todas las filas tienen la casilla "Es traspaso?" en FALSE).
- Las fechas escritas a mano como `dd/mm/yyyy` se leen bien (`parsearFechaCelda`).

### 4.2 Estados de traspaso

Emprendedores usa estados que la máquina de estados no conoce. Se agregan como estados válidos:

- `FR viejo mando el mail de traspaso`
- `Respondió traspaso`

✅ Cambios en `Estado` (`src/shared/types.ts`), `ESTADOS` (`src/shared/constants.ts`),
`TRANSICIONES` (`src/crm/maquinaEstados.ts`), colores (`styles.html` y `plantillaMail.ts`, los
mismos que "Mail enviado" / "Mail respondido") y tests. Transiciones:

| Desde | Hacia |
|---|---|
| FR viejo mando el mail de traspaso | Respondió traspaso, Reunión coordinada, No va a ser sponsor |
| Respondió traspaso | Mail enviado, Reunión coordinada, No va a ser sponsor |

Avisos (`src/avisos/reglas.ts`):
- "FR viejo mando el mail de traspaso" sin respuesta después de `DIAS_PINGUEO_MAIL` → aviso de
  pinguear (template de primer contacto), igual que "Mail enviado".
- "Respondió traspaso" sin reunión después de `DIAS_COORDINAR` → aviso de pinguear para coordinar,
  igual que "Mail respondido".
- Como las filas de traspaso solo tienen "Fecha primer contacto", se usa esa fecha si no hay
  "Fecha último contacto".

Un estado escrito a mano que no existe (ej. "Respondió mail") ya no rompe nada: se trata como una
empresa sin estado (solo admite los estados iniciales) y no cuenta en el embudo del resumen.

### 4.3 "Pingueos sin respuesta" tolerante — ✅

Si una hoja de club no tiene la columna, se lee como 0 y no se escribe.

### 4.4 Matching de "Tramero encargado" ↔ usuario — ✅

`mismoNombre` (`src/shared/nombres.ts`). Antes se comparaba por nombre exacto (`armarSeguimientos` en `src/app/webapp.ts`, `mailDeFr` en
`src/avisos/reglas.ts`). Normalizar en ambos lados: trim, espacios/tabs múltiples, mayúsculas y
tildes. Test de Jest con casos como `"Joaquín de Alba "` vs `"Joaquin de Alba"`.

### 4.5 Dos spreadsheets: CRM y `.config` — ✅

Antes todo pasaba por `abrirSpreadsheet()` (`src/crm/config.ts`) con un único `SPREADSHEET_ID`. Cambio:

- `src/shared/constants.ts`: `SPREADSHEET_ID` (CRM) + `CONFIG_SPREADSHEET_ID = '1LfHeTQ9HrjPrX-MtHugN18j_keWi6vu5ghtONbUt2bo'`.
- `src/crm/config.ts`: dos funciones, `abrirCrm()` y `abrirConfig()`, siguen siendo el único lugar
  con `SpreadsheetApp.openById`.
- Hojas de club (`src/crm/repo.ts`) → `abrirCrm()`.
- `_Usuarios`, `_Clubes`, `_Parametros` (`config.ts`), `_Historial`, `_Snapshot` (`historial.ts`) y
  `_LogAvisos` (`logAvisos.ts`) → `abrirConfig()`.
- `URL_CRM` (`src/app/postReunion.ts`) sigue apuntando al CRM.
- `_Usuarios` ahora tiene la columna `admin` (ver 4.6).

### 4.6 Admin — ✅

- `Usuario` (`src/shared/types.ts`): campo `admin: boolean`. `leerUsuarios` (`src/crm/config.ts`)
  lee la columna `admin` (si no existe, `false` para todos).
- `clubesDe` (`src/app/webapp.ts`): `admin` → los 5 clubes, igual que `Codirectora`.
- `src/ui/client.js.html`: donde hoy se chequea `rol === 'Codirectora'`, aceptar también `admin`.
- "Ver como":
  - Backend: el usuario elegido se guarda en las propiedades de la cuenta del admin
    (`UserProperties`, clave `VER_COMO`). `usuario()` en `crearEndpoints` (`src/app/webapp.ts`)
    lo lee solo si la cuenta real es admin y devuelve a la persona elegida marcada con
    `verComoPor`. Todos los endpoints pasan por ahí, así que no hubo que tocarlos uno por uno.
    Si un no admin tiene algo guardado, se ignora.
  - Endpoints nuevos `listarUsuarios()` y `verComo(mail | null)` (solo admin), expuestos en
    `src/main.ts` y `src/entrypoints.js`.
  - `_Historial`: columna `hechoPor` con el mail del admin cuando la acción se hizo en "ver como".
  - UI: selector arriba de las pestañas, visible solo para admin, con "Volver a mi usuario",
    armado con `.aviso`, `.control` y `.btn` de `styles.html` (sin estilos nuevos). Al cambiar de
    usuario se recarga el contexto sin recargar la página.
  - Tests de Jest: admin puede ver como otro; no-admin recibe error; sin "ver como" todo sigue igual.

### 4.7 Clubes activos para avisos — ✅

Columna `activo` en `_Clubes` (ya cargada: `TRUE` solo Emprendedores). Los triggers centrales solo
trabajan con los clubes activos; para sumar otro club alcanza con poner `TRUE`.

- `ConfigService`: `getClubesActivos(): Club[]` (si la columna no existe, todos activos).
- `ejecutarEnvioAgendaYAvisos` (`src/avisos/scheduler.ts`): evalúa reglas, escalamientos y
  resúmenes de coordinador solo para clubes activos; el resumen de codirectoras solo incluye
  clubes activos.
- `detectarCambiosManuales` (`src/crm/historial.ts`): solo clubes activos.
- `sincronizarCalendar` y `sincronizarRespuestasGmail`: no corren para usuarios de clubes inactivos.
- La web app no cambia: todos los usuarios siguen pudiendo entrar y operar su club.

### 4.8 Avisos a FR una vez por semana — ✅

Hoy todos los avisos salen lunes, miércoles y viernes. Cambio:

| Destinatario | Qué recibe | Cuándo |
|---|---|---|
| FR | sus avisos (cargar post-reunión, pinguear, seguimiento vencido, compromisos de Trama), en un solo mail | 1 vez por semana: `DIA_ENVIO_FR` (lunes) |
| Coordinadores | escalamientos | lunes, miércoles y viernes (`DIAS_ENVIO_AGENDA`), sin cambios |
| Coordinadores y codirectoras | resumen semanal | lunes, sin cambios |

- Nuevo parámetro `DIA_ENVIO_FR` en `_Parametros` (ya cargado: `LUN`).
- `ejecutarEnvioAgendaYAvisos`: los avisos de `TIPOS_PARA_FR` (`src/avisos/reglas.ts`) solo se
  mandan si hoy es `DIA_ENVIO_FR`; los de `TIPOS_PARA_CLUB` siguen con `DIAS_ENVIO_AGENDA`.
- Revisión de reglas para el mail semanal: post-reunión sin cargar, pinguear y escalamientos ya
  se repiten mientras sigan pendientes. Se ajustaron las dos que miraban una ventana corta:
  - Seguimiento vencido: avisa lo que vence hasta el próximo mail (una semana), no hasta el
    próximo lun/mié/vie.
  - Compromiso de Trama: avisa lo que vence desde hoy hasta el próximo mail ("Hoy / Mañana / En N
    días vence…"), no solo lo que vence mañana.

### 4.9 Respuesta a un traspaso: pasar a "Respondió traspaso" automáticamente — ✅

Hoy `sincronizarRespuestasGmail` (`src/sync/respuestasGmail.ts`) corre cada 1 hora con la cuenta de
cada usuario: para cada empresa no final de su club busca en su Gmail mails `from:` el mail de la
empresa de los últimos 2 días, y si hay uno más nuevo que "Fecha último contacto" llama a
`registrarRespuesta` (`src/crm/repo.ts`), que hace `Mail enviado` → `Mail respondido`, pone
pingueos en 0, actualiza la fecha y registra el evento en `_Historial` con origen `GMAIL`.

Se usa **el mismo trigger** (no uno nuevo): ya recorre todas las empresas no finales, así que solo
hay que ampliar qué estado pasa a cuál. Un segundo trigger repetiría las mismas búsquedas en Gmail
y gastaría cuota.

Cambio en `registrarRespuesta`: reemplazar el `if` por una tabla de "estado al recibir respuesta":

| Estado actual | Al llegar un mail de la empresa |
|---|---|
| Mail enviado | Mail respondido |
| FR viejo mando el mail de traspaso | Respondió traspaso |
| cualquier otro | queda igual (solo se actualiza fecha y pingueos) |

Ajustes necesarios para que funcione con los datos reales de Emprendedores:

1. **Varios mails en la celda.** En los traspasos casi todas las filas tienen 2 o 3 mails separados
   por coma, `;`, `/`, "y" o salto de línea (ej. `aferrara@pampa.com, asottile@pampa.com`). Hoy
   eso arma un `from:` inválido y nunca encuentra nada. Extraer todas las direcciones de la celda
   y buscar `from:(a OR b OR c)`. Función pura con test de Jest.
2. **De quién es el Gmail que se revisa.** El trigger lee el Gmail de cada usuario de la app que
   ya entró al menos una vez. Si la empresa le responde al FR nuevo (o lo pone en copia), se
   detecta. Si le responde solo al FR viejo, que no está en la app, no hay forma de verlo: ese
   caso se sigue cambiando a mano (y el trigger diario lo registra como cambio manual).
3. **Solo clubes activos**, igual que 4.7, para no cambiar estados automáticamente en clubes que
   todavía no usan el sistema.

Implementado con `ESTADO_AL_RESPONDER` (`src/crm/maquinaEstados.ts`) y `extraerMails` /
`consultaRespuestas` (`src/sync/mailsContacto.ts`). Además, solo cuentan los mensajes cuyo
remitente es la empresa (un hilo puede tener mensajes nuestros). El sync de Calendar también usa
todos los mails de la celda para reconocer a la empresa entre los invitados.

### 4.10 El encargado contesta un traspaso: pasar a "Mail enviado" automáticamente — ✅

Mismo trigger de cada hora (`sincronizarRespuestasGmail`). Para cada empresa en
**"Respondió traspaso"**, si el tramero encargado le escribió a la empresa (en Para o en CC)
**después** de la respuesta de la empresa, la fila pasa a **"Mail enviado"**, con pingueos en 0,
"Fecha último contacto" = fecha de ese mail, y el evento en `_Historial` (`CAMBIO_ESTADO`, origen
`GMAIL`). A partir de ahí sigue el flujo normal: si la empresa vuelve a escribir → "Mail
respondido"; si no, a los `DIAS_PINGUEO_MAIL` aviso de pinguear.

Dónde se ve ese mail:
- En la casilla del **tramero encargado** (sus enviados).
- En la casilla de un **coordinador del club o una codirectora** que estaba en copia. Para eso el
  trigger de Gmail ahora también corre para las codirectoras (sobre todos los clubes activos).
  Cada persona tiene que haber entrado a la app al menos una vez.

Detalles:
- El mail del encargado sale de `_Usuarios` buscando el nombre de "Tramero encargado"
  (`mismoNombre`).
- Para que "después de la respuesta" funcione aunque las dos cosas pasen dentro de la misma
  hora, "Fecha último contacto" ahora guarda la fecha real del mail de la empresa (antes, la
  hora en que corría el trigger). Se pide 1 minuto de diferencia para no registrar dos veces el
  mismo mail.
- Código: `ESTADO_AL_ESCRIBIR_ENCARGADO` (`src/crm/maquinaEstados.ts`),
  `CrmService.registrarMailDelEncargado` (`src/crm/repo.ts`), `consultaEnviosA` / `ultimaFecha` /
  `esPosterior` (`src/sync/mailsContacto.ts`), `src/sync/respuestasGmail.ts`.

## 5. Deploy (Fase 3)

1. ✅ Código subido (`clasp push`).
2. ✅ Web app publicada (versión 2, mismo link):
   `https://script.google.com/a/macros/itba.edu.ar/s/AKfycbzQoDFbqRGxBn_LabrwLdfohoknts1EKYPm1aqUxzmohEuQVLL_NHfV9y_k_n3-QV_x/exec`
3. ⏳ **Josefina**: en el editor de Apps Script, Configuración del proyecto → Propiedades de la
   secuencia de comandos → agregar `GEMINI_API_KEY`.
4. ⏳ **Josefina**: en el editor, correr `instalarTriggersCentrales` (avisos, todos los días 9:00) y
   `instalarTriggerDiarioHistorial` (6:00). La primera vez pide autorización. Tienen que quedar a
   nombre de Josefina (ver 3.3).
5. ⏳ **Josefina, a mano**: compartir `.config` como editor con los de `_Usuarios` (ver 3.3). Nadie más lo comparte, tampoco Claude.
6. ⏳ Entrar primero Josefina (prueba como admin), después pasar el link a Emprendedores. Cada
   usuario autoriza los permisos en su primer ingreso y se le instalan los triggers de Gmail y
   Calendar. Para que se detecten las respuestas a traspasos, Martin Mejliker y Lisandro
   Galceran tienen que entrar al menos una vez.

Para actualizar el código más adelante:

```
npm run build          # en Windows el paso build:assets falla (usa mkdir -p / cp): correrlo en Git Bash
npx clasp push --force
npx clasp deploy -i AKfycbzQoDFbqRGxBn_LabrwLdfohoknts1EKYPm1aqUxzmohEuQVLL_NHfV9y_k_n3-QV_x -d "descripción"
```

`clasp push` alcanza para los triggers (corren la última versión guardada). La web app usa la
versión de la implementación: hay que hacer `clasp deploy -i …` con el mismo ID para que el link no
cambie.

## 6. Pruebas (Fase 4)

- [ ] Admin (Josefina): ve y opera los 5 clubes, puede "ver como" otro usuario y sigue
      recibiendo el resumen de coordinador de Emprendedores.
- [ ] "Ver como" Martin Mejliker: aparecen sus seguimientos; al guardar, "Tramero encargado" queda
      a su nombre y `_Historial` registra al admin; "Volver" restaura tu usuario.
- [ ] Un usuario no-admin no puede usar "ver como" (ni llamando al endpoint a mano).
- [ ] Codirectora: ve y puede elegir los 5 clubes.
- [ ] Coordinador de Emprendedores: solo Emprendedores; recibe el resumen de coordinador.
- [ ] FR de Emprendedores (ej. Martin Mejliker): ve sus seguimientos (las empresas de traspaso).
- [ ] Post-reunión completo en Emprendedores: extracción con Gemini → CRM actualizado → borrador de mail.
- [ ] Después de guardar, la columna "Es traspaso?" sigue intacta.
- [ ] Cambio de estado desde/hacia los estados de traspaso.
- [ ] Una empresa en "FR viejo mando el mail de traspaso" responde al FR nuevo: en menos de 1 hora pasa a
      "Respondió traspaso", con pingueos en 0 y el evento en `_Historial` (origen `GMAIL`).
- [ ] Lo mismo con una fila que tiene varios mails en la celda.
- [ ] Una empresa en "Respondió traspaso": el encargado le contesta (con un coordinador en copia).
      En menos de 1 hora pasa a "Mail enviado", con el evento en `_Historial` (origen `GMAIL`).
- [ ] Si el encargado le escribió antes de que la empresa respondiera, no cambia a "Mail enviado".
- [ ] FR de otro club entra sin error (aunque no tenga template de mail).
- [ ] Con solo Emprendedores activo, no salen avisos ni resúmenes de otros clubes.
- [ ] Los FR reciben un único mail los lunes; miércoles y viernes solo salen escalamientos a coordinadores.
- [ ] Avisos: llegan a los mails correctos y se registran en `_LogAvisos` de `.config`.
- [ ] Después de un post-reunión, el CRM sigue sin hojas nuevas; el evento queda en `_Historial` de `.config`.
- [ ] Un usuario no admin no puede editar `_Usuarios`/`_Clubes`/`_Parametros` a mano.

## 7. Pendientes / a definir

- `Respondió mail` aparece en Emprendedores pero no es un estado válido: ¿se corrige a mano a
  `Mail respondido` en la hoja o se agrega como sinónimo? (Mientras tanto no rompe nada, ver 4.2.)
- La hoja `Codis` queda fuera por ahora; definir más adelante si se integra.
- Templates y carpetas del resto de los clubes, cuando se extienda más allá de Emprendedores.
