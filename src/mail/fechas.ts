// Dueño: Persona C (sección 7, C2). Lógica pura, zona horaria America/Buenos_Aires.

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const ZONA = 'America/Buenos_Aires';

function partesEnZona(fecha: Date): { anio: number; mes: number; dia: number; diaSemana: number } {
  const formateador = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const partes = formateador.formatToParts(fecha);
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
  const diasCortos = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    anio: Number(valor('year')),
    mes: Number(valor('month')),
    dia: Number(valor('day')),
    diaSemana: diasCortos.indexOf(valor('weekday')),
  };
}

function mismoDia(a: Date, b: Date): boolean {
  const pa = partesEnZona(a);
  const pb = partesEnZona(b);
  return pa.anio === pb.anio && pa.mes === pb.mes && pa.dia === pb.dia;
}

// Día de la semana (0=domingo..6=sábado) en America/Buenos_Aires. La usan las reglas de
// avisos para saber si hoy es lunes/miércoles/viernes sin depender del huso del servidor.
export function diaSemanaEnZona(fecha: Date): number {
  return partesEnZona(fecha).diaSemana;
}

function epochDiaEnZona(fecha: Date): number {
  const p = partesEnZona(fecha);
  return Math.floor(Date.UTC(p.anio, p.mes - 1, p.dia) / 86400000);
}

// Cantidad de días de calendario (en America/Buenos_Aires) entre dos fechas, "hasta" - "desde".
// Positivo si "hasta" es posterior. Lo usan las reglas de avisos para "N días sin respuesta".
export function diferenciaDiasEnZona(desde: Date, hasta: Date): number {
  return epochDiaEnZona(hasta) - epochDiaEnZona(desde);
}

// "de hoy" si fechaReunion es el mismo día (en America/Buenos_Aires) que fechaCarga;
// si no, "del <día de la semana> DD/MM".
export function formatearFechaReunion(fechaReunion: Date, fechaCarga: Date): string {
  if (mismoDia(fechaReunion, fechaCarga)) return 'de hoy';
  const p = partesEnZona(fechaReunion);
  const dd = String(p.dia).padStart(2, '0');
  const mm = String(p.mes).padStart(2, '0');
  return `del ${DIAS_SEMANA[p.diaSemana]} ${dd}/${mm}`;
}
