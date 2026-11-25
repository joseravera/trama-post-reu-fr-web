import { evaluarEscalamientos } from './escalamiento';
import type { ParametrosReglas } from './reglas';
import type { FilaCRM } from '../shared/types';

const PARAMETROS: ParametrosReglas = {
  diasPingueoMail: 7,
  diasCoordinar: 3,
  horasCargaPost: 24,
  diasSeguimiento: 7,
  diasTratativasEscala: 14,
  pingueosEscala: 2,
  diasVencidoEscala: 3,
};

const AHORA = new Date('2026-11-25T09:00:00-03:00');

function filaBase(overrides: Partial<FilaCRM>): FilaCRM {
  return { club: 'Agro', empresa: 'Acme S.A.', trameroEncargado: 'Juan', pingueosSinRespuesta: 0, ...overrides };
}

describe('evaluarEscalamientos', () => {
  it('escala por pingueos sin respuesta (>= PINGUEOS_ESCALA y 7 días sin contacto)', () => {
    const fila = filaBase({
      estado: 'Mail enviado',
      pingueosSinRespuesta: 2,
      fechaUltimoContacto: new Date('2026-11-18T09:00:00-03:00'),
    });
    expect(evaluarEscalamientos([fila], AHORA, PARAMETROS)).toHaveLength(1);
  });

  it('no escala si tiene pocos pingueos', () => {
    const fila = filaBase({
      estado: 'Mail enviado',
      pingueosSinRespuesta: 1,
      fechaUltimoContacto: new Date('2026-11-01T09:00:00-03:00'),
    });
    expect(evaluarEscalamientos([fila], AHORA, PARAMETROS)).toHaveLength(0);
  });

  it('escala Tratativas estancadas hace DIAS_TRATATIVAS_ESCALA días', () => {
    const fila = filaBase({ estado: 'Tratativas', fechaUltimoContacto: new Date('2026-11-01T09:00:00-03:00') });
    const avisos = evaluarEscalamientos([fila], AHORA, PARAMETROS);
    expect(avisos.some((a) => a.texto.includes('Tratativas'))).toBe(true);
  });

  it('escala un seguimiento vencido hace DIAS_VENCIDO_ESCALA días sin estado final', () => {
    const fila = filaBase({
      estado: 'Tuvimos reunión, esperando respuesta',
      fechaProximaAccion: new Date('2026-11-20T09:00:00-03:00'), // hace 5 días
    });
    const avisos = evaluarEscalamientos([fila], AHORA, PARAMETROS);
    expect(avisos.some((a) => a.texto.includes('seguimiento vencido'))).toBe(true);
  });

  it('no escala si el estado ya es final', () => {
    const fila = filaBase({
      estado: 'No va a ser sponsor',
      fechaProximaAccion: new Date('2026-01-01T09:00:00-03:00'),
      pingueosSinRespuesta: 10,
    });
    expect(evaluarEscalamientos([fila], AHORA, PARAMETROS)).toHaveLength(0);
  });

  it('cada aviso incluye el club y la empresa, para poder agruparlo por club', () => {
    const fila = filaBase({ estado: 'Tratativas', fechaUltimoContacto: new Date('2026-11-01T09:00:00-03:00') });
    const [aviso] = evaluarEscalamientos([fila], AHORA, PARAMETROS);
    expect(aviso).toMatchObject({ club: 'Agro', empresa: 'Acme S.A.', tipo: 'ESCALAMIENTO' });
  });
});
