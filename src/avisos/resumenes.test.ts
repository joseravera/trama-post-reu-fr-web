import {
  construirResumenCodis,
  construirResumenCoordinador,
  formatearResumenCodis,
  formatearResumenCoordinador,
} from './resumenes';
import type { Evento, FilaCRM } from '../shared/types';

const AHORA = new Date('2026-11-25T09:00:00-03:00');

function filaBase(overrides: Partial<FilaCRM>): FilaCRM {
  return { club: 'Agro', empresa: 'Acme', trameroEncargado: 'Juan', pingueosSinRespuesta: 0, ...overrides };
}

function eventoBase(overrides: Partial<Evento>): Evento {
  return { timestamp: AHORA, club: 'Agro', empresa: 'Acme', fr: 'Juan', tipo: 'ALTA', origen: 'UI', ...overrides };
}

describe('construirResumenCoordinador', () => {
  it('cuenta contactos nuevos, reuniones y sponsors de la semana vs la anterior', () => {
    const actuales = [
      eventoBase({ tipo: 'ALTA', empresa: 'A' }),
      eventoBase({ tipo: 'ALTA', empresa: 'B' }),
      eventoBase({ tipo: 'POST_REUNION', empresa: 'A' }),
      eventoBase({ tipo: 'CAMBIO_ESTADO', empresa: 'A', estadoNuevo: 'Va a ser sponsor' }),
    ];
    const anteriores = [eventoBase({ tipo: 'ALTA', empresa: 'Z' })];

    const resumen = construirResumenCoordinador('Agro', [], actuales, anteriores, AHORA);

    expect(resumen.contactosNuevos).toBe(2);
    expect(resumen.contactosNuevosSemanaAnterior).toBe(1);
    expect(resumen.reunionesHechas).toBe(1);
    expect(resumen.nuevosSponsorsEmpresas).toEqual(['A']);
    expect(resumen.nuevosSponsors).toBe(1);
  });

  it('no duplica una empresa que aparece dos veces como nuevo sponsor', () => {
    const actuales = [
      eventoBase({ tipo: 'CAMBIO_ESTADO', empresa: 'A', estadoNuevo: 'Va a ser sponsor' }),
      eventoBase({ tipo: 'CAMBIO_ESTADO', empresa: 'A', estadoNuevo: 'Va a ser sponsor' }),
    ];
    const resumen = construirResumenCoordinador('Agro', [], actuales, [], AHORA);
    expect(resumen.nuevosSponsorsEmpresas).toEqual(['A']);
  });

  it('cuenta el embudo por estado sobre la foto actual del CRM', () => {
    const filas = [
      filaBase({ empresa: 'A', estado: 'Mail enviado' }),
      filaBase({ empresa: 'B', estado: 'Mail enviado' }),
      filaBase({ empresa: 'C', estado: 'Tratativas' }),
    ];
    const resumen = construirResumenCoordinador('Agro', filas, [], [], AHORA);
    expect(resumen.embudo['Mail enviado']).toBe(2);
    expect(resumen.embudo['Tratativas']).toBe(1);
    expect(resumen.embudo['Va a ser sponsor']).toBe(0);
  });

  it('marca empresas trabadas por pingueos o por seguimiento vencido', () => {
    const filas = [
      filaBase({ empresa: 'A', estado: 'Mail enviado', pingueosSinRespuesta: 2 }),
      filaBase({
        empresa: 'B',
        estado: 'Tratativas',
        fechaProximaAccion: new Date('2026-11-20T09:00:00-03:00'),
      }),
      filaBase({ empresa: 'C', estado: 'Mail enviado', pingueosSinRespuesta: 1 }),
    ];
    const resumen = construirResumenCoordinador('Agro', filas, [], [], AHORA);
    expect(resumen.empresasTrabadas.map((t) => t.empresa).sort()).toEqual(['A', 'B']);
  });

  it('genera recomendaciones por pingueos y por FR con seguimientos vencidos', () => {
    const filas = [
      filaBase({ empresa: 'A', trameroEncargado: 'Juan', estado: 'Mail enviado', pingueosSinRespuesta: 2 }),
      filaBase({
        empresa: 'B',
        trameroEncargado: 'Juan',
        estado: 'Tratativas',
        fechaProximaAccion: new Date('2026-11-20T09:00:00-03:00'),
      }),
    ];
    const resumen = construirResumenCoordinador('Agro', filas, [], [], AHORA);
    expect(resumen.recomendaciones.some((r) => r.includes('1 empresas con 2+ pingueos'))).toBe(true);
    expect(resumen.recomendaciones.some((r) => r.includes('Juan tiene 1 seguimiento vencido'))).toBe(true);
  });

  it('cuenta las post-reuniones cargadas por FR', () => {
    const actuales = [
      eventoBase({ tipo: 'POST_REUNION', fr: 'Juan' }),
      eventoBase({ tipo: 'POST_REUNION', fr: 'Juan' }),
      eventoBase({ tipo: 'POST_REUNION', fr: 'Martina' }),
    ];
    const resumen = construirResumenCoordinador('Agro', [], actuales, [], AHORA);
    expect(resumen.actividadPorFr.sort((a, b) => a.fr.localeCompare(b.fr))).toEqual([
      { fr: 'Juan', postReunionesCargadas: 2 },
      { fr: 'Martina', postReunionesCargadas: 1 },
    ]);
  });
});

describe('construirResumenCodis', () => {
  it('consolida los resúmenes de los clubes y marca los que bajaron actividad', () => {
    const subio = construirResumenCoordinador(
      'Agro',
      [],
      [eventoBase({ tipo: 'ALTA' }), eventoBase({ tipo: 'ALTA' })],
      [eventoBase({ tipo: 'ALTA' })],
      AHORA,
    );
    const bajo = construirResumenCoordinador(
      'Consultoría',
      [],
      [eventoBase({ tipo: 'ALTA' })],
      [eventoBase({ tipo: 'ALTA' }), eventoBase({ tipo: 'ALTA' })],
      AHORA,
    );

    const codis = construirResumenCodis([subio, bajo]);
    expect(codis.clubesConMenosActividad).toEqual(['Consultoría']);
    expect(codis.porClub).toHaveLength(2);
  });

  it('junta los nuevos sponsors de todos los clubes con su club', () => {
    const agro = construirResumenCoordinador(
      'Agro',
      [],
      [eventoBase({ tipo: 'CAMBIO_ESTADO', empresa: 'A', estadoNuevo: 'Va a ser sponsor' })],
      [],
      AHORA,
    );
    const codis = construirResumenCodis([agro]);
    expect(codis.nuevosSponsors).toEqual([{ club: 'Agro', empresa: 'A' }]);
  });
});

describe('formatearResumenCoordinador / formatearResumenCodis', () => {
  it('genera texto legible sin tirar error', () => {
    const resumen = construirResumenCoordinador('Agro', [], [], [], AHORA);
    expect(formatearResumenCoordinador(resumen)).toContain('Resumen semanal — Agro');
  });

  it('formatearResumenCodis incluye cada club', () => {
    const resumen = construirResumenCoordinador('Agro', [], [], [], AHORA);
    const codis = construirResumenCodis([resumen]);
    expect(formatearResumenCodis(codis)).toContain('Agro');
  });
});
