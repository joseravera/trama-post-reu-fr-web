// Dueño: Persona A (sección 5, A3). responseSchema de Gemini.
//
// Es casi igual a Extraccion (shared/types.ts), salvo la próxima acción: en vez de pedirle a Gemini
// una "próxima acción" genérica (confundía las tareas de Trama con el seguimiento), le pedimos el
// próximo contacto con la EMPRESA y el fragmento literal de las notas de donde sacó la fecha. El
// código (validacion.ts, aExtraccion) verifica ese fragmento y arma la Extraccion de siempre.

import { ESTADOS } from '../shared/constants';
import type { Extraccion } from '../shared/types';

export interface RespuestaGemini extends Omit<Extraccion, 'proximaAccion' | 'fechaProximaAccion'> {
  proximoContactoConLaEmpresa: string | null;
  fechaProximoContacto: string | null; // yyyy-mm-dd
  textoDeLaFecha: string | null; // fragmento exacto de las notas de donde sale la fecha
}

export const CAMPOS_RESPUESTA_GEMINI = [
  'persona',
  'rolPersona',
  'mail',
  'telefono',
  'linkedin',
  'compromisosEmpresa',
  'compromisosTrama',
  'parrafoCompromisos',
  'estadoSugerido',
  'comentarios',
  'proximoContactoConLaEmpresa',
  'fechaProximoContacto',
  'textoDeLaFecha',
  'camposFaltantes',
] as const;

const textoONull = { type: 'STRING', nullable: true };
const listaDeTextos = { type: 'ARRAY', items: { type: 'STRING' } };

export const EXTRACCION_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    persona: textoONull,
    rolPersona: textoONull,
    mail: textoONull,
    telefono: textoONull,
    linkedin: textoONull,
    compromisosEmpresa: { ...listaDeTextos, description: 'Lo que prometió hacer la empresa.' },
    compromisosTrama: {
      ...listaDeTextos,
      description: 'Lo que prometió hacer Trama ("nosotros"): mandar el PDB, el documento del evento, métricas, fotos, etc.',
    },
    parrafoCompromisos: textoONull,
    estadoSugerido: { type: 'STRING', enum: ESTADOS },
    comentarios: { type: 'STRING' },
    proximoContactoConLaEmpresa: {
      ...textoONull,
      description:
        'Lo próximo que esperamos de la EMPRESA (su respuesta, una firma, que nos manden algo) o la próxima reunión con ellos, ' +
        'con el formato "Seguimiento con <persona>: <qué esperamos>". Nunca una tarea de Trama (eso va en compromisosTrama).',
    },
    fechaProximoContacto: {
      ...textoONull,
      description: 'Fecha (yyyy-mm-dd) que dicen las notas para ese contacto. null si las notas no la dicen; nunca supongas una.',
    },
    textoDeLaFecha: {
      ...textoONull,
      description: 'Fragmento EXACTO de las notas, copiado letra por letra, de donde sale fechaProximoContacto. null si no hay fecha.',
    },
    camposFaltantes: listaDeTextos,
  },
  // Todos son obligatorios (los nullable pueden venir en null).
  required: [...CAMPOS_RESPUESTA_GEMINI],
};
