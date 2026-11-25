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
  it('matchea por dominio de algún invitado', () => {
    const fila = filaBase({ mail: 'martina@agrotech.com' });
    expect(empresaCoincideConEvento(fila, 'Reunión de seguimiento', ['otro@externo.com', 'martina@agrotech.com'])).toBe(
      true,
    );
  });

  it('matchea por nombre de empresa en el título si no hay dominio', () => {
    const fila = filaBase({ mail: undefined });
    expect(empresaCoincideConEvento(fila, 'Reunión con AgroTech SA', [])).toBe(true);
  });

  it('no matchea si ni el dominio ni el título coinciden', () => {
    const fila = filaBase({ mail: 'martina@agrotech.com' });
    expect(empresaCoincideConEvento(fila, 'Reunión interna de equipo', ['otro@externo.com'])).toBe(false);
  });
});

describe('elegirMejorCoincidencia', () => {
  it('devuelve la primera fila que matchea', () => {
    const filas = [filaBase({ empresa: 'Globex' }), filaBase({ empresa: 'AgroTech SA' })];
    const resultado = elegirMejorCoincidencia(filas, 'Reunión con AgroTech SA', []);
    expect(resultado?.empresa).toBe('AgroTech SA');
  });

  it('devuelve null si ninguna matchea', () => {
    expect(elegirMejorCoincidencia([filaBase()], 'Reunión sin relación', [])).toBeNull();
  });
});
