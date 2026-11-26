# Trama FR Assistant

Una web para el equipo de Fundraising: después de cada reunión con una empresa pegás las notas de
Granola y la app completa el CRM y te deja armado el mail de seguimiento en tu Gmail. Además mueve
sola algunos estados del CRM cuando detecta respuestas por mail, y una vez por semana te avisa
qué empresas tenés que seguir.

> Por ahora funciona completo solo para **Emprendedores**. El resto de los clubes puede entrar,
> pero todavía no tiene los templates de mail ni recibe avisos.

**Link:** https://script.google.com/a/macros/itba.edu.ar/s/AKfycbzQoDFbqRGxBn_LabrwLdfohoknts1EKYPm1aqUxzmohEuQVLL_NHfV9y_k_n3-QV_x/exec

---

## 1. Cómo entrar

1. Abrí el link con tu cuenta **@itba.edu.ar** (con una cuenta personal de Gmail no te va a
   reconocer).
2. La primera vez Google te pide permisos: leer y editar las planillas, crear borradores en tu
   Gmail, leer tu Calendar y mandarte avisos por mail. Aceptá una sola vez.
   - Te va a aparecer una pantalla que dice que **Google no verificó esta app**. Es normal: la app
     es interna de Trama y no pasó por la revisión de Google (que es para apps públicas). Tocá
     **"Configuración avanzada"** → **"Ir a Trama FR Assistant - web (no seguro)"** y aceptá.
3. Listo. En ese primer ingreso también se activan tus sincronizaciones automáticas con Gmail y
   Calendar (ver sección 5). No hace falta dejar la web abierta: corren solas.

Si te aparece "No tenés acceso", fijate con qué cuenta entraste (la app te la muestra). Si es la
del ITBA, pedile a Josefina Ravera que te agregue.

### Si tenés varias cuentas de Google abiertas

Las web apps de Google suelen entrar con la primera cuenta con la que te logueaste en el
navegador, aunque elijas otra. Si te entra con una cuenta personal en vez de la del ITBA:

- **Lo más rápido:** abrí una ventana de incógnito (Ctrl+Shift+N en Chrome), pegá el link y entrá
  solo con tu cuenta @itba.edu.ar.
- **Para usarla siempre:** creá un perfil de Chrome solo para el ITBA (tu foto arriba a la
  derecha → "Agregar") y abrí la app desde ese perfil.
- **Otra opción:** cerrá sesión de todas tus cuentas en gmail.com, entrá primero con la del ITBA
  y después abrí el link.

Si entraste con otra cuenta por error, no pasa nada: esa cuenta no tiene acceso a nada. Si querés
sacarle los permisos que aceptaste: myaccount.google.com → Seguridad → "Conexiones con apps y
servicios de terceros".

## 2. Qué puede hacer cada uno

| Rol | Qué ve y qué puede hacer |
|---|---|
| **FR** | Carga post-reuniones y ve sus seguimientos. Ve (sin poder editar) las empresas de todo su club. |
| **Coordinador** | Lo mismo que un FR para su club. Además recibe los escalamientos y el resumen semanal del club. |
| **Codirectora** | Puede cargar para cualquier club. Recibe el resumen semanal de todos los clubes. |

## 3. Cargar un post-reunión

**Paso 1: las notas**
- Elegí la fecha de la reunión y la empresa. Mientras escribís, la app te sugiere las empresas
  que ya están en la hoja de tu club y te muestra en qué estado está.
- Pegá las notas de Granola (mínimo 100 caracteres) y tocá procesar.

**Paso 2: revisar y confirmar**
- La app completa sola los datos que encontró en las notas: persona de contacto, rol, mail,
  teléfono, LinkedIn, próxima acción y su fecha, los compromisos de la empresa y los de Trama, y
  un resumen para la columna Comentarios. Los campos que no pudo sacar quedan marcados como
  "falta".
- Revisá y corregí lo que haga falta. El mail del contacto es obligatorio. Podés poner varios separados por coma: al confirmar se suman a los que ya estaban en el CRM (no se borra ninguno) y el borrador va dirigido a todos.
- Elegí el estado. Por defecto queda en **"Reunión coordinada"**, salvo que de las notas se
  desprenda que están en tratativas o que ya dijeron que sí o que no.
- Podés sumar adjuntos de la carpeta del club y ver cómo queda el mail antes de confirmar.

**Al confirmar:**
- Se actualiza la fila de la empresa en el CRM (o se crea si es nueva). El resumen se agrega a
  Comentarios con la fecha adelante, sin borrar lo que ya había. Las columnas propias del club
  (por ejemplo "Es traspaso?") no se tocan.
- Te queda un **borrador** en tu Gmail con el mail de seguimiento. **Nunca se manda solo**: lo
  revisás y lo mandás vos.
- El asunto es **"Empresa & Trama ITBA"**. Cuando mandás ese borrador, la empresa pasa sola a
  **"Tuvimos reunión, esperando respuesta"** (ver sección 5). Mandalo desde el mismo borrador
  (podés editar el texto y el asunto, pero no lo copies a un mail nuevo).

## 4. Mis seguimientos

Lista de tus empresas que todavía no tienen un estado final, ordenadas por fecha de próxima
acción (las vencidas primero). Podés filtrarlas y, para cada una, tocar **pinguear**: te deja un
borrador de pingueo en tu Gmail (asunto "Empresa & Trama ITBA", con el template que corresponda según si ya hubo reunión o no).
El pingueo se cuenta en "Pingueos sin respuesta" **cuando mandás el borrador** (puede tardar
hasta una hora en verse), no cuando lo generás. Mandalo desde el mismo borrador.

