import { buscarFilaPorClave, filaVacia, indiceColumna, primeraFilaVacia } from './sheetUtils';

describe('indiceColumna', () => {
  it('encuentra la columna por nombre exacto', () => {
    expect(indiceColumna(['Empresa', 'Mail', 'Estado del contacto'], 'Mail')).toBe(1);
  });

  it('tira error claro si la columna no existe', () => {
    expect(() => indiceColumna(['Empresa'], 'Teléfono')).toThrow(/Teléfono/);
  });
});

describe('filaVacia', () => {
  it('es true solo si todas las celdas están vacías', () => {
    expect(filaVacia(['', null, undefined])).toBe(true);
    expect(filaVacia(['Empresa X', '', ''])).toBe(false);
  });
});

describe('primeraFilaVacia', () => {
  const encabezados = ['Empresa', 'Mail'];

  it('devuelve la primera fila vacía dentro de la tabla', () => {
    const valores = [encabezados, ['A', 'a@a.com'], ['', ''], ['B', 'b@b.com']];
    expect(primeraFilaVacia(valores)).toBe(3); // fila 3 (1-based): la del medio
  });

  it('si no hay huecos, devuelve la fila siguiente a la última', () => {
    const valores = [encabezados, ['A', 'a@a.com'], ['B', 'b@b.com']];
    expect(primeraFilaVacia(valores)).toBe(4);
  });
});

describe('buscarFilaPorClave', () => {
  const encabezados = ['Empresa', 'Mail'];
  const valores = [encabezados, ['Acme', 'x@acme.com'], ['Globex', 'y@globex.com']];

  it('devuelve el número de fila (1-based) de la coincidencia', () => {
    expect(buscarFilaPorClave(valores, 0, 'Globex')).toBe(3);
  });

  it('devuelve null si no encuentra', () => {
    expect(buscarFilaPorClave(valores, 0, 'Initech')).toBeNull();
  });

  it('usa el comparador para matchear normalizado', () => {
    expect(buscarFilaPorClave(valores, 0, 'acme', (a, b) => a.toLowerCase() === b)).toBe(2);
  });
});
