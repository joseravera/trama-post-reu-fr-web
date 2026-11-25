# TP Integrador — Automatización del post-reunión de Fundraising (Trama ITBA)

**Materia:** 81.76 — Tecnología para las finanzas
**Integrantes:** 3 (Persona A, **Persona B: jravera@itba.edu.ar**, Persona C)
**Nombre de trabajo del sistema:** *Trama FR Assistant*

---

## 1. Resumen

Los equipos de Fundraising (FR) de los 5 clubes de Trama tienen reuniones con decenas de empresas. Después de cada reunión, un FR hoy hace a mano:

1. Lee las notas que tomó Granola.
2. Escribe el mail de agradecimiento y resumen a partir del template del club.
3. Adjunta el Plan de Beneficios (PDB) y el material del evento.
4. Carga o actualiza la fila de la empresa en el CRM (Google Sheets).
5. Se acuerda (o no) de volver a contactar a la empresa en la fecha acordada.

Y los coordinadores y codirectoras no tienen una forma rápida de saber cómo viene el fundraising de cada club.

**El sistema automatiza ese post-reunión:**

- El FR pega las notas de Granola en una **interfaz web propia**.
- Un **LLM** extrae los datos de la reunión (persona, rol, mail, compromisos, próxima acción, estado sugerido).
- El FR **revisa y corrige** lo extraído en la misma interfaz y confirma.
- El sistema **actualiza el CRM** y deja un **borrador del mail en el Gmail del FR**, con el template del club y los adjuntos.
- Un motor de **avisos** recuerda los seguimientos al FR, **escala** al coordinador cuando una empresa queda trabada y manda **resúmenes semanales** a coordinadores y codirectoras.

### Decisiones de alcance (ya acordadas)

| Decisión | Motivo |
|---|---|
| Granola se usa en versión gratuita → **las notas se copian y pegan** | La API de Granola solo está disponible en planes pagos |
| **No** se detectan superposiciones entre clubes ni se usa el historial de sponsoreo | Ya lo resuelve el proceso de Trama; el sistema se enfoca en el post-reunión |
| El mail **nunca se envía solo**: queda como borrador | Un mail generado por un LLM a un sponsor tiene que pasar por revisión humana |
| Se **eliminan** los estados "Primer pingueo" y "Segundo pingueo" del desplegable; los pingueos se cuentan en la columna **"Pingueos sin respuesta"** | Pinguear no es una etapa del proceso: es una cantidad, y puede pasar en cualquier etapa |
| El LLM solo hace lo que requiere entender texto; **lo que se puede calcular, lo calcula el código** | Menos superficie para alucinaciones, resultados reproducibles |
| Todos los **avisos son por mail** (sin Telegram ni otros canales) | Todos los miembros de Trama ya usan mail; no requiere registro ni integraciones extra |
| Si la **fecha de próxima acción se pasó hace 3 días** sin contacto, se avisa a los **coordinadores del club** | Que ninguna empresa quede olvidada aunque el FR no haga el seguimiento |

---

## 2. Cumplimiento de la consigna

| Requisito del TP | Cómo se cumple |
|---|---|
| Automatizar un proceso **real** | El post-reunión de los FR de Trama, con la estructura del CRM real de la organización (trabajando sobre una copia) |
| Integración con **APIs** | Google Sheets, Gmail, Drive, Calendar y Gemini (LLM) |
| **Procesa datos** | Notas no estructuradas → datos estructurados validados → CRM, historial de eventos, métricas |
| Ayuda a la **toma de decisiones** | Recordatorios con acción concreta, escalamiento de empresas trabadas, resumen semanal con recomendaciones ("6 empresas sin respuesta hace +15 días: decidir si se descartan") |
| No es un "dashboard crudo" ni un "modelo estático" | Cada salida es una acción o una alerta, no una tabla para mirar |
| Demo de ~8 min sin slides | Ver sección 9 |

---

## 3. Arquitectura

### 3.1 Stack

- **Google Apps Script**, desarrollado localmente con **clasp + TypeScript**, versionado en **git** (GitHub).
- **Web app** con `HtmlService`, publicada con *"Ejecutar como: el usuario que accede"* → login con la cuenta de Google del FR y el borrador se crea **en su propio Gmail**.
- **Gemini API** (modelo Flash vigente) vía `UrlFetchApp`, con salida JSON con esquema (`responseSchema`).
- **Mail** (`MailApp`) para todos los avisos, enviados desde la cuenta de Trama dueña del proyecto.
- **Tests** de la lógica pura con Jest, corriendo local (sin Apps Script).

### 3.2 Diagrama

```
                ┌─────────────────────── PERSONA A ───────────────────────┐
  FR ──► Web app: Paso 1 (pegar notas) ──► Extracción (Gemini) ──► Paso 2 (revisar/editar)
                │                                                     │ Confirmar
                └─────────────────────────────────────────────────────┼──┘
                                                                      ▼
                                            Orquestador postReunion (A)
                                         ┌────────────┴─────────────┐
                                         ▼                          ▼
             ┌──────────── PERSONA B ────────────┐   ┌──────────── PERSONA C ────────────┐
             │ CRM (Sheets): upsert, estados,    │   │ Mail: template Doc → HTML,         │
             │ pingueos, historial de eventos     │   │ borrador Gmail + adjuntos Drive   │
             │ Config (usuarios, clubes, params)  │   │                                   │
             │ Sync por usuario: Calendar, Gmail  │   │ Avisos: reglas, escalamiento,     │
             │ (reuniones coordinadas, respuestas)│◄──│ resúmenes, envío por mail, sched. │
             └────────────────────────────────────┘   └───────────────────────────────────┘
```

### 3.3 Spreadsheet que usa el sistema (uno solo)

> ⚠️ **Regla del proyecto: el sistema lee y escribe en un único spreadsheet, y en ningún otro.**
> `Copia de 💸 Contactos '26-'27 💸`
> ID `11T2Z17wZpostplko4ayov_qCxOk4gBwMcL6ZiC9B5rM`
> El CRM real de Trama **no se toca** en ningún momento (ni en desarrollo, ni en tests, ni en la demo).

