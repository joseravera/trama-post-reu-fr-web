import { diaDeSemanaDesdeTexto, esDiaDeEnvio, esDiaSemana, esLunes, proximoDiaSemana, proximoEnvio } from './calendarioEnvios';

describe('esDiaDeEnvio', () => {
  it('lunes, miércoles y viernes son días de envío', () => {
    expect(esDiaDeEnvio(new Date('2026-11-23T09:00:00-03:00'))).toBe(true); // lunes
    expect(esDiaDeEnvio(new Date('2026-11-25T09:00:00-03:00'))).toBe(true); // miércoles
    expect(esDiaDeEnvio(new Date('2026-11-20T09:00:00-03:00'))).toBe(true); // viernes
  });

  it('martes, jueves, sábado y domingo no son días de envío', () => {
    expect(esDiaDeEnvio(new Date('2026-11-24T09:00:00-03:00'))).toBe(false); // martes
    expect(esDiaDeEnvio(new Date('2026-11-21T09:00:00-03:00'))).toBe(false); // sábado
  });
});

describe('esLunes', () => {
  it('reconoce el lunes para el resumen semanal', () => {
    expect(esLunes(new Date('2026-11-23T09:00:00-03:00'))).toBe(true);
    expect(esLunes(new Date('2026-11-25T09:00:00-03:00'))).toBe(false);
  });
});

describe('proximoEnvio', () => {
  it('de lunes salta a miércoles', () => {
    const resultado = proximoEnvio(new Date('2026-11-23T09:00:00-03:00'));
    expect(resultado.getUTCDate()).toBe(25);
  });

  it('de viernes salta al lunes siguiente', () => {
    const resultado = proximoEnvio(new Date('2026-11-20T09:00:00-03:00'));
    expect(resultado.getUTCDate()).toBe(23);
  });

  it('de un día que no es de envío (sábado) salta al próximo lunes', () => {
    const resultado = proximoEnvio(new Date('2026-11-21T09:00:00-03:00'));
    expect(resultado.getUTCDate()).toBe(23);
  });
});

describe('día de envío a los FR (DIA_ENVIO_FR)', () => {
  it('entiende abreviaturas y nombres con o sin tilde', () => {
    expect(diaDeSemanaDesdeTexto('LUN')).toBe(1);
    expect(diaDeSemanaDesdeTexto('miércoles')).toBe(3);
    expect(diaDeSemanaDesdeTexto('Sábado')).toBe(6);
    expect(diaDeSemanaDesdeTexto('xx')).toBeNull();
    expect(diaDeSemanaDesdeTexto(null)).toBeNull();
  });

  it('esDiaSemana y proximoDiaSemana: de lunes a lunes hay una semana', () => {
    const lunes = new Date('2026-11-23T09:00:00-03:00');
    expect(esDiaSemana(lunes, 1)).toBe(true);
    expect(esDiaSemana(new Date('2026-11-25T09:00:00-03:00'), 1)).toBe(false);
    expect(proximoDiaSemana(lunes, 1).getUTCDate()).toBe(30);
  });
});
