# Guion de la demo por partes (Josefina, Carolina y Magali)

Complementa a `demo-profesores.md` (ahí están los pasos técnicos, los tiempos exactos y la
limpieza). Esto es **quién dice qué**: cada una se hace cargo de un tramo completo y lo presenta de
principio a fin, en vez de ir dialogando entre las tres.

> Nota de nombres: en este guion "Carolina" es **Caro** (Carolina Castelnuovo, codirectora) — la
> misma persona del punto 0 de `demo-profesores.md`. No confundir con "Carolina Suárez", el
> contacto ficticio de Constructora Delta que aparece *dentro* de las notas que carga Josefina: esa
> es solo un nombre en la mock data, no la tiene que decir nadie en voz alta salvo Josefina al leer
> las notas.

Texto entre `[corchetes]` es acotación de escena, no se lee en voz alta.

---

## Parte 1 — Intro (0:00–0:40)

Tres intervenciones cortas y seguidas, cada una desde su propio lugar. No hay preguntas entre
medio.

**Josefina:** Les cuento el problema que esto resuelve. Hoy, después de cada reunión, el FR tiene
que armar un mail con el resumen para la empresa. Hay un template, pero si pidieron algo extra o se
comprometieron a algo puntual, me tengo que sentar unos minutos más a pensar cómo redacto esa
parte. Y además de mandar ese mail, tengo que completar todo el CRM: estado, fechas de próxima
acción, y un mini resumen de la reunión — que, por fiaca, muchas veces termina sin llenarse.

**Caro:** Desde la codirección, eso se nota: terminamos con historias incompletas en el CRM,
reuniones de las que no queda registro de lo que se habló.

**Magali:** Y desde la coordinación, implicaba mirar el CRM todo el día para enterarme de qué
estaba pasando, y encima rogarle al FR que después de la reunión se sentara a mandar el mail.

**Josefina:** Voy a mostrar cómo queda esto ahora.

---

## Parte 2 — Josefina: cargar el post-reunión y mis seguimientos (0:40–3:20)

*Todo este tramo lo lleva Josefina sola, sin interrupciones.*

Voy a cargar una reunión real que tuvimos. La empresa es Constructora Delta, que ya está en el CRM
— tuvimos una primera reunión con el Jefe de Comunicación, y ahora coordinamos una segunda con la
decisora real de sponsoreo. Uso una empresa que ya existe a propósito: en la realidad nunca
llegamos a "Reunión coordinada" sin que antes haya un mail o un evento de Calendar que la haya
creado.

*[Empieza a escribir "Constructora Delta" en el campo de empresa.]* El autocompletado ya la trae
del CRM, con el estado actual: "Reunión coordinada".

*[Pega las notas de Granola.]* Pego las notas tal como las tomamos en la reunión, y clickeo
"Procesar notas". Esto se lo manda a Gemini con el prompt del equipo de extracción — no inventa
nada que no esté en el texto.

*[Carga el resultado.]* El contacto de arriba cambió solo a Carolina Suárez, la Gerente de
Sustentabilidad, porque ahora las notas hablan de ella. Pero acá abajo, en "Comentarios que ya tenía
la empresa en el CRM", queda el historial completo de la primera reunión con Gustavo. No se pisa
nada, se va acumulando.

También separa los compromisos: lo que promete la empresa —que el área legal firma antes del 10 de
diciembre— de lo que prometemos nosotros, que les mandamos el borrador del convenio mañana. La
próxima acción ya sale con fecha, 10/12, y esa fecha no la puso nadie a mano: salió literal de
"firman antes del 10/12" en las notas. Si las notas no decían una fecha, hubiera quedado vacía — la
IA no inventa fechas.

El estado sugerido es "Tratativas", y el desplegable lo deja pasar directo porque es una de las tres
sugerencias seguras. El criterio es: la empresa ya dijo que sí, pero ese sí depende de algo que
nosotros tenemos que mandar y ellos aprobar — todavía no pagaron. Por eso no es lo mismo que
"Tuvimos reunión, esperando respuesta", que es el estado típico después de una primera reunión.

*[Confirma.]* Quedan dos resultados: el link al CRM —la fila de Constructora Delta se actualizó, no
se creó una nueva— y el botón para abrir en Gmail el mail de agradecimiento ya armado, con los
compromisos incluidos.

*[Va a "Mis seguimientos".]* Esta es mi vista del día a día. Si filtro por "Vencidos" me aparecen
Expo Insumos SRL y Verde Insumos, porque ya pasó su fecha de próxima acción. En Expo Insumos ya le
había generado un borrador de pingueo una vez — *[click en "Generar otro borrador"]* — el sistema
arma un nuevo borrador en Gmail, con el template que corresponde según el estado actual de la
empresa, y solo si ese borrador se creó bien, en el mismo paso sube el contador de pingueos de 1 a
2 y me deja el link "Ver borrador" para abrirlo. Así queda registro de que insistí, sin que el
contador suba si el mail no se llegó a armar.