- El ID va como constante en `src/shared/constants.ts` (`SPREADSHEET_ID`) y **es el único ID de spreadsheet que aparece en el código**. Se revisa en cada PR.
- Hojas de clubes que usa el sistema: `Agro`, `Consultoría`, `Finanzas y Tecnología`, `Emprendedores`, `Trama Lab`.
- `Codis` tiene otras columnas y queda **fuera de alcance**; `LEER !!!` y `Sponsors anteriores` **no se tocan**.
- La configuración y los registros del sistema van como **hojas nuevas dentro de este mismo spreadsheet** (las crea B), con el prefijo `_` para distinguirlas de las de Trama: `_Usuarios`, `_Clubes`, `_Parametros`, `_Historial`, `_LogAvisos`, `_Snapshot`. Se pueden ocultar.

### 3.4 Columnas del CRM (hojas de cada club)

Las hojas son **tablas de Sheets** con columnas tipadas. Orden actual:

| # | Columna | Tipo | Quién la escribe |
|---|---|---|---|
| 0 | Empresa | texto | sistema (desde la interfaz) |
| 1 | Tramero encargado | texto | sistema (nombre del FR logueado) |
| 2 | Persona (de empresa) | texto | LLM → revisado por el FR |
| 3 | Rol de la persona | texto | LLM → revisado |
| 4 | Teléfono | texto | LLM → revisado |
| 5 | Mail | texto | LLM → revisado |
| 6 | LinkedIn contacto | texto | LLM (si aparece) |
| 7 | Estado del contacto | desplegable | LLM sugiere → FR confirma → validado por la máquina de estados |
| 8 | Comentarios | texto | LLM: resumen de las notas de Granola → revisado por el FR. Se agrega con fecha, sin borrar lo anterior |
| 9 | Fecha primer contacto | fecha | sistema (solo si la fila es nueva) |
| 10 | Fecha último contacto | fecha | sistema |
| 11 | Canal | desplegable | sistema |
| 12 | Próxima acción | texto | LLM → revisado |
| 13 | Fecha próxima acción | fecha | LLM → revisado |
| 14 | Pingueos sin respuesta | número | sistema |

> **Regla:** el sistema busca las columnas **por nombre de encabezado**, nunca por índice fijo, para que no se rompa si alguien mueve una columna.

### 3.5 Estados (máquina de estados)

Valores finales del desplegable "Estado del contacto" (7 estados):

```
Mail enviado ─► Mail respondido ─► Reunión coordinada ─► Tuvimos reunión, esperando respuesta ─► Tratativas ─► Va a ser sponsor
     │                 │                                            │                               │
     └─────────────────┴────────────────────────────────────────────┴───────────────────────────────┴──► No va a ser sponsor
```

| Estado | Transiciones permitidas | Final |
|---|---|---|
| Mail enviado | Mail respondido, Reunión coordinada, No va a ser sponsor | No |
| Mail respondido | Reunión coordinada, No va a ser sponsor | No |
| Reunión coordinada | Tuvimos reunión…, Tratativas, No va a ser sponsor | No |
| Tuvimos reunión, esperando respuesta | Tratativas, Va a ser sponsor, No va a ser sponsor, Reunión coordinada (otra reunión) | No |
| Tratativas | Va a ser sponsor, No va a ser sponsor, Reunión coordinada (otra reunión) | No |
| Va a ser sponsor | — | Sí |
| No va a ser sponsor | — | Sí |

**Pingueos:** registrar un pingueo **no cambia el estado**; suma 1 a "Pingueos sin respuesta" y actualiza "Fecha último contacto". Cuando la empresa responde, el contador vuelve a 0.

**Estados posibles al confirmar un post-reunión:** Tuvimos reunión…, Tratativas, Va a ser sponsor, No va a ser sponsor, Reunión coordinada (si quedaron en otra reunión).

### 3.6 Estructura del repositorio y dueños

```
trama-fr-assistant/
├── src/
│   ├── shared/            ← TODOS (se define en el kickoff, cambios por PR revisado por los 3)
│   │   ├── types.ts         contratos entre módulos
│   │   ├── constants.ts     clubes, estados, placeholders del template
│   │   └── clock.ts         now() con soporte de modo demo
│   ├── app/               ← PERSONA A
│   │   ├── webapp.ts        doGet, funciones expuestas a google.script.run
│   │   └── postReunion.ts   orquestador del flujo "Confirmar"
│   ├── ui/                ← PERSONA A
│   │   ├── index.html, paso1.html, paso2.html, seguimientos.html
│   │   ├── styles.html, client.js.html
│   ├── extraccion/        ← PERSONA A
│   │   ├── gemini.ts, prompt.ts, schema.ts, validacion.ts
│   ├── crm/               ← PERSONA B
│   │   ├── repo.ts, maquinaEstados.ts, historial.ts, config.ts
│   ├── sync/              ← PERSONA B
│   │   ├── calendar.ts, respuestasGmail.ts, triggersUsuario.ts
│   ├── mail/              ← PERSONA C
│   │   ├── docToHtml.ts, template.ts, fechas.ts, borrador.ts, adjuntos.ts
│   └── avisos/            ← PERSONA C
│       ├── reglas.ts, escalamiento.ts, resumenes.ts, notificadorMail.ts, scheduler.ts, logAvisos.ts
├── test/                  cada uno testea sus carpetas
├── appsscript.json, .clasp.json, package.json, tsconfig.json
└── README.md
```

**Regla de oro para no pisarse:** cada persona solo modifica sus carpetas. `src/shared/` se modifica únicamente por PR aprobado por los otros dos.

---

## 4. Contratos entre módulos (`src/shared/types.ts`)

Se escriben **juntos el día 1**. Mientras un módulo no esté listo, los demás trabajan contra un **fake** que implementa la misma interfaz.

