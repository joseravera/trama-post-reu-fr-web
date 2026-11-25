// Dueño: Persona B (sección 6, B5). Corre como cada FR (trigger por usuario, ver triggersUsuario.ts),
// cada 1 hora. Busca eventos de los próximos 30 días y los asocia a una empresa del CRM de su club.

import { crearConfigService } from '../crm/config';
import { crearCrmService } from '../crm/repo';
import { now } from '../shared/clock';
import { elegirMejorCoincidencia } from './matching';

const DIAS_VENTANA = 30;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

export function sincronizarCalendar(): void {
  const mailUsuario = Session.getActiveUser().getEmail();
  const usuario = crearConfigService().getUsuario(mailUsuario);
  if (!usuario || !usuario.club) return; // no registrado, o codirectora sin club fijo: no sincroniza

  const crm = crearCrmService();
  const filas = crm.listarFilas(usuario.club);
  if (filas.length === 0) return;

  const desde = now();
  const hasta = new Date(desde.getTime() + DIAS_VENTANA * MS_POR_DIA);
  const eventos = CalendarApp.getDefaultCalendar().getEvents(desde, hasta);

  for (const evento of eventos) {
    const mailsInvitados = evento.getGuestList().map((g) => g.getEmail());
    const filaMatch = elegirMejorCoincidencia(filas, evento.getTitle(), mailsInvitados);
    if (!filaMatch) continue;
    // getStartTime() devuelve el Date "no estándar" de Apps Script: lo paso a Date real.
    const fechaEvento = new Date(evento.getStartTime().getTime());
    crm.registrarReunionCoordinada(usuario.club, filaMatch.empresa, fechaEvento, usuario);
  }
}
