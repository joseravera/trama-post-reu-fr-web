import {
  agregarComentario,
  filaCRMDesdeValores,
  formatearFechaCorta,
  formatearLineaComentario,
  normalizarNombreEmpresa,
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