```ts
// ---------- Dominio ----------
export type Club = 'Agro' | 'Consultoría' | 'Finanzas y Tecnología' | 'Emprendedores' | 'Trama Lab';

export type Estado =
  | 'Mail enviado' | 'Mail respondido' | 'Reunión coordinada'
  | 'Tuvimos reunión, esperando respuesta' | 'Tratativas'
  | 'Va a ser sponsor' | 'No va a ser sponsor';

export type Rol = 'FR' | 'Coordinador' | 'Codirectora';

export interface Usuario {
  mail: string; nombre: string; club: Club | null;   // null para codirectoras
  rol: Rol;
}

export interface FilaCRM {
  club: Club; empresa: string; trameroEncargado: string;
  persona?: string; rolPersona?: string; telefono?: string; mail?: string; linkedin?: string;
  estado?: Estado; comentarios?: string;
  fechaPrimerContacto?: Date; fechaUltimoContacto?: Date; canal?: string;
  proximaAccion?: string; fechaProximaAccion?: Date; pingueosSinRespuesta: number;
}

// ---------- Salida del LLM (A la produce) ----------
export interface Extraccion {
  persona: string | null; rolPersona: string | null;
  mail: string | null; telefono: string | null; linkedin: string | null;
  compromisosEmpresa: string[];       // lo que la empresa prometió
  compromisosTrama: string[];         // lo que Trama prometió / la empresa nos pidió
  parrafoCompromisos: string | null;  // texto listo para el mail, null si no hubo compromisos
  estadoSugerido: Estado;
  comentarios: string;                // resumen de la reunión (notas de Granola) para la columna Comentarios
  proximaAccion: string | null;
  fechaProximaAccion: string | null;  // ISO yyyy-mm-dd
  camposFaltantes: string[];          // ej: ['mail', 'fechaProximaAccion']
}

// ---------- Lo que el FR confirma en el paso 2 ----------
export interface PostReunionConfirmado {
  club: Club; empresa: string; fechaReunion: Date;
  datos: Extraccion;                  // ya editado por el FR
  adjuntosExtra: string[];            // IDs de Drive elegidos por el FR
}

// ---------- Avisos (C los produce) ----------
export type TipoAviso =
  | 'CARGAR_POST_REUNION' | 'SEGUIMIENTO_VENCIDO' | 'PINGUEAR'
  | 'COMPROMISO_TRAMA' | 'ESCALAMIENTO'
  | 'RESUMEN_COORDINADOR' | 'RESUMEN_CODIS';

export interface Aviso {
  clave: string;                      // para deduplicar: tipo|club|empresa|fecha
  tipo: TipoAviso; destinatarios: string[];  // mails
  club?: Club; empresa?: string; texto: string;
}

// ---------- Eventos de historial (B los guarda) ----------
export interface Evento {
  timestamp: Date; club: Club; empresa: string; fr: string;
  tipo: 'ALTA' | 'CAMBIO_ESTADO' | 'PINGUEO' | 'RESPUESTA' | 'POST_REUNION';
  estadoAnterior?: Estado; estadoNuevo?: Estado; origen: 'UI' | 'CALENDAR' | 'GMAIL' | 'MANUAL';
}

// ---------- Servicios ----------
export interface ConfigService {                    // B
  getUsuario(mail: string): Usuario | null;
  getUsuarios(filtro?: { rol?: Rol; club?: Club }): Usuario[];
  getClub(club: Club): { hoja: string; templateDocId: string; carpetaAdjuntosId: string };
  getParametro(nombre: string): number;             // días de cada regla
}

export interface CrmService {                       // B
  buscarEmpresas(club: Club, texto: string): string[];
  getFila(club: Club, empresa: string): FilaCRM | null;
  listarFilas(club: Club): FilaCRM[];
  aplicarPostReunion(p: PostReunionConfirmado, fr: Usuario): FilaCRM;   // valida transición, upsert, historial
  registrarPingueo(club: Club, empresa: string, fr: Usuario): FilaCRM;
  registrarRespuesta(club: Club, empresa: string, fr: Usuario): FilaCRM;
  cambiarEstado(club: Club, empresa: string, nuevo: Estado, fr: Usuario): FilaCRM;
  transicionValida(desde: Estado | undefined, hacia: Estado): boolean;
  getEventos(desde: Date, hasta: Date, club?: Club): Evento[];
}

export interface ExtraccionService {                // A
  extraer(notas: string, ctx: { club: Club; empresa: string; filaExistente: FilaCRM | null;
                                fechaReunion: Date }): Extraccion;
}

export interface MailService {                      // C
  previsualizar(p: PostReunionConfirmado, fr: Usuario): string;            // HTML
  crearBorrador(p: PostReunionConfirmado, fr: Usuario): { draftId: string; url: string };
}

export interface NotificadorService {               // C
  enviar(avisos: Aviso[]): void;                    // por mail, agrupados por destinatario
}
```

---

## 5. PERSONA A — Interfaz web, extracción con LLM y orquestación

**Responsabilidad:** todo lo que el FR ve y toca, y convertir notas libres en datos estructurados.
**Carpetas:** `src/app/`, `src/ui/`, `src/extraccion/`.

### A1. Web app y navegación
- `doGet()` sirve la app con `HtmlService` (templates con `include()` para separar HTML, CSS y JS).
- Publicación: *Ejecutar como el usuario que accede* / *Acceso: cualquier usuario con cuenta de Google* (o restringido al dominio si Trama usa Workspace).
- Al entrar, identifica al usuario (`Session.getActiveUser().getEmail()`) y lo busca con `ConfigService.getUsuario`. Si no está registrado → pantalla "No tenés acceso, pedíselo a tu coordinador".
- Dos pestañas: **Cargar post-reunión** y **Mis seguimientos**.
- Al primer ingreso del usuario, llama a `sync.instalarTriggersUsuario()` (función de B) para que se instalen sus triggers personales.

