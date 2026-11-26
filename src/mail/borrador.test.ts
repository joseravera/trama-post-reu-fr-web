import { construirAsunto, construirAsuntoPingueo, construirDatosTemplate, textoPlano } from './borrador';
import type { PostReunionConfirmado } from '../shared/types';

describe('construirAsunto', () => {
  it('reemplaza el nombre de la empresa en el template de asunto', () => {
    expect(construirAsunto('Acme S.A.')).toBe('Acme S.A. & Trama ITBA');
  });
});

describe('construirAsuntoPingueo', () => {
  it('reemplaza el nombre de la empresa en el asunto de pingueo', () => {
    expect(construirAsuntoPingueo('Acme S.A.')).toBe('Acme S.A. & Trama ITBA');
  });
});

describe('textoPlano', () => {
  it('convierte párrafos y viñetas en texto legible, sin tags', () => {
    const html = '<p>Hola <strong>Martina</strong>,</p><ul><li>Punto uno</li><li>Punto dos</li></ul>';
    const texto = textoPlano(html);
    expect(texto).not.toContain('<');
    expect(texto).toContain('Hola Martina,');
    expect(texto).toContain('- Punto uno');
    expect(texto).toContain('- Punto dos');
  });

  it('decodifica entidades HTML básicas', () => {
    expect(textoPlano('<p>Juan &amp; Cía</p>')).toBe('Juan & Cía');
  });
});

describe('construirDatosTemplate', () => {
  const base: PostReunionConfirmado = {
    club: 'Agro',
    empresa: 'Acme S.A.',
    fechaReunion: new Date('2026-11-18T10:00:00-03:00'),
    adjuntosExtra: [],
    datos: {
      persona: 'Martina',
      rolPersona: 'Marketing',
      mail: 'martina@acme.com',
      telefono: null,
      linkedin: null,
      compromisosEmpresa: [],
      compromisosTrama: [],
      parrafoCompromisos: 'Nos comprometimos a mandar la propuesta.',
      estadoSugerido: 'Tratativas',
      comentarios: 'resumen',
      proximaAccion: null,
      fechaProximaAccion: null,
      camposFaltantes: [],
    },
  };

  it('arma los datos con la fecha formateada y los compromisos', () => {
    const fechaCarga = new Date('2026-11-20T09:00:00-03:00');
    const datos = construirDatosTemplate(base, fechaCarga);
    expect(datos.persona).toBe('Martina');
    expect(datos.nombreEmpresa).toBe('Acme S.A.');
    expect(datos.fechaReunion).toBe('del miércoles 18/11');
    expect(datos.compromisos).toBe('Nos comprometimos a mandar la propuesta.');
  });

  it('usa persona vacía si el LLM no la extrajo', () => {
    const sinPersona: PostReunionConfirmado = { ...base, datos: { ...base.datos, persona: null } };
    expect(construirDatosTemplate(sinPersona, base.fechaReunion).persona).toBe('');
  });
});
