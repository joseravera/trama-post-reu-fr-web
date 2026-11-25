# Guion de demo frente a los profesores (5–6 minutos)

Escrito el 23/11/2026. Pensado para mostrar **todas** las piezas del sistema en el tiempo mínimo:
cargar post-reunión con IA, los 5 estados, seguimientos, sync automático de Gmail, mails
automáticos (agenda + escalamiento + resumen) y, si da el tiempo, sync de Calendar.

La mock data ya está cargada en el spreadsheet real (hoja `Emprendedores`) y los usuarios ya están
actualizados en `_Usuarios`. No hace falta tocar nada de eso el día de la demo — solo seguir los
pasos de abajo.

---

## 0. Roles y accesos (ya están así en `_Usuarios`)

| Persona | Mail de login | Rol | Qué hace en la demo |
|---|---|---|---|
| **Josefina** | jravera@itba.edu.ar | FR (Emprendedores) | Carga el post-reunión, muestra sus seguimientos, recibe "Tu agenda" |
| **Magali** | mgonzalezporzio@itba.edu.ar | Coordinadora (Emprendedores) | Recibe el mail de escalamiento y el resumen semanal de coordinadora |
| **Caro** | ccastelnuovo@itba.edu.ar | Codirectora | Recibe el resumen semanal de codirectoras |

Todas las empresas de `Emprendedores` quedaron asignadas a **Josefina** como "Tramero encargado"
(Magali y Caro ya no cargan empresas propias, ahora supervisan).

---

## 1. Preparar el día anterior (15 minutos, no el día de la demo)

- [ ] Josefina inicia sesión al menos una vez en la webapp con su cuenta (para que se instalen
      solos sus triggers de Calendar/Gmail — tarda unos segundos la primera vez).
- [ ] Tener 2 pestañas de Gmail abiertas y logueadas, listas para el momento 3:
  - El Gmail de Josefina (jravera@itba.edu.ar) (para mostrar el mail "Tu agenda" que le va a llegar).
  - El Gmail personal de **Caro** (carocastelnuovo@gmail.com) — ahí está cargada la empresa
    ficticia "Café Andes" como si fuera su contacto real.
- [ ] Tener abierto también el Gmail de **Magali** (mgonzalezporzio@itba.edu.ar) en otra pestaña o
  celular, para el momento 4 (recibe el escalamiento, ahora como coordinadora).
- [ ] Copiar el texto de notas de la sección 2 a un bloc de notas, para pegarlo rápido en la demo
  (no perder tiempo escribiéndolo en vivo).
- [ ] Decidir si van a mostrar el sync de Calendar (sección 6, opcional). Si sí, crear **el día
  anterior** un evento de Calendar con un invitado o un título que contenga el nombre de una
  empresa ya cargada (ej. título "Trama x AgroTech Norte"), dentro de los próximos 30 días.
- [ ] Chequear que el reloj del sistema NO esté en modo demo: en el editor de Apps Script
  (script.google.com → el proyecto) → ícono de engranaje **Configuración del proyecto** → abajo,
  **Propiedades del script**. Si aparece una fila `DEMO_NOW`, bórrenla antes de arrancar.

---

## 2. Minuto 0:00–0:40 — Intro

30 segundos: qué problema resuelve (el FR after cada reunión tiene que actualizar el CRM a mano y
mandar el mail de agradecimiento; esto lo automatiza) y qué van a ver (carga con IA, seguimientos,
avisos automáticos).

---

## 3. Minuto 0:40–2:30 — Cargar un post-reunión en vivo (con Gemini)

Logueados como **Josefina**. Club "Emprendedores" ya viene precargado.

Usamos una empresa que **ya estaba en el CRM**, no una nueva — tiene más sentido así: en la
realidad nunca tenemos una "Reunión coordinada" con una empresa que no esté cargada (para llegar a
ese estado antes tuvo que haber un mail, o el sync de Calendar). La empresa es **"Constructora
Delta"**, que ya veníamos de una primera reunión con Gustavo Ibarar (Jefe de Comunicación) y
habíamos coordinado una segunda reunión con la decisora real, Carolina Suárez (Gerente de
Sustentabilidad) — esa es la reunión que vamos a cargar ahora.

1. En "Cargar post-reunión": Empresa = **"Constructora Delta"** (empezá a escribirla, el
   autocompletado la va a traer del CRM — la app muestra el chip "Ya está en el CRM" y el estado
   actual "Reunión coordinada"). Fecha = hoy.
