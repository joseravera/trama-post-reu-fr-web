import { esEstadoFinal, estadoAlEscribirEncargado, estadoAlMandarResumen, estadoAlResponder, transicionValida } from './maquinaEstados';

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

describe('estados de traspaso', () => {
  it('desde el mail de traspaso: respondió traspaso, reunión o no sponsor, pero no mail respondido', () => {
    expect(transicionValida('FR viejo mando el mail de traspaso', 'Respondió traspaso')).toBe(true);
    expect(transicionValida('FR viejo mando el mail de traspaso', 'Reunión coordinada')).toBe(true);
    expect(transicionValida('FR viejo mando el mail de traspaso', 'No va a ser sponsor')).toBe(true);
    expect(transicionValida('FR viejo mando el mail de traspaso', 'Mail respondido')).toBe(false);
  });

  it('desde respondió traspaso: mail enviado, reunión coordinada o no sponsor', () => {
    expect(transicionValida('Respondió traspaso', 'Mail enviado')).toBe(true);
    expect(transicionValida('Respondió traspaso', 'Reunión coordinada')).toBe(true);
    expect(transicionValida('Respondió traspaso', 'No va a ser sponsor')).toBe(true);
    expect(transicionValida('Respondió traspaso', 'Tratativas')).toBe(false);
  });

  it('un estado desconocido escrito a mano no rompe: se trata como empresa sin estado', () => {
    expect(transicionValida('Respondió mail' as never, 'Reunión coordinada')).toBe(true);
    expect(transicionValida('Respondió mail' as never, 'Mail enviado')).toBe(false);
  });
});

describe('estadoAlResponder', () => {
  it('Mail enviado → Mail respondido; traspaso → Respondió traspaso; el resto queda igual', () => {
    expect(estadoAlResponder('Mail enviado')).toBe('Mail respondido');
    expect(estadoAlResponder('FR viejo mando el mail de traspaso')).toBe('Respondió traspaso');
    expect(estadoAlResponder('Tratativas')).toBe('Tratativas');
    expect(estadoAlResponder(undefined)).toBeUndefined();
  });
});

describe('estadoAlEscribirEncargado', () => {
  it('Respondió traspaso → Mail enviado; el resto queda igual', () => {
    expect(estadoAlEscribirEncargado('Respondió traspaso')).toBe('Mail enviado');
    expect(estadoAlEscribirEncargado('FR viejo mando el mail de traspaso')).toBe('FR viejo mando el mail de traspaso');
    expect(estadoAlEscribirEncargado('Mail respondido')).toBe('Mail respondido');
    expect(estadoAlEscribirEncargado(undefined)).toBeUndefined();
  });
});

describe('estadoAlMandarResumen', () => {
  it('Reunión coordinada → Tuvimos reunión, esperando respuesta; el resto queda igual', () => {
    expect(estadoAlMandarResumen('Reunión coordinada')).toBe('Tuvimos reunión, esperando respuesta');
    expect(transicionValida('Reunión coordinada', 'Tuvimos reunión, esperando respuesta')).toBe(true);
    expect(estadoAlMandarResumen('Tratativas')).toBe('Tratativas');
    expect(estadoAlMandarResumen('Mail enviado')).toBe('Mail enviado');
  });
});
