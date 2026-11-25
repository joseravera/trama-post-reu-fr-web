import { esDiaDeEnvio, esLunes, proximoEnvio } from './calendarioEnvios';

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
