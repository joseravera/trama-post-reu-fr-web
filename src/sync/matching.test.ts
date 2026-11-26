import { dominioDeMail, elegirMejorCoincidencia, empresaCoincideConEvento } from './matching';
import type { FilaCRM } from '../shared/types';

function filaBase(overrides: Partial<FilaCRM> = {}): FilaCRM {
  return { club: 'Agro', empresa: 'AgroTech SA', trameroEncargado: 'Juana', pingueosSinRespuesta: 0, ...overrides };
}

describe('dominioDeMail', () => {
  it('devuelve el dominio en minúsculas', () => {
    expect(dominioDeMail('Martina@AgroTech.com')).toBe('agrotech.com');
  });
});

describe('empresaCoincideConEvento', () => {
  it('matchea si algún invitado es de la empresa (mail exacto o dominio propio)', () => {
    const fila = filaBase({ mail: 'martina@agrotech.com' });
    expect(empresaCoincideConEvento(fila, ['otro@externo.com', 'martina@agrotech.com'])).toBe(true);
    expect(empresaCoincideConEvento(fila, ['persona.nueva@agrotech.com'])).toBe(true);
  });

  it('no mira el título: sin invitados de la empresa no matchea', () => {
    expect(empresaCoincideConEvento(filaBase({ mail: undefined }), [])).toBe(false);
    expect(empresaCoincideConEvento(filaBase({ mail: 'martina@agrotech.com' }), ['otro@externo.com'])).toBe(false);
  });

  it('un contacto con Gmail solo matchea con su mail exacto', () => {
    const fila = filaBase({ mail: 'contacto@gmail.com' });
    expect(empresaCoincideConEvento(fila, ['otra.persona@gmail.com'])).toBe(false);
    expect(empresaCoincideConEvento(fila, ['contacto@gmail.com'])).toBe(true);
  });
});

describe('elegirMejorCoincidencia', () => {
  it('devuelve la primera fila con un invitado de la empresa', () => {
    const filas = [filaBase({ empresa: 'Globex', mail: 'a@globex.com' }), filaBase({ empresa: 'AgroTech SA', mail: 'm@agrotech.com' })];
    expect(elegirMejorCoincidencia(filas, ['x@agrotech.com'])?.empresa).toBe('AgroTech SA');
  });

  it('devuelve null si ninguna matchea', () => {
    expect(elegirMejorCoincidencia([filaBase({ mail: 'm@agrotech.com' })], ['x@otra.com'])).toBeNull();
  });
});