2. Pegar estas notas (son ficticias, formato Granola):

   ```
   Segunda reunión Trama x Constructora Delta — BootCamp Emprendedores
   Participantes: Carolina Suárez (Gerente de Sustentabilidad, Constructora Delta), Josefina (Trama Emprendedores)
   - Carolina confirma que quieren sponsorear con la categoría Main
   - Pidió que le mandemos el borrador del convenio para que lo revise el área legal de la constructora
   - Dijo que si el área legal no pone objeciones, firman antes del 10/12
   - Le mandamos el borrador del convenio actualizado, quedamos en mandarlo mañana
   - Mail: carolina.suarez@example.com
   - Teléfono: 11 4777-9020
   ```

3. Click "Procesar notas". Mientras carga, explicar: "esto lo manda a Gemini con el prompt del
   equipo de extracción, no inventa nada que no esté en las notas".
4. En el paso 2, señalar en vivo:
   - El contacto cambió solo de Gustavo a **Carolina Suárez** (Gerente de Sustentabilidad, el mail
     y teléfono nuevos) — porque esta vez las notas hablan de ella, no de Gustavo.
   - Abajo, en "Comentarios que ya tenía la empresa en el CRM", aparece el historial de la primera
     reunión — nada se pierde, se va acumulando.
   - Compromisos separados: lo que promete la empresa ("el área legal firma antes del 10/12") vs.
     lo que promete Trama ("mandar el borrador del convenio mañana").
   - **Próxima acción con fecha**: "Seguimiento con Carolina: convenio firmado por el área legal",
     10/12/2026 — remarcar que esa fecha salió literalmente de "firman antes del 10/12" en las
     notas; si las notas no hubieran dicho una fecha, hubiera quedado vacía (la IA no inventa
     fechas).
   - **El estado**: Gemini sugiere **"Tratativas"**, y el desplegable SÍ la respeta automáticamente
     (es una de las 3 sugerencias "seguras", junto con "Va a ser sponsor" y "No va a ser sponsor").
     Vale explicar el criterio real detrás de "Tratativas": hubo un sí de la empresa (acá,
     normalmente después de más de una reunión, como en este caso), pero ese sí depende de algo
     que nosotros le tenemos que mandar y ellos revisar o aprobar — todavía no pagaron. Es distinto
     de "Tuvimos reunión, esperando respuesta", que es el estado natural después de una primera
     reunión, o de una segunda reunión que queda más dudosa/sin definición.
5. Confirmar. Mostrar los dos resultados: el link al CRM (la fila de "Constructora Delta" se
   actualizó, no se creó una nueva) y el botón "Abrir el borrador en Gmail" (mail ya armado con el
   template del club, los compromisos y adjuntos).

---

## 4. Minuto 2:30–3:20 — "Mis seguimientos"

Seguir logueados como Josefina, ir a la pestaña "Mis seguimientos".

- Mostrar el filtro **"Vencidos"**: van a aparecer **"Expo Insumos SRL"** y **"Verde Insumos"**
  (su fecha de próxima acción ya pasó).
- En "Expo Insumos SRL", click en **"Generar borrador de pingueo"** — es el único botón de esta
  pestaña: arma el borrador del mail en Gmail con el template que corresponde según el estado
  actual de la empresa, y solo si el borrador se creó bien, en el mismo paso sube el contador de
  pingueos de 1 a 2 y aparece el link **"Ver borrador"** para abrirlo en Gmail.
- (Opcional, 15 seg) Abrir el desplegable de "Nuevo estado" en cualquier empresa y mostrar que solo
  ofrece los estados a los que se puede pasar desde el estado actual — si intentan forzar una
  transición no permitida desde el CRM a mano, el sistema la rechaza con un mensaje claro.

---

## 5. Minuto 3:20–4:10 — Sync automático de Gmail (en vivo)

1. Cambiar a la pestaña del Gmail de **Caro** (carocastelnuovo@gmail.com). Esa cuenta está cargada
   como el contacto de **"Café Andes"**, una empresa a la que le mandamos un mail hace más de una
   semana y no respondió.
2. Desde ahí, responder cualquier cosa a la cuenta de Josefina (jravera@itba.edu.ar) — el
   asunto no importa, el sync solo mira remitente y fecha.
3. Volver al editor de Apps Script, logueados como Josefina, y correr la función
   **`sincronizarRespuestasGmail`** desde el desplegable (Ejecutar). Tarda unos segundos.
4. Refrescar "Mis seguimientos" en la webapp: **"Café Andes"** pasó sola de "Mail enviado" a
   "Mail respondido", y el contador de pingueos volvió a 0 — sin que nadie haya tocado el CRM a
   mano.

> Si por algo no da el tiempo de mandar el mail real y correr la sincronización en vivo, se puede
> directamente contar el mecanismo y mostrarlo ya aplicado de antes (dejen una de estas corridas
> hecha un rato antes de arrancar, como respaldo).

---

## 6. Minuto 4:10–5:20 — Mails automáticos: agenda, escalamiento y resumen

