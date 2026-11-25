import { esEstadoFinal, transicionValida } from './maquinaEstados';

describe('transicionValida', () => {
  it('permite las transiciones de la tabla de la sección 3.5', () => {
    expect(transicionValida('Mail enviado', 'Mail respondido')).toBe(true);
    expect(transicionValida('Tratativas', 'Va a ser sponsor')).toBe(true);
  });

  it('rechaza transiciones que no están en la tabla', () => {
    expect(transicionValida('Mail enviado', 'Tratativas')).toBe(false);
    expect(transicionValida('Va a ser sponsor', 'Tratativas')).toBe(false);
  });

  it('con desde=undefined solo admite los estados iniciales de una empresa nueva', () => {
    expect(transicionValida(undefined, 'Tuvimos reunión, esperando respuesta')).toBe(true);
    expect(transicionValida(undefined, 'Mail enviado')).toBe(false);
  });

  it('quedarse en el mismo estado siempre es válido (idempotencia + reconfirmar el mismo estado)', () => {
    expect(transicionValida('Tratativas', 'Tratativas')).toBe(true);
    expect(transicionValida('Mail enviado', 'Mail enviado')).toBe(true);
    expect(transicionValida('Va a ser sponsor', 'Va a ser sponsor')).toBe(true); // estado final incluido
  });
});

describe('esEstadoFinal', () => {
  it('"Va a ser sponsor" y "No va a ser sponsor" son finales', () => {
    expect(esEstadoFinal('Va a ser sponsor')).toBe(true);
    expect(esEstadoFinal('No va a ser sponsor')).toBe(true);
  });

  it('el resto de los estados no son finales', () => {
    expect(esEstadoFinal('Mail enviado')).toBe(false);
  });
});
