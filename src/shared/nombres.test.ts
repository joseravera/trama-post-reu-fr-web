import { mismoNombre, normalizarNombrePersona } from './nombres';

describe('normalizarNombrePersona', () => {
  it('saca tildes, pasa a minúscula y colapsa espacios y tabs', () => {
    expect(normalizarNombrePersona(' Joaquín  de\tAlba ')).toBe('joaquin de alba');
  });
});

describe('mismoNombre', () => {
  it('matchea aunque difieran tildes, mayúsculas y espacios', () => {
    expect(mismoNombre('Joaquín de Alba ', 'joaquin de alba')).toBe(true);
    expect(mismoNombre('Maria del Pilar Navarro\t', 'Maria del Pilar Navarro')).toBe(true);
  });

  it('no matchea nombres distintos ni vacíos', () => {
    expect(mismoNombre('Martin Mejliker', 'Martin Isaac Bargach Mitre')).toBe(false);
    expect(mismoNombre('', '')).toBe(false);
    expect(mismoNombre(undefined, 'Juan Grispo')).toBe(false);
  });
});