**Criterio de aceptación:** un FR registrado entra con su cuenta y ve las dos pestañas con su nombre y club; un usuario no registrado ve el mensaje de acceso denegado.

### A2. Paso 1 — Carga
Campos:
- **Club:** precargado con el club del FR (editable solo para codirectoras).
- **Empresa:** input con autocompletado contra `CrmService.buscarEmpresas(club, texto)` (debounce de ~300 ms). Indica si es una empresa **existente** (se va a actualizar) o **nueva** (se va a crear).
- **Fecha de la reunión:** por defecto hoy.
- **Notas de Granola:** textarea grande. Validación: mínimo ~100 caracteres.
- Botón **Procesar** → muestra un loader mientras corre la extracción.

**Criterio de aceptación:** no se puede procesar sin empresa ni notas; el autocompletado devuelve empresas de la hoja del club; se distingue visualmente empresa nueva / existente.

### A3. Extracción con Gemini
- `gemini.ts`: cliente HTTP con `UrlFetchApp`. API key en **Script Properties** (`GEMINI_API_KEY`), nunca en el repo.
- Llamada con `responseMimeType: application/json` y `responseSchema` equivalente a `Extraccion`.
- `prompt.ts`: prompt de sistema en español que:
  - Explica el contexto (Trama, fundraising, qué es un FR).
  - Lista los **estados posibles al confirmar un post-reunión** y cuándo corresponde cada uno.
  - Separa **compromisos de la empresa** de **compromisos de Trama** (incluye "nos pidieron X").
  - Pide `parrafoCompromisos` en primera persona del plural, tono del template, 1–3 oraciones; `null` si no hubo compromisos.
  - Pide `comentarios`: **resumen de la reunión a partir de las notas de Granola**, para la columna Comentarios del CRM. Formato fijo: 2–4 oraciones, en tercera persona, sin saludos ni relleno, cubriendo con quién se habló, nivel de interés de la empresa, qué se acordó y cualquier dato relevante para el próximo contacto (presupuesto, tiempos internos, quién decide).
  - Convierte fechas relativas ("la semana que viene", "después del receso") a fechas absolutas usando la fecha de la reunión que se le pasa.
  - **Prohíbe inventar**: si un dato no está en las notas, va `null` y se agrega a `camposFaltantes`.
  - Recibe la fila existente del CRM (si hay) para no pisar datos con `null` (ej: el mail ya cargado).
- Incluye 2 ejemplos (few-shot) armados con notas de reuniones reales anonimizadas.

### A4. Validación de la salida
- `validacion.ts` (lógica pura, testeada):
  - Verifica que el JSON cumpla el esquema; si no, **reintenta una vez** con el error en el prompt; si vuelve a fallar, muestra error al FR y permite completar a mano.
  - Valida formato de mail y de fecha; fecha de próxima acción no puede ser anterior a la reunión.
  - Verifica con `CrmService.transicionValida` que el estado sugerido sea alcanzable desde el estado actual; si no, lo marca para revisión.
  - Combina con la fila existente: un campo `null` del LLM **no** sobrescribe un valor existente.

**Criterio de aceptación:** con 10 notas de prueba, ninguna extracción inventa un mail o teléfono que no esté en el texto; los campos faltantes quedan marcados.

### A5. Paso 2 — Revisión
- Formulario con **todos los campos extraídos editables**; los de `camposFaltantes` resaltados en amarillo.
- Selector de estado que **solo muestra transiciones válidas** desde el estado actual.
- Listas editables de compromisos (empresa / Trama) y el `parrafoCompromisos`.
- **Resumen para Comentarios** (textarea editable), mostrando debajo los comentarios que ya tenía la empresa en el CRM para que el FR vea el contexto.
- **Vista previa del mail** (HTML de `MailService.previsualizar`), que se actualiza al editar.
- Selector de **adjuntos extra** (archivos de la carpeta del club; el PDB y el doc del evento van siempre).
- Botones **Volver** y **Confirmar**.

**Criterio de aceptación:** cualquier cambio del FR se refleja en la vista previa; no se puede confirmar con un estado inválido ni sin mail del contacto.

### A6. Orquestador del "Confirmar" (`postReunion.ts`)
Secuencia:
1. `CrmService.aplicarPostReunion(p, fr)` → actualiza el CRM y el historial.
2. `MailService.crearBorrador(p, fr)` → crea el borrador.
3. Si hay `compromisosTrama`, quedan como próxima acción del FR (ya se reflejan en la fila).
4. Pantalla de éxito con **link a la fila del CRM** y **link al borrador** en Gmail.

Manejo de errores: si falla el CRM no se crea el borrador; si falla el borrador después de escribir el CRM, se informa y se ofrece **reintentar solo el borrador** (operación idempotente: no duplica la fila).

**Criterio de aceptación:** al confirmar, en menos de ~15 s aparecen la fila actualizada y el borrador; un doble clic no duplica nada.

### A7. Pestaña "Mis seguimientos"
- Lista las empresas del FR con estado no final, ordenadas por **fecha de próxima acción** (vencidas primero, en rojo).
- Por empresa: estado, próxima acción, fecha, pingueos sin respuesta y botones:
  - **Registré un pingueo** → `CrmService.registrarPingueo`
  - **Respondieron** → `CrmService.registrarRespuesta`
  - **Cambiar estado** → selector con transiciones válidas → `CrmService.cambiarEstado`

**Criterio de aceptación:** las acciones se reflejan en el CRM y en la lista sin recargar la página.

### Dependencias de A y cómo trabajar sin esperar
- Usa `CrmService` (B) y `MailService` (C). Hasta que estén, implementa `FakeCrmService` (datos en memoria) y `FakeMailService` (devuelve un HTML fijo).
- La extracción no depende de nadie: se puede desarrollar y testear desde el día 1.

---

## 6. PERSONA B — CRM, máquina de estados, configuración y sincronización

**Responsabilidad:** ser la única puerta de entrada y salida de datos del sistema y mantener el estado de cada empresa al día.
**Carpetas:** `src/crm/`, `src/sync/`.

