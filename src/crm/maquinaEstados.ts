// Dueño: Persona B (sección 6, B3). Tabla de transiciones como dato (sección 3.5), no ifs anidados.

import { ESTADOS_FINALES } from '../shared/constants';
import type { Estado } from '../shared/types';

export const TRANSICIONES: Record<Estado, Estado[]> = {
  'Mail enviado': ['Mail respondido', 'Reunión coordinada', 'No va a ser sponsor'],
  'Mail respondido': ['Reunión coordinada', 'No va a ser sponsor'],
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

export function transicionValida(desde: Estado | undefined, hacia: Estado): boolean {
  if (desde === undefined) return ESTADOS_INICIALES.includes(hacia);
  // Quedarse en el mismo estado nunca es una transición inválida: pasa al confirmar dos veces la
  // misma reunión (idempotencia) y también en un caso real, una segunda reunión mientras la
  // empresa sigue en el mismo estado (ej. otra ronda de Tratativas).
  if (desde === hacia) return true;
  return TRANSICIONES[desde].includes(hacia);
}

export function esEstadoFinal(estado: Estado): boolean {
  return ESTADOS_FINALES.includes(estado);
}
