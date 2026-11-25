# Qué hace la app hoy — guía funcional

Este documento explica, en criollo, qué podés hacer con la app tal como está armada hoy (23/11/2026). No es un manual técnico: es "qué veo en la pantalla" y "qué pasa cuando hago click".

> Nota: el spreadsheet real, la API key de Gemini, los templates por club y los parámetros ya están configurados — lo que sigue describe el comportamiento tal como corre hoy, no un plan a futuro.

---

## 1. Cargar un post-reunión

Es la pantalla principal: la usás apenas termina una reunión con una empresa.

### Paso 1 — Datos de la reunión
Completás:
- **Club**: viene precargado con el tuyo. Si sos codirectora, podés elegir entre los 5 clubes (Agro, Consultoría, Finanzas y Tecnología, Emprendedores, Trama Lab); si sos FR, solo ves el tuyo.
- **Empresa**: hay autocompletado contra las empresas que ya están en el CRM de tu club. Si la empresa es nueva, no pasa nada, se crea.
- **Fecha de la reunión**.
- **Notas**: pegás las notas de la reunión (pensado para texto de Granola). Tienen que tener **al menos 100 caracteres**, si no, la app no te deja seguir.

Al apretar para procesar, la IA (Gemini) lee las notas y te completa el paso 2 automáticamente.

### Paso 2 — Revisar y confirmar
Te aparece un formulario ya completado con lo que Gemini extrajo, para que lo revises y corrijas antes de confirmar:

- **Persona de contacto** (nombre, rol, mail, teléfono, LinkedIn) — de la persona de la empresa, no de alguien de Trama.
- **Compromisos de la empresa** (lo que ellos prometieron) y **compromisos de Trama** (lo que nosotros prometimos, o lo que ellos nos pidieron).
- **Párrafo de compromisos**: un textito ya armado en primera persona del plural, pensado para pegarlo en el mail de agradecimiento.
- **Comentarios**: un resumen de 2 a 4 oraciones de cómo fue la reunión, para la columna "Comentarios" del CRM.
- **Estado** (desplegable, ver sección 2).
- **Próxima acción** y su **fecha** (ver sección 3).
- Un listado de **"campos faltantes"**: todo lo que Gemini no pudo sacar de las notas y que te conviene completar a mano.

Antes de confirmar también podés:
- **Previsualizar el mail** de agradecimiento que se va a armar (con el template del club + tu firma de Gmail, si tenés una configurada).
- **Agregar adjuntos extra** desde la carpeta de Drive del club (además de los adjuntos fijos que ya trae el template).

### Al confirmar
No se puede confirmar si:
- Falta el mail del contacto.
- El mail tiene formato inválido.
- El estado elegido no es un estado válido para cargar un post-reunión, o no se puede pasar de donde está la empresa hoy a ese estado (ver sección 2).
- La fecha de próxima acción es anterior a la fecha de la reunión.

Si todo está bien, al confirmar pasan dos cosas, en este orden:
1. **Se actualiza el CRM** (la fila de la empresa en la hoja de tu club): se graba el nuevo estado, los datos de contacto, se agrega una línea nueva a "Comentarios" (con la fecha de la reunión adelante, ej. `[18/11] Reunión con Martina...`), se actualiza la "Fecha último contacto" y se resetean los pingueos sin respuesta a 0.
2. **Se crea un borrador de Gmail** con el mail de agradecimiento ya armado (template del club + tus compromisos + tu firma + adjuntos), **en tu carpeta de Borradores** — nunca se manda solo. Lo revisás y lo mandás vos.
   - El template es un **Google Doc por club** (no HTML suelto): conserva negrita, cursiva, viñetas y links tal como estén armados en el Doc. Si no hubo compromisos en la reunión, el párrafo de compromisos se borra entero del mail (no queda un hueco vacío).
   - Si tenés una firma configurada en Gmail, se agrega sola al final. Si no tenés, el mail sale sin firma (no rompe nada).
   - Los adjuntos fijos del club (PDB, material del evento) se agregan siempre, más los adjuntos extra que elijas vos en el paso 2.

Si falla el paso 1 (CRM), no se crea el borrador — nada queda a mitad de camino. Si el CRM se actualizó bien pero falla el borrador (ej. se quedó sin cuota Gmail), te avisa que el CRM quedó actualizado pero el mail no, y te deja un botón para **reintentar solo el borrador** sin tocar el CRM de nuevo.

Confirmar la misma reunión dos veces (por error, doble click, etc.) no duplica nada: ni la línea de comentario, ni el registro en el historial, ni el borrador (si ya había uno con el mismo destinatario y asunto, se reemplaza).

---

## 2. Los 5 estados del post-reunión

Al cargar un post-reunión, el desplegable de estado solo te deja elegir entre estos 5 (no "Mail enviado" ni "Mail respondido", porque a esos se llega antes de la reunión):