Esto corre solo los lunes/miércoles/viernes a las 9am — para la demo lo forzamos manualmente.
**Importante: elegir UNA de las dos opciones según el día real en que hagan la demo.**

La demo real es **martes 24/11** — ese día no es ni lunes ni día de envío (lun/mié/vie), así que
**siempre** hace falta forzar. Hay dos variantes según si quieren mostrar también el resumen
semanal (que solo sale si "hoy" es lunes) o no.

### Variante 1 — solo "Tu agenda" + "Escalamientos" (sin resumen semanal)

No toca el reloj para nada, así que no hay limpieza que hacer después. En el editor de Apps Script,
abran `Code.js`, agreguen al final:

```js
function _demoForzarAvisos() {
  TramaImpl.ejecutarEnvioAgendaYAvisos(true);
}
```

Guarden, seleccionen `_demoForzarAvisos` en el desplegable, **Ejecutar**.

### Variante 2 — todo junto, incluido el resumen semanal

Acá sí hace falta adelantar el reloj hasta el próximo lunes (único día en que se arma el resumen).
**El número de días depende de qué día es "hoy" en el momento en que lo corren** — no es siempre el
mismo:

```js
function _demoForzarAvisos() {
  TramaImpl.demoAvanzarDias(N); // ver tabla de abajo para el valor de N
}
```

| Si lo corren... | Próximo lunes | N |
|---|---|---|
| **Hoy, lunes 23/11** (para ensayar) | lunes 30/11 | **`7`** |
| **Mañana, martes 24/11** (demo real) | lunes 30/11 | **`6`** |

`demoAvanzarDias` adelanta el reloj esa cantidad de días **y** en el mismo paso fuerza el envío
(agenda + escalamientos + resumen, porque el día resultante es lunes). Guarden, seleccionen
`_demoForzarAvisos` en el desplegable, Ejecutar.

⚠️ **La Variante 2 deja el reloj del sistema adelantado para todo el mundo hasta que lo reseteen** —
ver el paso de limpieza obligatorio al final de este documento. No lo dejen para después del final
de la clase si se van a olvidar.

### Ensayar hoy exactamente igual que mañana

Hoy (lunes 23/11) en realidad *no* hace falta forzar nada — hoy mismo es día de envío y además es
lunes, así que `ejecutarEnvioAgendaYAvisos` solo (sin ningún truco) ya manda todo. Pero si quieren
practicar el mecanismo tal cual lo van a usar mañana (crear la función temporal, elegirla en el
desplegable, después limpiar), sigan la **Variante 2 con `N = 7`** de la tabla de arriba — así
ensayan el procedimiento completo, botón por botón, aunque hoy no sea técnicamente necesario.

Antes de cerrar el ensayo de hoy, hagan la limpieza de la sección 10 **y además** pídanme a mí
"reseteá al estado demo" — tiene que pasar las dos cosas:
1. Ustedes borran `DEMO_NOW` en Apps Script (reloj).
2. Yo limpio `_Historial` y `_LogAvisos` en el spreadsheet (si no limpio `_LogAvisos`, los
   escalamientos que se manden hoy de prueba —Expo Insumos SRL, Fintech Rioplatense— no se van a
   volver a mandar mañana, porque el sistema ya los marcó como enviados).

### Qué mostrar con los mails ya mandados

- **Gmail de Josefina** → mail "Tu agenda": va a traer **"Café Andes"** o **"Lumen Energía"** en
  "Pinguear" (mail enviado hace más de una semana sin respuesta) y **"Verde Insumos"** /
  **"Expo Insumos SRL"** en "Seguimiento vencido".
- **Gmail de Magali** → mail de escalamiento del club Emprendedores: va a traer
  **"Fintech Rioplatense"** (en Tratativas hace más de 14 días sin movimiento). Josefina (FR) va en
  copia. ("Verde Insumos" NO escala hoy: su seguimiento vence apenas ayer, y hacen falta los 3 días
  de `DIAS_VENCIDO_ESCALA` — sí va a aparecer en la agenda de Josefina como "Seguimiento vencido".)
- Si cayó lunes: **resumen semanal de Magali** (embudo completo del club, nuevo sponsor
  "Horizonte Capital", empresa perdida "Compañía Perdida SA") y **resumen semanal de Caro**
  (consolidado de los 5 clubes — acá solo va a tener datos reales de "Emprendedores", el resto va a
  salir vacío o en cero porque no cargamos mock data en los otros clubes).

---

## 7. Minuto 5:20–5:50 — Cierre (y Calendar sync si da el tiempo)

- Si prepararon el evento de Calendar (paso 0): logueados como Josefina, correr
  `sincronizarCalendar` desde el editor, y mostrar que la empresa del título del evento pasó sola a
  "Reunión coordinada" con la fecha del evento como próxima acción.
