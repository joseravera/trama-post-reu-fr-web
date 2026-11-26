// Dueño: Persona B. Lógica pura de matching para B5/B6 (asociar un evento de Calendar o un
// remitente de Gmail a una empresa del CRM), separada de las llamadas a CalendarApp/GmailApp
// para poder testearla con Jest.

import { normalizarNombreEmpresa } from '../crm/repo';
import { extraerMails } from './mailsContacto';
import type { FilaCRM } from '../shared/types';

export function dominioDeMail(mail: string): string {
  return mail.split('@')[1]?.toLowerCase().trim() ?? '';
}

/**
 * Empresa coincide si el dominio del mail cargado en el CRM está entre los dominios de los
 * invitados del evento, o si el nombre de la empresa está contenido en el título del evento
 * (sección 6, B5).
 */
export function empresaCoincideConEvento(
  fila: FilaCRM,
  tituloEvento: string,
  mailsInvitados: string[],
): boolean {
  const dominiosFila = extraerMails(fila.mail).map(dominioDeMail).filter(Boolean);
  if (dominiosFila.length && mailsInvitados.some((m) => dominiosFila.includes(dominioDeMail(m)))) return true;
  const empresaNorm = normalizarNombreEmpresa(fila.empresa);
  if (!empresaNorm) return false;
  return normalizarNombreEmpresa(tituloEvento).includes(empresaNorm);
}

export function elegirMejorCoincidencia(
  filas: readonly FilaCRM[],
  tituloEvento: string,
  mailsInvitados: string[],
): FilaCRM | null {
  return filas.find((f) => empresaCoincideConEvento(f, tituloEvento, mailsInvitados)) ?? null;
}
