// Dueño: Persona C (sección 7, C5). Reglas de ESCALAMIENTO a coordinadores (lógica pura).
// Igual que reglas.ts: destinatarios acá es el nombre del FR (para "en copia"); el club va en
// el campo `club` del Aviso. resolverDestinatarios (en reglas.ts) agrega los coordinadores.
//
// El "una sola vez por empresa y fecha de próxima acción" de la sección 7, C5, no lo maneja
// esta función (que siempre re-evalúa la condición actual): lo garantiza logAvisos.ts, porque
// la clave incluye la fecha y, si el FR reprograma, la clave cambia y el conteo arranca de cero.

import { diferenciaDiasEnZona } from '../mail/fechas';
import type { Aviso, FilaCRM } from '../shared/types';
import type { ParametrosReglas } from './reglas';

// Fijo según la tabla de la sección 7, C5 ("Pingueos sin respuesta >= PINGUEOS_ESCALA y 7 días
// sin respuesta"): ese "7" no es DIAS_PINGUEO_MAIL, es un número aparte en el enunciado.
const DIAS_SIN_RESPUESTA_ESCALA = 7;

function clave(fila: FilaCRM, fecha: Date): string {
  return `ESCALAMIENTO|${fila.club}|${fila.empresa}|${fecha.toISOString().slice(0, 10)}`;
}

function avisoDeEscalamiento(fila: FilaCRM, fecha: Date, texto: string): Aviso {
  return {
    clave: clave(fila, fecha),
    tipo: 'ESCALAMIENTO',
    destinatarios: [fila.trameroEncargado],
    club: fila.club,
    empresa: fila.empresa,
    texto,
  };
}

function evaluarPingueosSinRespuesta(fila: FilaCRM, ahora: Date, parametros: ParametrosReglas): Aviso | null {
  if (fila.pingueosSinRespuesta < parametros.pingueosEscala) return null;
  if (!fila.fechaUltimoContacto) return null;
  const dias = diferenciaDiasEnZona(fila.fechaUltimoContacto, ahora);
  if (dias < DIAS_SIN_RESPUESTA_ESCALA) return null;
  return avisoDeEscalamiento(
    fila,
    fila.fechaUltimoContacto,
    `${fila.empresa} (${fila.trameroEncargado}) tiene ${fila.pingueosSinRespuesta} pingueos sin respuesta hace ${dias} días: ¿la damos por perdida?`,
  );
}

function evaluarTratativasEstancadas(fila: FilaCRM, ahora: Date, parametros: ParametrosReglas): Aviso | null {
  if (fila.estado !== 'Tratativas') return null;
  if (!fila.fechaUltimoContacto) return null;
  const dias = diferenciaDiasEnZona(fila.fechaUltimoContacto, ahora);
  if (dias < parametros.diasTratativasEscala) return null;
  return avisoDeEscalamiento(
    fila,
    fila.fechaUltimoContacto,
    `${fila.empresa} (${fila.trameroEncargado}) está en Tratativas sin movimiento hace ${dias} días.`,
  );
}

const ESTADOS_FINALES_PARA_ESCALAMIENTO: Array<FilaCRM['estado']> = ['Va a ser sponsor', 'No va a ser sponsor'];

function evaluarSeguimientoVencidoHaceDias(fila: FilaCRM, ahora: Date, parametros: ParametrosReglas): Aviso | null {
  if (!fila.estado || ESTADOS_FINALES_PARA_ESCALAMIENTO.includes(fila.estado)) return null;
  if (!fila.fechaProximaAccion) return null;
  const diasVencida = diferenciaDiasEnZona(fila.fechaProximaAccion, ahora);
  if (diasVencida < parametros.diasVencidoEscala) return null;
  return avisoDeEscalamiento(
    fila,
    fila.fechaProximaAccion,
    `${fila.empresa} (${fila.trameroEncargado}) tiene un seguimiento vencido hace ${diasVencida} días sin contacto nuevo.`,
  );
}

export function evaluarEscalamientos(filas: FilaCRM[], ahora: Date, parametros: ParametrosReglas): Aviso[] {
  const avisos: Aviso[] = [];
  for (const fila of filas) {
    for (const aviso of [
      evaluarPingueosSinRespuesta(fila, ahora, parametros),
      evaluarTratativasEstancadas(fila, ahora, parametros),
      evaluarSeguimientoVencidoHaceDias(fila, ahora, parametros),
    ]) {
      if (aviso) avisos.push(aviso);
    }
  }
  return avisos;
}
