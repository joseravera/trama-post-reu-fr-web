// Dueño: Persona A (sección 5, A6). Orquestador del flujo "Confirmar".

import { SPREADSHEET_ID } from '../shared/constants';
import type { CrmService, MailService, PostReunionConfirmado, Usuario } from '../shared/types';
import { registrarYTraducir } from './mensajes';

export interface ResultadoPostReunion {
  ok: boolean;
  filaUrl?: string;
  borradorUrl?: string;
  fallo?: 'CRM' | 'BORRADOR';
  mensaje?: string;
}

// TODO(A): FilaCRM no trae la fila ni la hoja, así que por ahora el link es al spreadsheet del proyecto.
// Para linkear a la fila exacta hace falta que B exponga esa información (ver pendientes).
export const URL_CRM = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`;

// 1. CrmService.aplicarPostReunion → CRM e historial. 2. MailService.crearBorrador → borrador.
// Si falla el CRM no se crea el borrador; si falla el borrador después de escribir el CRM, se informa
// y se puede reintentar solo el borrador.
export function confirmarPostReunion(
  p: PostReunionConfirmado,
  fr: Usuario,
  crm: CrmService,
  mail: MailService,
): ResultadoPostReunion {
  try {
    crm.aplicarPostReunion(p, fr);
  } catch (e) {
    return { ok: false, fallo: 'CRM', mensaje: `No se actualizó el CRM ni se creó el borrador. ${registrarYTraducir(e, 'CRM')}` };
  }
  return reintentarBorrador(p, fr, mail);
}

export function reintentarBorrador(p: PostReunionConfirmado, fr: Usuario, mail: MailService): ResultadoPostReunion {
  try {
    const borrador = mail.crearBorrador(p, fr);
    return { ok: true, filaUrl: URL_CRM, borradorUrl: borrador.url };
  } catch (e) {
    return {
      ok: false,
      fallo: 'BORRADOR',
      filaUrl: URL_CRM,
      mensaje: `El CRM se actualizó, pero no se pudo crear el borrador del mail. ${registrarYTraducir(e, 'borrador')}`,
    };
  }
}
