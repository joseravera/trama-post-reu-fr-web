// Dueño: Persona B (sección 6, B3). Tabla de transiciones como dato (sección 3.5), no ifs anidados.

import { ESTADOS_FINALES } from '../shared/constants';
import type { Estado } from '../shared/types';

export const TRANSICIONES: Record<Estado, Estado[]> = {
  'Mail enviado': ['Mail respondido', 'Reunión coordinada', 'No va a ser sponsor'],
  'Mail respondido': ['Reunión coordinada', 'No va a ser sponsor'],
  'FR viejo mando el mail de traspaso': ['Respondió traspaso', 'Reunión coordinada', 'No va a ser sponsor'],
  'Respondió traspaso': ['Mail enviado', 'Reunión coordinada', 'No va a ser sponsor'],
  'Reunión coordinada': ['Tuvimos reunión, esperando respuesta', 'Tratativas', 'No va a ser sponsor'],
  'Tuvimos reunión, esperando respuesta': [
    'Tratativas',
    'Va a ser sponsor',
    'No va a ser sponsor',
    'Reunión coordinada',
  ],
  Tratativas: ['Va a ser sponsor', 'No va a ser sponsor', 'Reunión coordinada'],
  'Va a ser sponsor': [],
  'No va a ser sponsor': [],
};

// Estados alcanzables para una empresa nueva (desde === undefined), es decir los "estados posibles
// al confirmar un post-reunión" de la sección 3.5. "Mail enviado"/"Mail respondido" no están porque
// una empresa llega a esos estados antes de tener una reunión (carga manual o migración, ver B3),
// nunca a través del flujo de post-reunión de la app.
export const ESTADOS_INICIALES: Estado[] = [
  'Tuvimos reunión, esperando respuesta',
  'Tratativas',
  'Va a ser sponsor',
  'No va a ser sponsor',
  'Reunión coordinada',
];

// Qué pasa con el estado cuando la empresa responde un mail (lo usa registrarRespuesta, tanto
// desde la UI como desde el sync de Gmail). Los estados que no están acá no cambian.
export const ESTADO_AL_RESPONDER: Partial<Record<Estado, Estado>> = {
  'Mail enviado': 'Mail respondido',
  'FR viejo mando el mail de traspaso': 'Respondió traspaso',
};

export function estadoAlResponder(estado: Estado | undefined): Estado | undefined {
  return (estado && ESTADO_AL_RESPONDER[estado]) || estado;
}

// Qué pasa con el estado cuando el tramero encargado le escribe a la empresa (lo detecta el sync
// de Gmail en su casilla o en la de un coordinador/codirectora en copia). Los estados que no
// están acá no cambian.
export const ESTADO_AL_ESCRIBIR_ENCARGADO: Partial<Record<Estado, Estado>> = {
  'Respondió traspaso': 'Mail enviado',
};

export function estadoAlEscribirEncargado(estado: Estado | undefined): Estado | undefined {
  return (estado && ESTADO_AL_ESCRIBIR_ENCARGADO[estado]) || estado;
}

// Qué pasa con el estado cuando alguien de Trama le manda a la empresa el mail post-reunión (el
// borrador que arma la app, reconocido por el asunto). Los estados que no están acá no cambian.
export const ESTADO_AL_MANDAR_RESUMEN: Partial<Record<Estado, Estado>> = {
  'Reunión coordinada': 'Tuvimos reunión, esperando respuesta',
};

export function estadoAlMandarResumen(estado: Estado | undefined): Estado | undefined {
  return (estado && ESTADO_AL_MANDAR_RESUMEN[estado]) || estado;
}

export function transicionValida(desde: Estado | undefined, hacia: Estado): boolean {
  // Un estado escrito a mano que la máquina no conoce (ej. "Respondió mail") se trata como una
  // empresa sin estado: solo admite los estados iniciales, en vez de romper.
  if (desde === undefined || !(desde in TRANSICIONES)) return ESTADOS_INICIALES.includes(hacia);
  // Quedarse en el mismo estado nunca es una transición inválida: pasa al confirmar dos veces la
  // misma reunión (idempotencia) y también en un caso real, una segunda reunión mientras la
  // empresa sigue en el mismo estado (ej. otra ronda de Tratativas).
  if (desde === hacia) return true;
  return TRANSICIONES[desde].includes(hacia);
}

export function esEstadoFinal(estado: Estado): boolean {
  return ESTADOS_FINALES.includes(estado);
}
