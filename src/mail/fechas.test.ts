import { diaSemanaEnZona, diferenciaDiasEnZona, formatearFechaReunion } from './fechas';

describe('formatearFechaReunion', () => {
  it('devuelve "de hoy" cuando la reunión es el mismo día que la carga', () => {
    const carga = new Date('2026-11-18T14:00:00-03:00');
    const reunion = new Date('2026-11-18T10:00:00-03:00');
    expect(formatearFechaReunion(reunion, carga)).toBe('de hoy');
  });

  it('devuelve "del <día> DD/MM" cuando la reunión fue otro día', () => {
    const carga = new Date('2026-11-20T09:00:00-03:00');
    const reunion = new Date('2026-11-18T10:00:00-03:00'); // miércoles 18/11
    expect(formatearFechaReunion(reunion, carga)).toBe('del miércoles 18/11');
  });

  it('no confunde días cerca de medianoche por la zona horaria', () => {
    // 2026-11-19 02:00 UTC === 2026-11-18 23:00 en America/Buenos_Aires (UTC-3)
    const carga = new Date('2026-11-18T23:30:00-03:00');
    const reunion = new Date('2026-11-19T02:00:00Z');
    expect(formatearFechaReunion(reunion, carga)).toBe('de hoy');
  });
});

describe('diaSemanaEnZona', () => {
  it('devuelve el día de la semana en America/Buenos_Aires, no en el huso del servidor', () => {
    // miércoles 18/11 23:30 en BA === jueves 19/11 02:30 UTC
    expect(diaSemanaEnZona(new Date('2026-11-19T02:30:00Z'))).toBe(3); // miércoles
  });

  it('lunes es 1 y viernes es 5 (ScriptApp.getDay())', () => {
    expect(diaSemanaEnZona(new Date('2026-11-23T12:00:00-03:00'))).toBe(1); // lunes
    expect(diaSemanaEnZona(new Date('2026-11-20T12:00:00-03:00'))).toBe(5); // viernes
  });
});

describe('diferenciaDiasEnZona', () => {
  it('cuenta días de calendario completos entre dos fechas', () => {
    const desde = new Date('2026-11-18T10:00:00-03:00');
    const hasta = new Date('2026-11-25T08:00:00-03:00');
    expect(diferenciaDiasEnZona(desde, hasta)).toBe(7);
  });

  it('da 0 para el mismo día aunque cambien las horas', () => {
    const desde = new Date('2026-11-18T08:00:00-03:00');
    const hasta = new Date('2026-11-18T23:00:00-03:00');
    expect(diferenciaDiasEnZona(desde, hasta)).toBe(0);
  });

  it('da negativo si "hasta" es anterior a "desde"', () => {
    const desde = new Date('2026-11-18T08:00:00-03:00');
    const hasta = new Date('2026-11-15T08:00:00-03:00');
    expect(diferenciaDiasEnZona(desde, hasta)).toBe(-3);
  });
});
