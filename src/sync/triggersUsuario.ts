// Dueño: Persona B (sección 6, B7). Triggers por usuario: corren con la identidad de quien los
// instaló, por eso Calendar y Gmail necesitan un trigger por FR (instalado en su primer ingreso,
// llamado desde A1). Idempotente: no instala dos veces, y se puede desinstalar.

export const FUNCION_SYNC_CALENDAR = 'sincronizarCalendar';
export const FUNCION_SYNC_GMAIL = 'sincronizarRespuestasGmail';

function instalarSiNoExiste(nombreFuncion: string): void {
  const yaExiste = ScriptApp.getProjectTriggers().some((t) => t.getHandlerFunction() === nombreFuncion);
  if (yaExiste) return;
  ScriptApp.newTrigger(nombreFuncion).timeBased().everyHours(1).create();
}

export function instalarTriggersUsuario(): void {
  instalarSiNoExiste(FUNCION_SYNC_CALENDAR);
  instalarSiNoExiste(FUNCION_SYNC_GMAIL);
}

export function desinstalarTriggersUsuario(): void {
  const nombres: string[] = [FUNCION_SYNC_CALENDAR, FUNCION_SYNC_GMAIL];
  for (const trigger of ScriptApp.getProjectTriggers()) {
    if (nombres.includes(trigger.getHandlerFunction())) ScriptApp.deleteTrigger(trigger);
  }
}