Una cosa más: si abro el desplegable de "Nuevo estado" en cualquier empresa, solo me ofrece los
estados a los que puedo pasar desde donde está ahora. Si alguien intentara forzar un salto raro
desde el CRM a mano, el sistema lo rechaza con un mensaje claro.

---

## Parte 3 — Caro: el sync automático de Gmail (3:20–4:10)

*Este tramo lo lleva Caro sola, desde su Gmail personal. Josefina corre la función en el editor de
Apps Script como una acotación técnica, sin que haga falta que hable.*

Tengo cargada mi cuenta personal como si fuera el contacto de Café Andes, una empresa a la que le
mandamos un mail hace más de una semana y nunca respondió. Esto es justamente lo que antes nos
pasaba todo el tiempo: mails que quedan esperando y nadie se entera cuándo contestan hasta que
alguien va a revisar a mano.

*[Responde cualquier cosa al mail de Josefina desde su Gmail personal.]* Listo, acabo de responder
como si fuera el contacto real de Café Andes.

*[Josefina, en paralelo y sin narrar, corre `sincronizarRespuestasGmail` en el editor de Apps
Script.]*

*[Refrescan "Mis seguimientos".]* Y ahí está: Café Andes pasó sola de "Mail enviado" a "Mail
respondido", y el contador de pingueos volvió a cero. Nadie tocó el CRM a mano — el sistema se dio
cuenta solo de que respondieron.

---

## Parte 4 — Magali: los mails automáticos (4:10–5:20)

*Este tramo lo lleva Magali sola, como la mirada de supervisión. Describe los tres mails aunque
alguno le llegue a otra persona.*

Esto en la realidad corre solo lunes, miércoles y viernes a las 9, y es la parte que más cambia mi
día a día como coordinadora: antes tenía que entrar al CRM y recorrerlo entero para saber qué
estaba pasando. Ahora me entero por mail.

A Josefina le llega "Tu agenda" — le trae a Café Andes o Lumen Energía para pinguear, porque les
mandó mail hace más de una semana sin respuesta, y a Verde Insumos y Expo Insumos SRL como
seguimiento vencido.

*[En su propio Gmail.]* A mí me llega el mail de escalamiento del club. Hoy trae a Fintech
Rioplatense, que lleva más de 14 días en Tratativas sin moverse, con Josefina en copia — así no es
que yo me entero de algo y ella se entera recién cuando le pregunto. Verde Insumos todavía no
escala, aunque esté vencida desde ayer: hacen falta tres días más para que salte el escalamiento.

Y si cae lunes, hay dos resúmenes semanales más: a mí me llega el del embudo completo de este club
—el sponsor nuevo de la semana, Horizonte Capital, y la empresa que se cayó, Compañía Perdida SA— y
a Caro le llega el consolidado de los cinco clubes, aunque hoy solo tenga datos reales de
Emprendedores.

---

## Parte 5 — Cierre (5:20–5:50)

*Tres cierres cortos y consecutivos, cada una desde su rol, sin retomar lo que dijo la anterior.*

**Josefina:** *[si prepararon el evento de Calendar]* Última cosa: corro `sincronizarCalendar`, y
la empresa que coincide con el título del evento pasa sola a "Reunión coordinada", con la fecha del
evento como próxima acción. Yo cargo una vez, cuando termina la reunión.

**Caro:** Desde la codirección, dejamos de depender de que alguien se acuerde de contarnos cómo
viene cada club.

**Magali:** Y desde la coordinación, los avisos y los resúmenes nos llegan solos, sin tener que
perseguir a nadie.

---

## Notas de reparto para el día de la demo

- **Josefina** lleva la Parte 1 (su tramo), la Parte 2 completa y el cierre de Calendar. Necesita su
  laptop/pantalla compartida con la webapp y el editor de Apps Script.
- **Caro** lleva la Parte 3 completa — necesita su Gmail personal (`carocastelnuovo@gmail.com`)
  abierto y logueado, idealmente en su propio dispositivo para no competir con la pantalla de
  Josefina. También tiene su línea en la Parte 1 y en el cierre.
- **Magali** lleva la Parte 4 completa y solo necesita su Gmail (`mgonzalezporzio@itba.edu.ar`)
  abierto. No necesita tocar la webapp. También tiene su línea en la Parte 1 y en el cierre.
- Cada parte está pensada para leerse de corrido, sin que las otras dos interrumpan con preguntas —
  si alguna quiere agregar algo, mejor guardarlo para el cierre que para el medio del tramo de otra.