### B1. Hojas de sistema y configuración (`config.ts`)
Crear, **dentro del único spreadsheet del proyecto** (sección 3.3), las hojas:
- **_Usuarios:** mail, nombre, club, rol (FR / Coordinador / Codirectora). Un club puede tener varios coordinadores. (La firma no se guarda acá: sale de la firma de Gmail de cada FR, ver C3.)
- **_Clubes:** club, nombre de hoja en el CRM, ID del Doc template, ID de la carpeta de adjuntos de Drive.
- **_Parametros:** nombre, valor (días de cada regla: `DIAS_PINGUEO_MAIL=7`, `DIAS_COORDINAR=3`, `HORAS_CARGA_POST=24`, `DIAS_SEGUIMIENTO=7`, `DIAS_TRATATIVAS_FR=5`, `DIAS_TRATATIVAS_ESCALA=14`, `PINGUEOS_ESCALA=2`, `DIAS_VENCIDO_ESCALA=3`, `DIAS_ENVIO_AGENDA=LUN,MIE,VIE`, etc.). El ID del spreadsheet **no** es un parámetro: es una constante fija.
- **_Historial**, **_LogAvisos** y **_Snapshot** (ver B4 y C6; B crea las hojas, C escribe en _LogAvisos).
- Todo acceso a Sheets pasa por una única función `abrirSpreadsheet()` que usa `SPREADSHEET_ID`; queda prohibido `SpreadsheetApp.openById` / `openByUrl` en cualquier otro lugar del código.
- Implementa `ConfigService` con caché (`CacheService`, ~5 min) para no leer la hoja en cada llamada.

**Criterio de aceptación:** cambiar un parámetro en la hoja cambia el comportamiento sin tocar código.

### B2. Repositorio del CRM (`repo.ts`)
- Lectura y escritura de las 5 hojas de clubes, **mapeando columnas por nombre de encabezado**.
- **Búsqueda de empresa** normalizada (minúsculas, sin tildes ni espacios extra) dentro de la hoja del club; `buscarEmpresas` devuelve coincidencias parciales para el autocompletado.
- **Upsert:** si la empresa existe, actualiza solo los campos no vacíos; si no, escribe en la **primera fila vacía de la tabla** (no `appendRow` a ciegas) para que la tabla se extienda y mantenga los desplegables.
- Reglas automáticas al aplicar un post-reunión:
  - `Fecha primer contacto` solo si la fila es nueva.
  - `Fecha último contacto` = fecha de la reunión.
  - `Tramero encargado` = nombre del FR si estaba vacío.
  - `Pingueos sin respuesta` = 0 (hubo contacto).
  - `Comentarios`: se **agrega** el resumen de la reunión (ver A3) como una línea nueva con la fecha adelante, sin borrar lo que ya había. Ejemplo:
    ```
    [18/11] Reunión con Martina (Mkt). Interesados en sponsorear el BootCamp; mandan propuesta antes del 5/12.
    [02/12] Segunda reunión: confirman sponsoreo categoría Main, falta firma.
    ```
    Así la columna funciona como historial de la relación con la empresa. Si la misma reunión se confirma dos veces (idempotencia), la línea no se duplica.
- **Concurrencia:** todas las escrituras dentro de `LockService.getScriptLock()` para que dos FR del mismo club no se pisen.
- **Idempotencia:** aplicar dos veces el mismo `PostReunionConfirmado` deja la fila igual y no duplica eventos (clave = club + empresa + fechaReunion).

**Criterio de aceptación:** tests de integración contra el spreadsheet del proyecto: crear, actualizar, no duplicar, no pisar datos existentes con vacíos, mantener el desplegable en filas nuevas.

### B3. Máquina de estados (`maquinaEstados.ts`)
- Tabla de transiciones de la sección 3.5 como dato (no `if` anidados).
- `transicionValida(desde, hacia)`; `undefined` como origen solo admite estados iniciales.
- `registrarPingueo`: no cambia estado; suma 1 al contador; actualiza fecha de último contacto; error si el estado es final.
- `registrarRespuesta`: contador a 0; si estaba en *Mail enviado* pasa a *Mail respondido*.
- **Migración del desplegable:** reemplazar las opciones en las 5 hojas por los 7 estados finales (coordinarlo con Trama antes). Filas existentes en "Primer pingueo"/"Segundo pingueo": pasar a *Mail enviado* (o el estado que indique el FR) con contador 1/2.

**Criterio de aceptación:** tests unitarios con todas las combinaciones de la tabla (válidas e inválidas) y los casos de pingueo/respuesta.

### B4. Historial de eventos (`historial.ts`)
- Cada operación del sistema registra un `Evento` en la hoja `_Historial` (alta, cambio de estado, pingueo, respuesta, post-reunión).
- `getEventos(desde, hasta, club?)` para las métricas de C.
- **Detección de cambios manuales:** trigger diario que compara el estado actual de cada fila con un snapshot del día anterior (guardado en la hoja `_Snapshot`) y registra como `origen: 'MANUAL'` los cambios que alguien hizo a mano en el sheet. Así las métricas no dependen de que todos usen la interfaz.

**Criterio de aceptación:** cambiar a mano un estado en el CRM genera un evento `MANUAL` al día siguiente.

### B5. Sincronización con Calendar (`calendar.ts`)
- Corre **como cada FR** (trigger instalado por usuario, ver B7), cada 1 hora.
- Busca eventos de los próximos 30 días en el calendario del FR y los **asocia a una empresa del CRM** de su club por:
  1. dominio del mail de algún invitado = dominio del mail cargado en el CRM, o
  2. nombre de la empresa contenido en el título del evento.
- Si la empresa está en *Mail enviado* o *Mail respondido* → pasa a **Reunión coordinada**, con `Próxima acción = "Reunión"` y `Fecha próxima acción = fecha del evento` (evento `origen: 'CALENDAR'`).
- Si la reunión se reprograma, actualiza la fecha.