Las empresas que aparecen son las que tienen tu nombre en "Tramero encargado". Por eso es
importante que ese nombre esté escrito como figura en el sistema (no importan tildes ni
mayúsculas, pero sí que sea el mismo nombre y apellido).

### Equipo

Pestaña para ver todas las empresas de tu club (las tuyas y las de tus compañeros): quién la lleva,
contacto, estado, próxima acción, último contacto y pingueos. Se puede filtrar por tramero
encargado, por estado o buscar por nombre. Las codirectoras pueden elegir cualquier club.

Es **solo para ver**: no tiene botones para editar ni para generar borradores. Las empresas de un
compañero no se pueden pinguear desde la app; eso lo hace quien la lleva.

## 5. Lo que la app hace sola

Cada una hora, con la cuenta de cada persona que ya entró al menos una vez, la app revisa Gmail y
Calendar y actualiza el CRM de su club:

| Si pasa esto | La empresa pasa de… | …a |
|---|---|---|
| La empresa nos escribe | Mail enviado | Mail respondido |
| La empresa responde el mail de traspaso | FR viejo mando el mail de traspaso | Respondió traspaso |
| El tramero encargado le escribe a la empresa después de que respondió el traspaso | Respondió traspaso | Mail enviado |
| Mandás el borrador post-reunión que te dejó la app | Reunión coordinada | Tuvimos reunión, esperando respuesta |
| Mandás el borrador de pingueo que te dejó la app | (no cambia el estado) | suma uno a "Pingueos sin respuesta" |
| Hay un evento en tu Calendar con la empresa (por nombre en el título o por invitados con su dominio) | cualquier estado no final | Reunión coordinada (y carga la fecha del evento como próxima acción) |

En los otros casos de mail, los pingueos vuelven a 0. En todos se actualiza "Fecha último contacto".

Para que esto funcione:
- El mail de la empresa tiene que estar en la columna **Mail**. Si hay varios contactos, podés
  poner varios mails en la misma celda (separados por coma, punto y coma, barra o renglón).
- El mail tiene que llegarle a alguien que ya entró a la app: al encargado, o a un coordinador
  o codirectora que esté **en copia**. Si la empresa le responde solo al FR del año pasado, la app
  no lo ve y hay que cambiar el estado a mano.

La app solo lee de quién es cada mail, a quién va y la fecha. No lee ni guarda el contenido.

Además, una vez por día se registran los cambios de estado que alguien hizo a mano en la
planilla, para que cuenten en el resumen semanal.

## 6. Estados de una empresa

| Estado | Puede pasar a |
|---|---|
| Mail enviado | Mail respondido, Reunión coordinada, No va a ser sponsor |
| Mail respondido | Reunión coordinada, No va a ser sponsor |
| FR viejo mando el mail de traspaso | Respondió traspaso, Reunión coordinada, No va a ser sponsor |
| Respondió traspaso | Mail enviado, Reunión coordinada, No va a ser sponsor |
| Reunión coordinada | Tuvimos reunión, esperando respuesta · Tratativas · No va a ser sponsor |
| Tuvimos reunión, esperando respuesta | Tratativas · Va a ser sponsor · No va a ser sponsor · Reunión coordinada |
| Tratativas | Va a ser sponsor · No va a ser sponsor · Reunión coordinada |
| Va a ser sponsor | (final) |
| No va a ser sponsor | (final) |

La app no deja hacer saltos que no están en la tabla (por ejemplo, de "Mail enviado" a
"Tratativas"). Si escribís a mano un estado que no existe, la app no se rompe pero esa empresa
no cuenta en los resúmenes.

## 7. Avisos por mail

Los avisos los manda la app a la mañana (9:00). No son borradores: llegan a tu casilla.

| Quién | Qué recibe | Cuándo |
|---|---|---|
| **FR** | Un solo mail con todo lo pendiente (ver abajo) | Una vez por semana, los **lunes** |
| **Coordinadores** | Escalamientos de su club | Lunes, miércoles y viernes |
| **Coordinadores** | Resumen semanal del club | Lunes |
| **Codirectoras** | Resumen semanal de todos los clubes | Lunes |

**El mail semanal del FR** junta:
- Post-reuniones sin cargar: la reunión ya pasó (más de 24 hs) y la empresa sigue en "Reunión
  coordinada".
- Empresas para pinguear:
  - "Mail enviado" o "FR viejo mando el mail de traspaso" sin respuesta hace 7 días o más.
  - "Mail respondido" o "Respondió traspaso" sin reunión coordinada hace 3 días o más.
- Seguimientos: empresas en "Tuvimos reunión…" o "Tratativas" con la próxima acción vencida o
  que vence antes del lunes siguiente, o sin próxima acción y 7 días sin contacto.
- Compromisos de Trama que vencen antes del lunes siguiente.

**Escalamientos al coordinador** (se mandan una sola vez por empresa):
- 2 pingueos o más sin respuesta y 7 días sin contacto.
- "Tratativas" sin movimiento hace 14 días o más.
- Próxima acción vencida hace 3 días o más.

**Resumen semanal**: contactos nuevos y reuniones de la semana (comparado con la anterior),
nuevos sponsors, cuántas empresas hay en cada estado, empresas trabadas, actividad de cada FR y
recomendaciones.

## 8. Para que todo funcione bien

- Entrá a la app al menos una vez, aunque no tengas nada para cargar: así se activan tus
  sincronizaciones.
- Cuando le escribas a una empresa de traspaso, poné a tu coordinador en copia.
- Mantené cargados en el CRM el mail de la empresa y tu nombre como "Tramero encargado".
- No cambies los nombres de las columnas del CRM. Agregar columnas nuevas no rompe nada.
- Los borradores quedan en tu Gmail: revisalos antes de mandarlos.

¿Dudas o algo que no anda? Escribile a Josefina Ravera.
