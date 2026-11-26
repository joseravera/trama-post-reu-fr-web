// Hilo de Gmail de los borradores que crea la app (post-reunión y pingueo), guardado en las
// propiedades de la cuenta de quien lo creó (UserProperties). El sync de Gmail de esa misma
// persona revisa el hilo y, cuando tiene un mensaje enviado (ya no es borrador), registra el envío:
// - POST_REUNION: la empresa pasa de "Reunión coordinada" a "Tuvimos reunión, esperando respuesta".
// - PINGUEO: suma uno a "Pingueos sin respuesta".
// Así lo que cuenta es el mail enviado, no el borrador, y no depende del asunto.

import type { Club } from '../shared/types';

export type TipoBorradorPendiente = 'POST_REUNION' | 'PINGUEO';

function claveDe(tipo: TipoBorradorPendiente, club: Club, empresa: string): string {
  return `PENDIENTE|${tipo}|${club}|${empresa.trim().toLowerCase()}`;
}

export function guardarBorradorPendiente(tipo: TipoBorradorPendiente, club: Club, empresa: string, hiloId: string): void {
  PropertiesService.getUserProperties().setProperty(claveDe(tipo, club, empresa), hiloId);
}

export function leerBorradorPendiente(tipo: TipoBorradorPendiente, club: Club, empresa: string): string | null {
  return PropertiesService.getUserProperties().getProperty(claveDe(tipo, club, empresa));
}

export function borrarBorradorPendiente(tipo: TipoBorradorPendiente, club: Club, empresa: string): void {
  PropertiesService.getUserProperties().deleteProperty(claveDe(tipo, club, empresa));
}