**Criterio de aceptación:** crear un evento con un invitado `@empresa.com` hace que esa empresa pase a *Reunión coordinada* con la fecha correcta en la siguiente sincronización.

### B6. Detección de respuestas en Gmail (`respuestasGmail.ts`)
- Corre como cada FR, cada 1 hora.
- Para cada empresa del FR en estado no final con mail cargado, busca con `GmailApp.search('from:<mail> newer_than:2d')` si la empresa escribió.
- Si hay respuesta posterior a la fecha de último contacto → `registrarRespuesta` (evento `origen: 'GMAIL'`).
- Solo **lee metadatos** (remitente, fecha); no guarda el contenido de los mails.

**Criterio de aceptación:** responder desde una cuenta de prueba de "empresa" resetea el contador de pingueos y pasa *Mail enviado* → *Mail respondido*.

### B7. Triggers por usuario (`triggersUsuario.ts`)
- Los triggers de tiempo corren con la identidad de quien los creó; por eso Calendar y Gmail se sincronizan con **un trigger por FR**, instalado la primera vez que entra a la app (`instalarTriggersUsuario()`, llamada desde A1).
- Debe ser idempotente (no instalar dos veces) y permitir desinstalarlos.

### Dependencias de B y cómo trabajar sin esperar
- No depende de nadie: todo se prueba contra el spreadsheet del proyecto y con eventos/mails de cuentas de prueba.
- Lo primero que entrega es `ConfigService` y `CrmService.buscarEmpresas/getFila/listarFilas`, porque A y C los usan.

---

## 7. PERSONA C — Mail, avisos y resúmenes

**Responsabilidad:** todo lo que sale del sistema hacia personas: el borrador del mail a la empresa y los avisos a FR, coordinadores y codirectoras.
**Carpetas:** `src/mail/`, `src/avisos/`. Además es dueño de `src/shared/clock.ts`.

### C1. Template por club (Google Doc → HTML) (`docToHtml.ts`, `template.ts`)
- Un **Google Doc por club** (ID en la hoja `Clubes`), editable por los coordinadores sin tocar código.
- Placeholders estándar (en `constants.ts`):
  `@PERSONA`, `@NOMBRE EMPRESA`, `@FECHA_REUNION`, `@COMPROMISOS`.
- Adaptar el template actual: el texto resaltado del día pasa a `@FECHA_REUNION` y el espacio del comentario ("si la empresa se comprometió a…") pasa a `@COMPROMISOS`. La línea "- firma" del final **se borra del template**: la firma se agrega sola (ver C3).
- `docToHtml.ts` recorre el Doc con `DocumentApp` y genera HTML de mail **preservando**: párrafos, viñetas, **negrita**, *cursiva* y links. (Exportar el Doc como HTML trae estilos que Gmail no respeta bien; recorrer los elementos da control total.)
- `template.ts` reemplaza placeholders; si `@COMPROMISOS` es `null`, elimina el párrafo entero (no deja un hueco).
- Validación: si el Doc no tiene algún placeholder obligatorio, error claro ("el template de Agro no tiene @PERSONA").

**Criterio de aceptación:** el borrador generado se ve igual al template original (negritas, viñetas, link del BootCamp funcionando).

### C2. Formato de la fecha (`fechas.ts`)
- Reunión el mismo día de la carga → **"de hoy"**.
- Si no → **"del martes 18/11"** (día de la semana en español + DD/MM).
- Lógica pura, testeada (incluye bordes: medianoche, zona horaria `America/Buenos_Aires`).

### C3. Borrador en Gmail (`borrador.ts`, `adjuntos.ts`)
- `previsualizar()` devuelve el HTML final (lo usa A en el paso 2).
- `crearBorrador()`:
  - Destinatario: mail del contacto.
  - Asunto configurable por club (ej: "Trama ITBA x @NOMBRE EMPRESA — Resumen de la reunión").
  - Cuerpo: `htmlBody` + versión de texto plano.
  - **Firma:** cada FR configura **su firma en Gmail** (una sola vez, en Configuración → Firma). Como los borradores creados por código no traen la firma automáticamente, el sistema la lee con el servicio avanzado de Gmail (`Gmail.Users.Settings.SendAs.list('me')`, la firma de la dirección principal) y la agrega al final del cuerpo. Como la app corre como el FR, lee **su** firma.
  - Si el FR no tiene firma configurada, el paso 2 muestra un aviso ("No tenés firma en Gmail: configurala o el mail sale sin firma") con el link a la configuración de Gmail. No bloquea.
  - Adjuntos: **PDB y documento del evento** (siempre) desde la carpeta del club + los adjuntos extra elegidos.
  - Si ya existía un borrador del sistema para la misma empresa y fecha, lo reemplaza (idempotencia).
  - Devuelve el link directo al borrador.

**Criterio de aceptación:** el borrador aparece en el Gmail del FR logueado (no en el de otro), con los adjuntos correctos y **la firma de Gmail de ese FR**, y nunca se envía solo.

### C4. Notificaciones por mail, agrupadas (`notificadorMail.ts`)
Objetivo: **pocos mails, que se lean**. Nadie recibe un mail por empresa ni un mail por día.

- Todos los avisos salen por mail con `MailApp`, desde la cuenta de Trama dueña del proyecto (la que instala los triggers centrales).
- **Días fijos de envío: lunes, miércoles y viernes a las 9:00** (parámetro `DIAS_ENVIO_AGENDA`). Fuera de esos días no sale ningún aviso.
- **Para el FR: un único mail "Agenda"** por día de envío, con todo lo suyo junto:
  - **Vencido**: lo que ya se tendría que haber hecho (ordenado de más viejo a más nuevo).
  - **Hasta el próximo envío**: todo lo que vence entre hoy y el próximo día de envío (lunes → miércoles, miércoles → viernes, viernes → lunes). Así, si hay 5 empresas para contactar en 2 días, llegan **todas en el mismo mail** y no hay ningún hueco entre un envío y otro.
  - Cada empresa en una línea: acción a hacer, estado, fecha y link a su fila del CRM.
  - Si no hay nada vencido ni próximo, **no se envía nada**.
  - Asunto: `[Trama FR] Tu agenda: 2 vencidos, 3 para esta semana`.
