// Dueño: Persona C (sección 7, C4/C8). Días fijos de envío: lunes, miércoles y viernes.
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