- Cierre de 20 segundos: "Josefina carga, Magali y Caro supervisan sin tener que pedir updates —
  los avisos y resúmenes les llegan solos."

---

## 8. Mock data ya cargada — tabla de referencia

| Empresa | Estado | Para qué sirve en la demo |
|---|---|---|
| Constructora Delta | Reunión coordinada → pasa a Tratativas en vivo | Se carga en vivo en el paso 3 (ya estaba en el CRM, segunda reunión con una nueva decisora) |
| Café Andes | Mail enviado | Mail: carocastelnuovo@gmail.com — sync de Gmail en vivo (paso 5) y "Pinguear" en la agenda |
| Lumen Energía | Mail enviado | Mail: magaligporzio@gmail.com — backup del sync de Gmail / segundo "Pinguear" |
| Verde Insumos | Tuvimos reunión, esperando respuesta | Vencida desde ayer → "Seguimiento vencido" en la agenda de Josefina (no llega a escalar: faltan los 3 días de DIAS_VENCIDO_ESCALA) |
| Expo Insumos SRL | Tuvimos reunión, esperando respuesta | Vencida, pingueos=1 → botón "Pingueé" en vivo (paso 4) |
| AgroTech Norte | Mail respondido | Mail: josefinaravera05@gmail.com — libre para usar en el sync de Calendar (paso 6) |
| Beta Insumos | Mail respondido | Próxima acción sin fecha — ejemplo de "sin fecha" al final de la lista |
| Fintech Rioplatense | Tratativas | Sin movimiento hace 20 días → escalamiento por tratativas estancadas |
| Grupo Mercurio | Mail enviado | Historial con 3 pingueos sin respuesta, ejemplo de textura/realismo |
| Impacto Joven | Reunión coordinada | Fondo, próxima acción no vencida |
| Horizonte Capital | Va a ser sponsor | Nuevo sponsor de la semana → aparece en el resumen |
| Compañía Perdida SA | No va a ser sponsor | Empresa perdida → aparece en el resumen |

---

## 9. Qué NO hacer antes de la demo

- No confirmar la segunda reunión de "Constructora Delta" de antemano — tiene que cargarse en vivo.
- No generar el borrador de pingueo de "Expo Insumos SRL" antes del paso 4 (si lo hacen antes, el
  botón va a decir "Generar otro borrador" y el número en vivo va a arrancar en 2 en vez de 1→2).
- No mandar la respuesta desde el Gmail de Caro antes del paso 5.

## 10. Limpieza obligatoria después de probar (ensayo de hoy Y demo real de mañana, si usaron la Variante 2)

1. Editor de Apps Script → ⚙️ **Configuración del proyecto** → **Propiedades del script**.
2. Borrar la fila `DEMO_NOW`.
3. (Opcional) Borrar la función `_demoForzarAvisos` que agregaron en `Code.js` — no rompe nada si
   la dejan, pero conviene no acumular funciones temporales.
4. Avisarle a Claude ("reseteá al estado demo") para que limpie `_Historial` y `_LogAvisos` en el
   spreadsheet — si no se limpia `_LogAvisos`, los escalamientos que ya se mandaron una vez
   (Verde Insumos, Expo Insumos SRL, Fintech Rioplatense) no se vuelven a mandar la próxima vez,
   porque el sistema solo manda cada escalamiento una vez por empresa.

Si no hacen el paso 1-2, el sistema va a seguir pensando que "hoy" es el día adelantado — rompe las
fechas de cualquier post-reunión real que se cargue después. Esto aplica **tanto si lo corren hoy
para ensayar como si lo corren mañana para la demo real** — después de cualquiera de las dos veces
que usen la Variante 2, hay que limpiar.

## 11. Si algo falla en vivo

- **Gemini tarda o da error**: la app no se cuelga — muestra el formulario del paso 2 vacío (o con
  lo que ya había en el CRM) para completar a mano, con un cartel explicando qué pasó. Se puede
  seguir la demo igual, completando el estado y la próxima acción manualmente.
- **El sync de Gmail no detecta la respuesta**: solo mira mails de los últimos 2 días — si pasó más
  tiempo entre mandar el mail de prueba y correr `sincronizarRespuestasGmail`, no es eso; chequeen
  que están logueados en el editor de Apps Script como **Josefina** (el sync mira el Gmail de quien
  lo ejecuta, no el de otra persona).
- **No llegó ningún mail en el paso 6**: lo más común es que el forzado no se haya aplicado —
  revisen que la función temporal realmente haya hecho `TramaImpl.demoAvanzarDias(...)` con
  `forzar` en `true` (ya viene así adentro, no hace falta pasarlo aparte).
