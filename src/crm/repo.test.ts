import {
  agregarComentario,
  celdasDesdeFilaCRM,
  filaCRMDesdeValores,
  formatearFechaCorta,
  formatearLineaComentario,
  normalizarNombreEmpresa,
  parsearFechaCelda,
  tramosDeEscritura,
  valoresDesdeFilaCRM,
} from './repo';
import { COLUMNAS_CRM } from '../shared/constants';
import type { FilaCRM } from '../shared/types';

const ENCABEZADOS = Object.values(COLUMNAS_CRM);

describe('normalizarNombreEmpresa', () => {
  it('sacar tildes, pasa a minúsculas y colapsa espacios', () => {
    expect(normalizarNombreEmpresa('  Agrotécnica   S.A.  ')).toBe('agrotecnica s.a.');
  });
});

describe('formatearFechaCorta / formatearLineaComentario', () => {
  it('formatea DD/MM en America/Buenos_Aires', () => {
    expect(formatearFechaCorta(new Date('2026-11-18T10:00:00-03:00'))).toBe('18/11');
  });

  it('antepone la fecha corta entre corchetes', () => {
    const linea = formatearLineaComentario(new Date('2026-11-18T10:00:00-03:00'), 'Reunión con Martina.');
    expect(linea).toBe('[18/11] Reunión con Martina.');
  });
});

describe('agregarComentario', () => {
  it('agrega la línea nueva debajo de las existentes', () => {
    expect(agregarComentario('[02/12] Primera.', '[18/12] Segunda.')).toBe('[02/12] Primera.\n[18/12] Segunda.');
  });

  it('no duplica la línea si ya está (idempotencia al confirmar dos veces)', () => {
    expect(agregarComentario('[02/12] Primera.', '[02/12] Primera.')).toBe('[02/12] Primera.');
  });

  it('funciona si no había comentarios previos', () => {
    expect(agregarComentario(undefined, '[02/12] Primera.')).toBe('[02/12] Primera.');
  });
});

describe('filaCRMDesdeValores <-> valoresDesdeFilaCRM', () => {
  it('hace un roundtrip sin perder datos', () => {
    const fila: FilaCRM = {
      club: 'Agro',
      empresa: 'AgroTech SA',
      trameroEncargado: 'Juana Pérez',
      persona: 'Martina',
      rolPersona: 'Marketing',
      telefono: undefined,
      mail: 'martina@agrotech.com',
      linkedin: undefined,
      estado: 'Tratativas',
      comentarios: '[18/11] Reunión con Martina.',
      fechaPrimerContacto: new Date('2026-11-18T10:00:00-03:00'),
      fechaUltimoContacto: new Date('2026-11-18T10:00:00-03:00'),
      canal: undefined,
      proximaAccion: 'Esperar propuesta',
      fechaProximaAccion: new Date('2026-12-05T00:00:00-03:00'),
      pingueosSinRespuesta: 0,
    };

    const valores = valoresDesdeFilaCRM(ENCABEZADOS, fila);
    const filaReconstruida = filaCRMDesdeValores('Agro', ENCABEZADOS, valores);

    expect(filaReconstruida).toEqual(fila);
  });

  it('deja los campos opcionales en undefined cuando la celda está vacía', () => {
    const valores = ENCABEZADOS.map((encabezado) =>
      encabezado === COLUMNAS_CRM.EMPRESA ? 'Acme' : encabezado === COLUMNAS_CRM.PINGUEOS_SIN_RESPUESTA ? 0 : '',
    );
    const fila = filaCRMDesdeValores('Agro', ENCABEZADOS, valores);
    expect(fila.mail).toBeUndefined();
    expect(fila.fechaProximaAccion).toBeUndefined();
    expect(fila.pingueosSinRespuesta).toBe(0);
  });
});

describe('escritura: solo las columnas del sistema', () => {
  // Como la hoja de Emprendedores: una columna propia en el medio y sin "Pingueos sin respuesta".
  const ENCABEZADOS_EMPRENDEDORES = [
    'Empresa', 'Tramero encargado', 'Es traspaso?', 'Persona (de empresa)', 'Rol de la persona', 'Teléfono', 'Mail',
    'LinkedIn contacto', 'Estado del contacto', 'Comentarios ', 'Fecha primer contacto', 'Fecha último contacto',
    'Canal', 'Próxima acción', 'Fecha próxima acción',
  ];
  const fila: FilaCRM = {
    club: 'Emprendedores', empresa: 'Despegar', trameroEncargado: 'Martin Mejliker',
    estado: 'Respondió traspaso', pingueosSinRespuesta: 0,
  };

  it('nunca escribe la columna "Es traspaso?" y conserva su valor', () => {
    const celdas = celdasDesdeFilaCRM(ENCABEZADOS_EMPRENDEDORES, fila);
    expect(celdas.map(([i]) => i)).not.toContain(2);
    const actuales = ['Despegar', 'Martin Mejliker', true];
    expect(valoresDesdeFilaCRM(ENCABEZADOS_EMPRENDEDORES, fila, actuales)[2]).toBe(true);
  });

  it('agrupa en tramos contiguos que saltean las columnas ajenas', () => {
    const tramos = tramosDeEscritura(celdasDesdeFilaCRM(ENCABEZADOS_EMPRENDEDORES, fila));
    expect(tramos.map((t) => [t.columna, t.valores.length])).toEqual([[1, 2], [4, 12]]);
  });

  it('lee la hoja sin "Pingueos sin respuesta" como 0 y no la escribe', () => {
    const valores = ['Despegar', 'Martin Mejliker', true, '', '', '', '', '', 'FR viejo mando el mail de traspaso', '', '24/11/2026'];
    const leida = filaCRMDesdeValores('Emprendedores', ENCABEZADOS_EMPRENDEDORES, valores);
    expect(leida.pingueosSinRespuesta).toBe(0);
    expect(leida.estado).toBe('FR viejo mando el mail de traspaso');
    expect(leida.fechaPrimerContacto?.toISOString().slice(0, 10)).toBe('2026-11-24');
    expect(celdasDesdeFilaCRM(ENCABEZADOS_EMPRENDEDORES, leida)).toHaveLength(14);
  });
});

describe('parsearFechaCelda', () => {
  it('entiende dd/mm/yyyy, Date y vacío', () => {
    expect(parsearFechaCelda('5/3/2026')?.toISOString()).toBe('2026-03-05T15:00:00.000Z');
    const d = new Date('2026-01-01T00:00:00Z');
    expect(parsearFechaCelda(d)).toBe(d);
    expect(parsearFechaCelda('')).toBeUndefined();
    expect(parsearFechaCelda('cualquier cosa')).toBeUndefined();
  });
});