- **Para los coordinadores: un único mail por club** en los mismos días, con todos los escalamientos juntos (empresas con seguimiento vencido hace 3 días o más, sin respuesta, tratativas estancadas), agrupados por FR, con los FR involucrados en copia. Si no hay escalamientos, no se envía.
- **Los lunes**, el resumen semanal (C7) va **en el mismo mail** que la agenda o los escalamientos de ese día, no en uno aparte.
- Asunto siempre con prefijo `[Trama FR]` para poder filtrarlo.
- Si falla un envío, se registra en `_LogAvisos` y se reintenta en el siguiente día de envío.

**Resultado:** un FR recibe como máximo 3 mails por semana; un coordinador, como máximo 3; las codirectoras, 1 (el resumen del lunes).

**Criterio de aceptación:** con 6 empresas que vencen entre lunes y miércoles para el mismo FR, el lunes sale un único mail con las 6 y el martes no sale nada; un día sin pendientes no se envía ningún mail.

### C5. Reglas de recordatorio y escalamiento (`reglas.ts`, `escalamiento.ts`)
Motor de reglas **puro** (recibe filas + fecha actual + parámetros, devuelve `Aviso[]`), testeado sin Apps Script. Las reglas solo deciden **qué** avisar; **cuándo y cómo se agrupa** lo decide C4.

| Regla | Condición | Destinatario |
|---|---|---|
| CARGAR_POST_REUNION | Estado *Reunión coordinada* y pasaron `HORAS_CARGA_POST` desde la fecha de la reunión sin post-reunión cargado | FR |
| PINGUEAR | *Mail enviado* y `DIAS_PINGUEO_MAIL` (**7**) días sin respuesta | FR |
| PINGUEAR | *Mail respondido* y `DIAS_COORDINAR` sin reunión coordinada | FR |
| SEGUIMIENTO_VENCIDO | *Tuvimos reunión…* o *Tratativas* y llegó la fecha de próxima acción (o `DIAS_SEGUIMIENTO` sin contacto) | FR |
| COMPROMISO_TRAMA | La próxima acción es un compromiso de Trama y vence mañana | FR |
| ESCALAMIENTO | `Pingueos sin respuesta ≥ PINGUEOS_ESCALA` y 7 días sin respuesta → "¿la damos por perdida?" | Coordinador del club (+ FR en copia) |
| ESCALAMIENTO | *Tratativas* con `DIAS_TRATATIVAS_ESCALA` sin movimiento | Coordinador del club |
| **ESCALAMIENTO por seguimiento vencido** | Estado no final y pasaron **`DIAS_VENCIDO_ESCALA` (3) días desde la fecha de próxima acción** sin que haya un contacto posterior (no cambió la fecha de último contacto ni el estado) | **Coordinadores del club** (+ FR en copia) |

- Estados finales no generan recordatorios.
- **Secuencia de un seguimiento vencido:** la empresa aparece en la agenda del FR en el envío anterior a su fecha de próxima acción ("hasta el próximo envío") y, si no se hace, en los siguientes como "vencido". Cuando se cumplen 3 días desde la fecha sin contacto, entra en el mail de escalamientos de los coordinadores del siguiente día de envío. El escalamiento se manda **una sola vez** por empresa y fecha de próxima acción (si el FR la reprograma, el conteo vuelve a empezar).
- El escalamiento a coordinadores también se incluye en su resumen semanal mientras siga sin resolverse.
- Cada aviso incluye **qué hacer** ("Pingueá a Martina de X, último contacto hace 6 días"), no solo el dato.

**Criterio de aceptación:** suite de tests con un set de filas de ejemplo y fechas fijas que verifica exactamente qué avisos salen.

### C6. Deduplicación de avisos (`logAvisos.ts`)
- Los escalamientos se mandan **una sola vez** por `clave` (tipo|club|empresa|fecha): antes de incluirlos, se verifica en `_LogAvisos` que no se hayan enviado. Los ítems de la agenda del FR sí se repiten mientras sigan pendientes (es su lista de tareas).
- Registra cada aviso enviado (para auditoría y para no repetir escalamientos).

### C7. Resúmenes semanales (`resumenes.ts`)
Lunes 9:00. Calculados con `CrmService.listarFilas` y `CrmService.getEventos`.

**Para cada coordinador (su club):**
- Contactos nuevos, reuniones hechas, nuevos sponsors en la semana (vs semana anterior).
- Embudo: cantidad de empresas por estado.
- **Empresas trabadas** con FR responsable (seguimientos vencidos, pingueos ≥ 2).
- Actividad por FR (quién cargó post-reuniones esta semana y quién no).
- **Recomendaciones concretas**: "3 empresas con 2 pingueos sin respuesta: decidir si se descartan", "Juan tiene 4 seguimientos vencidos".

**Para las codirectoras (consolidado):**
- Tabla corta con los 5 clubes: contactos, reuniones, sponsors confirmados, trabadas.
- Clubes con menos actividad que la semana anterior.
- Lista de nuevos sponsors de la semana.

**Criterio de aceptación:** con datos de prueba, el resumen cuadra con un conteo manual del CRM y del historial.

### C8. Scheduler y modo demo (`scheduler.ts`, `shared/clock.ts`)
- Triggers centrales (instalados una vez con la cuenta de Trama dueña del proyecto):
  - Lunes, miércoles y viernes 9:00 → reglas + armado y envío de los mails agrupados (los lunes, con el resumen semanal incluido).
- `clock.ts`: `now()` devuelve la fecha real, o la de la Script Property `DEMO_NOW` si está definida. **Todo el sistema usa `now()`, nunca `new Date()` directo.**
- Función `demoAvanzarDias(n)` que adelanta el reloj y fuerza un envío en el momento, aunque no sea día de envío (para la demo).