| Estado | Cuándo corresponde |
|---|---|
| **Reunión coordinada** | Quedaron en tener otra reunión antes de avanzar. **Es el default** si Gemini no está seguro o sugiere algo fuera de este set — ver nota abajo. |
| **Tuvimos reunión, esperando respuesta** | Hubo interés pero la empresa todavía no se comprometió; quedó en responder o pensarlo. |
| **Tratativas** | La empresa ya está negociando en concreto (categoría, condiciones, convenio) pero falta cerrar. |
| **Va a ser sponsor** | La empresa confirmó explícitamente que va a ser sponsor. |
| **No va a ser sponsor** | La empresa dijo explícitamente que no va a participar. |

**Importante sobre el default**: aunque Gemini sugiera "Tuvimos reunión, esperando respuesta" por el contenido de la reunión, la app **solo respeta automáticamente** las sugerencias de "Tratativas", "Va a ser sponsor" o "No va a ser sponsor" (son las que no dejan dudas). Cualquier otra sugerencia (incluida "Tuvimos reunión, esperando respuesta") queda preseleccionada como **"Reunión coordinada"** hasta que mandes el mail de agradecimiento — recién ahí, cuando la sincronización con Gmail detecta que lo mandaste, el sistema la pasa sola a "Tuvimos reunión, esperando respuesta". La idea es que el estado no diga "esperando respuesta" cuando en realidad el mail todavía es un borrador sin enviar.

Además, no cualquier estado se puede pasar a cualquier otro: hay una tabla de transiciones válidas. Por ejemplo, de "Reunión coordinada" solo se puede pasar a "Tuvimos reunión, esperando respuesta" o "No va a ser sponsor". Si intentás una transición no permitida, la app te lo dice con un mensaje claro ("No se puede pasar la empresa de 'X' a 'Y'.").

---

## 3. Cómo se calcula la "próxima acción" (y por qué a veces queda vacía)

Esta es la parte más cuidada de la extracción, porque la idea es que **la IA nunca invente una fecha**.

- La "próxima acción" que te completa el sistema es específicamente **lo próximo que esperamos de la empresa** (una respuesta, una firma, una reunión) — nunca una tarea nuestra. Las tareas de Trama (mandar el PDB, fotos, un reglamento, etc.) van aparte, en "Compromisos de Trama", justamente para no mezclarlas con el seguimiento.
- El formato que usa es `"Seguimiento con <persona>: <qué esperamos>"`.
- Para la **fecha**, Gemini tiene que citar textualmente el fragmento de las notas de donde la sacó. El sistema después **verifica que ese fragmento exista literalmente en las notas** y que hable de una fecha (un día del mes, un día de la semana, "la semana que viene", etc.). Si ese respaldo no está, la fecha se descarta y queda en blanco — marcada como "campo faltante" para que la completes a mano.
- Por eso, si las notas dicen "nos responde antes del 4/12", la fecha sale `04/12`. Pero si las notas dicen solo "lo va a hablar con su equipo" sin ninguna fecha, **la IA nunca pone "mañana" o "en una semana" para no inventar** — queda vacía.
- Una fecha de próxima acción no puede quedar anterior a la fecha de la reunión; si Gemini (o vos a mano) pone algo así, se invalida.
- Al confirmar, la próxima acción y su fecha **no se heredan automáticamente de lo que ya había cargado antes** para esa empresa: si esta reunión no dejó una próxima acción clara, queda vacía (aunque hubiera una vieja), para que no quede una fecha vencida de la reunión anterior dando vueltas.
- Los datos de contacto (persona, mail, teléfono, LinkedIn) sí se completan solos con lo que ya había en el CRM si esta vez las notas no los mencionan — ahí no hay riesgo de inventar nada, es tomar un dato real que ya estaba cargado.

---

## 4. Mensajes de error que vas a ver (y qué significan)

La app traduce los errores técnicos a algo entendible. Algunos ejemplos reales:

- **"No tenés acceso, pedíselo a tu coordinador."** → tu mail no está en la hoja de usuarios.
- **"No podés operar sobre el club X."** → intentaste cargar algo de un club que no es el tuyo (y no sos codirectora).
- **"Falta la empresa."** / **"Las notas tienen que tener al menos 100 caracteres."** / **"La fecha de la reunión no es válida."** → validaciones del paso 1.
- **"No se puede pasar la empresa de 'X' a 'Y'."** → transición de estado no permitida.
- **"Falta el mail del contacto."** / **"El mail del contacto no es válido."** → no se puede confirmar sin un mail válido (se necesita para armar el borrador).
- **"No se pudieron completar los datos automáticamente: [la clave de la IA no es válida / la IA está saturada en este momento / se alcanzó el límite de uso de la IA / la IA devolvió una respuesta incompleta]. Podés completarlos a mano, o volver y probar de nuevo en unos minutos."** → falló Gemini (por el motivo que sea); te deja un formulario con lo que ya había en el CRM para completar vos mismo.
- **"La app no tiene los permisos de Google que necesita para esto. Avisale al equipo para que lo revise."** → problema de permisos de Google.
- **"Google limitó el uso de la app por hoy. Probá de nuevo más tarde."** → se llegó a un límite de uso de Apps Script/Google.
- **"Alguien más está actualizando el CRM en este momento. Esperá unos segundos y probá de nuevo."** → dos personas tocando la misma hoja al mismo tiempo.
- **"Hay un problema con la configuración del CRM o de los templates. Avisale al equipo para que lo revise."** → falta una hoja, una columna, un parámetro o el template del club no está bien armado.
- **"Ocurrió un error inesperado. Probá de nuevo y, si sigue pasando, avisale al equipo."** → cualquier error que no matchea con ninguna de las reglas anteriores; en estos casos el detalle técnico queda guardado en el log de Apps Script para que el equipo lo pueda revisar.

