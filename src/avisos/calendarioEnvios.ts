// Dueño: Persona C (sección 7, C4/C8). Días fijos de envío: lunes, miércoles y viernes
// (escalamientos a coordinadores). Los avisos a los FR salen una vez por semana, el día de
// DIA_ENVIO_FR en _Parametros (ver plan-implementacion-web.md, 4.8).
// ConfigService.getParametro solo devuelve number, así que DIAS_ENVIO_AGENDA (una lista de
// días) queda hardcodeado acá en vez de leerse de _Parametros (ver sección 7, C4).

import { diaSemanaEnZona } from '../mail/fechas';

export const DIAS_ENVIO = [1, 3, 5]; // lunes, miércoles, viernes (0=domingo..6=sábado)

export function esDiaDeEnvio(fecha: Date): boolean {
  return DIAS_ENVIO.includes(diaSemanaEnZona(fecha));
}

export function esLunes(fecha: Date): boolean {
  return diaSemanaEnZona(fecha) === 1;
}

// Primer día de envío estrictamente posterior a "desde" (para la ventana "hasta el próximo
// envío" de la agenda del FR, ver C4).
export function proximoEnvio(desde: Date): Date {
  const fecha = new Date(desde);
  do {
    fecha.setDate(fecha.getDate() + 1);
  } while (!esDiaDeEnvio(fecha));
  return fecha;
}

const DIAS_POR_NOMBRE: Record<string, number> = { DOM: 0, LUN: 1, MAR: 2, MIE: 3, JUE: 4, VIE: 5, SAB: 6 };

// "LUN", "lunes", "Miércoles"... → 0..6 (0 = domingo). null si no se entiende.
export function diaDeSemanaDesdeTexto(texto: string | null | undefined): number | null {
  if (!texto) return null;
  const clave = texto.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase().slice(0, 3);
  return clave in DIAS_POR_NOMBRE ? DIAS_POR_NOMBRE[clave] : null;
}

export function esDiaSemana(fecha: Date, dia: number): boolean {
  return diaSemanaEnZona(fecha) === dia;
}

// Próxima fecha (estrictamente posterior a "desde") que cae en ese día de la semana.
export function proximoDiaSemana(desde: Date, dia: number): Date {
  const fecha = new Date(desde);
  do {
    fecha.setDate(fecha.getDate() + 1);
  } while (diaSemanaEnZona(fecha) !== dia);
  return fecha;
}
