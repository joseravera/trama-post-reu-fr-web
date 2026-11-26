// Dueño: Persona B. Lógica pura de matching para B5 (asociar un evento de Calendar a una empresa
// del CRM), separada de las llamadas a CalendarApp para poder testearla con Jest.

import { crearEsDeLaEmpresa } from '../shared/mails';
import { extraerMails } from './mailsContacto';
import type { FilaCRM } from '../shared/types';

export function dominioDeMail(mail: string): string {
  return mail.split('@')[1]?.toLowerCase().trim() ?? '';
}

/**
 * La empresa coincide con el evento solo si alguno de los invitados es de la empresa: su mail
 * está en la celda Mail o es del dominio propio de la empresa (no cuentan gmail.com, hotmail.com,
 * etc.). El título del evento no se mira.
 */
export function empresaCoincideConEvento(fila: FilaCRM, mailsInvitados: string[]): boolean {
  const esEmpresa = crearEsDeLaEmpresa(extraerMails(fila.mail));
  return mailsInvitados.some((m) => esEmpresa(m));
}

export function elegirMejorCoincidencia(filas: readonly FilaCRM[], mailsInvitados: string[]): FilaCRM | null {
  return filas.find((f) => empresaCoincideConEvento(f, mailsInvitados)) ?? null;
}