En todos los casos, el detalle técnico nunca se pierde: queda registrado en el log de ejecuciones de Apps Script, aunque en pantalla veas el mensaje corto.

---

## 5. "Mis seguimientos"

Es la lista de las empresas que **tenés asignadas** (coincide tu nombre con "Tramero encargado") y que **todavía no llegaron a un estado final** (no están en "Va a ser sponsor" ni "No va a ser sponsor").

Para cada empresa ves:
- Estado actual.
- Próxima acción y su fecha (si la hay).
- Cuántos pingueos sin respuesta lleva.
- Si está **vencida** (la fecha de próxima acción ya pasó) — estas se muestran primero; las que no tienen fecha cargada quedan al final de la lista.
- Los estados a los que podés moverla desde ahí (según la transición válida desde el estado actual).

Desde esta pantalla podés, por empresa:
- **Registrar un pingueo** (sumale +1 al contador de pingueos sin respuesta, y actualiza la fecha de último contacto).
- **Registrar una respuesta** (resetea los pingueos a 0; si estaba en "Mail enviado" pasa a "Mail respondido").
- **Cambiar el estado** manualmente (si la transición es válida).

---

## 6. Qué mails te llegan automáticamente (una vez desplegado)

Esto corre solo, los **lunes, miércoles y viernes a las 9 de la mañana** (son los únicos días de envío configurados). Son varios tipos de aviso, que se agrupan en un solo mail por destinatario para no mandar un mail por cada cosita:

### Tu "Agenda" (mail para cada FR)
Agrupa, con todo lo tuyo separado en "Vencido" y "Hasta el próximo envío":
- **Cargar post-reunión**: te quedó una reunión coordinada hace más de X horas (parámetro del club) y todavía no cargaste el post-reunión.
- **Pinguear**: mandaste un mail hace X días y no te respondieron, o te respondieron y no coordinaste la reunión todavía.
- **Seguimiento vencido**: la próxima acción que habías cargado ya venció (o vence hoy, o vence pronto), o pasó mucho tiempo sin contacto y no hay próxima acción cargada.
- **Compromiso de Trama**: mañana vence algo que nosotros nos comprometimos a mandar/hacer.

El asunto te dice de un vistazo cuántos vencidos y cuántos próximos tenés: `[Trama FR] Tu agenda: 2 vencidos, 3 para esta semana`.

### Escalamientos (mail para coordinadores de cada club, con el FR en copia)
Cuando una empresa queda "trabada": muchos pingueos sin respuesta, tratativas estancadas hace mucho, o un seguimiento muy vencido sin movimiento. El texto plantea la pregunta abierta, por ejemplo: *"¿la damos por perdida?"*.

### Resumen semanal para coordinadores (solo los lunes)
Por club: contactos nuevos vs. semana anterior, reuniones hechas, nuevos sponsors, el embudo completo (cuántas empresas hay en cada estado), empresas trabadas, cuánto cargó cada FR esa semana, y algunas recomendaciones automáticas (ej. "Fulana tiene 2 seguimientos vencidos").

### Resumen semanal para codirectoras (solo los lunes)
Un consolidado de los 5 clubes: contactos, reuniones, sponsors y trabadas por club, qué clubes bajaron su actividad respecto a la semana anterior, y los nuevos sponsors de la semana en toda Trama.

---

## 7. Sincronizaciones automáticas (cada 1 hora, por usuario)

Cuando entrás a la app por primera vez, se instalan solas dos sincronizaciones personales que corren cada hora en tu cuenta:

- **Con tu Google Calendar** (mira los próximos 30 días): si tenés un evento agendado con alguien de una empresa del CRM (lo detecta por el mail de los invitados o por el nombre de la empresa en el título), la pasa automáticamente a estado **"Reunión coordinada"** y le carga la fecha del evento como próxima acción. Si ya estaba en "Reunión coordinada", solo actualiza la fecha (por ejemplo, si reprogramaron). Si la empresa ya avanzó más allá (Tratativas, sponsor, etc.), no la retrocede.
- **Con tu Gmail** (mira los últimos 2 días): si una empresa te escribe un mail nuevo (y no está en un estado final), lo detecta y te resetea los pingueos sin respuesta y actualiza la fecha de último contacto — sin leer ni guardar el contenido del mail, solo mira remitente y fecha.

---

## Estado: ya está en producción

Toda la lógica de arriba está escrita, tiene tests automáticos que la validan, y ya está desplegada con los datos reales de Trama: el spreadsheet conectado, la clave de Gemini, los templates y carpetas de cada club (`_Clubes`) y los parámetros (`_Parametros`) ya están cargados. No es un prototipo a la espera de configuración — es lo que usás hoy.
