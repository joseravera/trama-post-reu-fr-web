// Dueño: Persona B (sección 6, B5). Corre como cada FR (trigger por usuario, ver triggersUsuario.ts),
// cada 1 hora. Busca en su calendario los eventos de los próximos 30 días (creados por él o a los
// que está invitado) y, si entre los invitados hay alguien de una empresa que tiene a su cargo
// ("Tramero encargado"), la pasa a "Reunión coordinada". El título del evento no se mira.

import { crearConfigService } from '../crm/config';
import { crearCrmService } from '../crm/repo';
import { now } from '../shared/clock';
import { mismoNombre } from '../shared/nombres';
import { elegirMejorCoincidencia } from './matching';

const DIAS_VENTANA = 30;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

export function sincronizarCalendar(): void {
  const mailUsuario = Session.getActiveUser().getEmail();
  const config = crearConfigService();
  const usuario = config.getUsuario(mailUsuario);
  if (!usuario || !usuario.club) return; // no registrado, o codirectora sin club fijo: no sincroniza
  if (!config.getClubesActivos().includes(usuario.club)) return; // club que todavía no usa el sistema

  const crm = crearCrmService();
  // Solo las empresas que lleva este usuario: el evento tiene que estar en el calendario del encargado.
  const filas = crm.listarFilas(usuario.club).filter((f) => mismoNombre(f.trameroEncargado, usuario.nombre));
  if (filas.length === 0) return;

  const desde = now();
  const hasta = new Date(desde.getTime() + DIAS_VENTANA * MS_POR_DIA);
  const eventos = CalendarApp.getDefaultCalendar().getEvents(desde, hasta);

  for (const evento of eventos) {
    const mailsInvitados = evento.getGuestList().map((g) => g.getEmail());
    const filaMatch = elegirMejorCoincidencia(filas, mailsInvitados);
    if (!filaMatch) continue;
    // getStartTime() devuelve el Date "no estándar" de Apps Script: lo paso a Date real.
    const fechaEvento = new Date(evento.getStartTime().getTime());
    crm.registrarReunionCoordinada(usuario.club, filaMatch.empresa, fechaEvento, usuario);
  }
}