### Dependencias de C y cómo trabajar sin esperar
- Usa `ConfigService` y `CrmService` (B). Hasta que estén, trabaja con `FakeCrmService` cargado con filas de ejemplo en JSON.
- El motor de reglas, las fechas y el template son lógica pura: se desarrollan y testean desde el día 1.

---

## 8. Plan de trabajo

| Fase | Duración aprox. | Qué se hace | Entregable |
|---|---|---|---|
| **0. Kickoff** | 1 día (los 3 juntos) | Repo, clasp, TypeScript, Jest; `types.ts` y `constants.ts` (con `SPREADSHEET_ID`); proyecto de Gemini; cuentas de prueba de "empresa" y de "coordinador" | Repo que compila y despliega una web app "Hola mundo" — **scaffold inicial ya creado el 2026-11-22** (ver `README.md`): estructura de carpetas, `types.ts`/`constants.ts`/`clock.ts`, stubs por persona, build con esbuild, tests con Jest. Falta: `scriptId` real en `.clasp.json`, `SPREADSHEET_ID` real, `GEMINI_API_KEY`, IDs de `_Clubes` |
| **1. Módulos con fakes** | ~1,5 semanas | Cada uno su módulo contra fakes + tests unitarios | A: paso 1 y 2 con extracción real y fakes. B: CRM + máquina de estados + config contra la copia. C: template → borrador real + reglas con tests + envío de avisos por mail |
| **2. Integración** | ~1 semana | Se reemplazan los fakes por los servicios reales. B entrega primero `ConfigService` y lectura del CRM | Flujo completo: pegar notas → CRM + borrador → avisos |
| **3. Extras y pulido** | ~1 semana | Calendar y Gmail (B), "Mis seguimientos" (A), resúmenes y escalamiento completo (C); prueba con 1–2 FR reales | Sistema usable por Trama |
| **4. Demo** | 2–3 días | Datos de demo, ensayo cronometrado, plan B | Demo de 8 min ensayada |

**Puntos de control:** reunión corta 2 veces por semana; los PR que tocan `src/shared/` necesitan aprobación de los otros dos.

### Prioridades (si falta tiempo, se recorta de abajo hacia arriba)

1. **Imprescindible (MVP):** A1–A6, B1–B4, C1–C5 (recordatorios al FR + escalamiento a coordinadores por seguimiento vencido, por mail), C6, C8.
2. **Importante:** C7, A7, resto de las reglas de escalamiento.
3. **Deseable:** B5 (Calendar), B6 (respuestas en Gmail), detección de cambios manuales (B4).

---

## 9. Guion de la demo (~8 min, sin slides)

| Min | Qué se muestra | Quién habla |
|---|---|---|
| 0–1 | El problema: el post-reunión manual de un FR (el CRM, el template, las notas de Granola) | A |
| 1–3 | Pegar notas de una reunión simulada → Procesar → paso 2 con campos extraídos, faltantes resaltados y vista previa del mail → Confirmar | A |
| 3–4 | Aparecen la fila en el CRM y el borrador en Gmail con adjuntos. Se cambia el estado a mano para mostrar que la máquina de estados no permite saltos inválidos | B |
| 4–6 | Modo demo: se cargan varias empresas con seguimientos en días cercanos y se fuerza un envío → llega **un solo mail "Agenda"** al FR con todas juntas. Se avanzan 3 días más sin contacto → llega el mail de **escalamientos** a los coordinadores, con el FR en copia | C |
| 6–7 | Resumen semanal del coordinador y consolidado de codirectoras, con recomendaciones | C |
| 7–8 | Arquitectura en 1 minuto (diagrama en el README) y decisiones de diseño: borrador sin envío automático, LLM acotado, máquina de estados | B |

**Plan B:** si Gemini falla en vivo, la app tiene un modo de extracción precargada para las notas de la demo. Tener abiertas de antemano las casillas de la cuenta "FR" y la cuenta "coordinador" para que los mails se vean llegar.

---

## 10. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| El LLM inventa datos (mails, fechas) | Prohibido en el prompt, `camposFaltantes`, validación y revisión humana obligatoria en el paso 2 |
| Tocar el CRM real de Trama u otro spreadsheet | Un único `SPREADSHEET_ID` (la copia) como constante; un único punto de acceso `abrirSpreadsheet()`; revisión en cada PR de que no aparezca otro ID; columnas por nombre; `LockService` |
| Notas de reuniones enviadas a un servicio externo | La capa gratuita de Gemini puede usar los datos para mejorar sus productos: revisar los términos; para uso real en Trama, usar la capa paga o anonimizar |
| Cuotas de Apps Script (6 min por ejecución, límite diario de destinatarios de mail, más bajo en cuentas gratuitas que en Workspace) | Un mail por destinatario por día de envío, 3 días por semana; el volumen de Trama queda muy por debajo; las reglas procesan por club |
| Los mails de aviso se pierden en la casilla o nadie los lee | Todo agrupado en un mail por persona, 3 días fijos por semana, nada si no hay pendientes; prefijo `[Trama FR]` para filtrar |
| Triggers por usuario que no se instalan | Se instalan al primer ingreso; la app muestra un aviso si faltan |
| Formato del mail distinto al template | C1 recorre el Doc elemento por elemento; se prueba temprano (fase 1) |
| Integración tardía | Contratos definidos el día 1 y fakes; integración planificada en la fase 2, no al final |

---

## 11. Fuera de alcance

- Detección de superposiciones entre clubes y uso del historial de sponsoreo.
- Envío automático de mails.
- Integración directa con la API de Granola (requiere plan pago).
- WhatsApp (requiere verificar un negocio en Meta y plantillas aprobadas).
- La hoja `Codis` del CRM.
- Gestión de montos de sponsoreo y pronóstico financiero del pipeline (posible extensión futura).
