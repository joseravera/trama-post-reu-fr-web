import { transicionValida } from '../crm/maquinaEstados';
import type { Estado, Extraccion, FilaCRM } from '../shared/types';
import type { RespuestaGemini } from './schema';
import {
  combinarConFilaExistente,
  diaISO,
  aExtraccion,
  esFechaISO,
  fechaRespaldadaPorLasNotas,
  ESTADOS_POST_REUNION,
  estadoPreseleccionado,
  fechaDeDia,
  parsearExtraccion,
  validarConfirmacion,
  validarExtraccion,
  validarFechaProximaAccion,
  validarMail,
} from './validacion';

function extraccion(parcial: Partial<Extraccion> = {}): Extraccion {
  return {
    persona: 'Martina',
    rolPersona: 'Marketing',
    mail: 'martina@agrotech.com',
    telefono: null,
    linkedin: null,
    compromisosEmpresa: [],
    compromisosTrama: [],
    parrafoCompromisos: null,
    estadoSugerido: 'Tuvimos reunión, esperando respuesta',
    comentarios: 'Reunión con Martina.',
    proximaAccion: 'Esperar respuesta',
    fechaProximaAccion: '2026-11-25',
    camposFaltantes: [],
    ...parcial,
  };
}

const REUNION = fechaDeDia('2026-11-18');

const FILA: FilaCRM = {
  club: 'Agro',
  empresa: 'AgroTech',
  trameroEncargado: 'Juana',
  persona: 'Martina',
  mail: 'martina@agrotech.com',
  telefono: '11 4444 5555',
  estado: 'Reunión coordinada',
  fechaProximaAccion: fechaDeDia('2026-11-30'),
  pingueosSinRespuesta: 0,
};

describe('fechas de día', () => {
  it('toma el día en hora Argentina', () => {
    expect(diaISO(new Date('2026-11-19T01:00:00Z'))).toBe('2026-11-18'); // 22:00 en Argentina
    expect(diaISO(fechaDeDia('2026-11-18'))).toBe('2026-11-18');
  });
  it('valida yyyy-mm-dd reales', () => {
    expect(esFechaISO('2026-02-29')).toBe(false);
    expect(esFechaISO('2026-11-18')).toBe(true);
    expect(esFechaISO('18/11/2026')).toBe(false);
  });
});

describe('validarMail y validarFechaProximaAccion', () => {
  it('valida el formato del mail', () => {
    expect(validarMail('a@b.com')).toBe(true);
    expect(validarMail('sin-arroba')).toBe(false);
    expect(validarMail(null)).toBe(true);
  });
  it('la próxima acción puede ser el mismo día de la reunión, no antes', () => {
    expect(validarFechaProximaAccion('2026-11-18', new Date('2026-11-18T10:00:00-03:00'))).toBe(true);
    expect(validarFechaProximaAccion('2026-11-17', REUNION)).toBe(false);
    expect(validarFechaProximaAccion('mañana', REUNION)).toBe(false);
    expect(validarFechaProximaAccion(null, REUNION)).toBe(true);
  });
});

describe('combinarConFilaExistente', () => {
  it('un null del LLM no sobrescribe un valor existente', () => {
    const r = combinarConFilaExistente(extraccion({ mail: null, telefono: null, proximaAccion: null, fechaProximaAccion: null }), FILA);
    expect(r.mail).toBe('martina@agrotech.com');
    expect(r.telefono).toBe('11 4444 5555');
  });
  it('la próxima acción y su fecha no se copian del CRM (eran de antes de la reunión)', () => {
    const r = combinarConFilaExistente(extraccion({ proximaAccion: null, fechaProximaAccion: null }), FILA);
    expect(r.proximaAccion).toBeNull();
    expect(r.fechaProximaAccion).toBeNull();
  });
  it('un valor del LLM sí reemplaza', () => {
    expect(combinarConFilaExistente(extraccion({ persona: 'Martina Gómez' }), FILA).persona).toBe('Martina Gómez');
  });
});

describe('parsearExtraccion (esquema)', () => {
  it('acepta un JSON que cumple el esquema', () => {
    expect(parsearExtraccion(JSON.stringify(extraccion()), '').ok).toBe(true);
  });
  it('rechaza JSON roto, estado inexistente y tipos incorrectos', () => {
    expect(parsearExtraccion('{roto', '').ok).toBe(false);
    expect(parsearExtraccion(JSON.stringify(extraccion({ estadoSugerido: 'Primer pingueo' as never })), '').ok).toBe(false);
    expect(parsearExtraccion(JSON.stringify({ ...extraccion(), mail: 3 }), '').ok).toBe(false);
    expect(parsearExtraccion(JSON.stringify({ ...extraccion(), compromisosTrama: undefined }), '').ok).toBe(false);
  });
});

describe('validarExtraccion', () => {
  const ctx = { filaExistente: null, fechaReunion: REUNION, transicionValida };

  it('mail con formato inválido: queda vacío y marcado', () => {
    const r = validarExtraccion(extraccion({ mail: 'martina(at)agrotech' }), ctx);
    expect(r.mail).toBeNull();
    expect(r.camposFaltantes).toContain('mail');
  });

  it('fecha anterior a la reunión: queda vacía y marcada', () => {
    const r = validarExtraccion(extraccion({ fechaProximaAccion: '2026-11-01' }), ctx);
    expect(r.fechaProximaAccion).toBeNull();
    expect(r.camposFaltantes).toContain('fechaProximaAccion');
  });

  it('un faltante que se completa con la fila existente deja de estar marcado', () => {
    const r = validarExtraccion(extraccion({ mail: null, camposFaltantes: ['mail', 'linkedin'] }), { ...ctx, filaExistente: FILA });
    expect(r.mail).toBe('martina@agrotech.com');
    expect(r.camposFaltantes).toEqual(['linkedin']);
  });

  it('estado sugerido no alcanzable desde el estado actual: marcado para revisión', () => {
    const fila = { ...FILA, estado: 'Mail enviado' as const };
    const tratativas = extraccion({ estadoSugerido: 'Tratativas' });
    expect(validarExtraccion(tratativas, { ...ctx, filaExistente: fila }).camposFaltantes).toContain('estadoSugerido');
    expect(validarExtraccion(extraccion(), { ...ctx, filaExistente: FILA }).camposFaltantes).not.toContain('estadoSugerido');
  });

  it('estado preseleccionado: Reunión coordinada, salvo que Gemini sugiera Tratativas o un estado final', () => {
    const conSugerencia = (s: Estado) => validarExtraccion(extraccion({ estadoSugerido: s }), ctx).estadoSugerido;
    expect(conSugerencia('Tuvimos reunión, esperando respuesta')).toBe('Reunión coordinada');
    expect(conSugerencia('Reunión coordinada')).toBe('Reunión coordinada');
    expect(conSugerencia('Tratativas')).toBe('Tratativas');
    expect(conSugerencia('Va a ser sponsor')).toBe('Va a ser sponsor');
    expect(conSugerencia('No va a ser sponsor')).toBe('No va a ser sponsor');
    expect(estadoPreseleccionado('Mail enviado')).toBe('Reunión coordinada');
  });

  it('al confirmar solo se aceptan los estados del desplegable del post-reunión', () => {
    const errores = validarConfirmacion(extraccion({ estadoSugerido: 'Mail respondido' }), undefined, ctx.fechaReunion, () => true);
    expect(errores[0]).toMatch(/no es un estado posible/);
    expect(ESTADOS_POST_REUNION).toEqual(['Reunión coordinada', 'Tuvimos reunión, esperando respuesta', 'Va a ser sponsor', 'No va a ser sponsor', 'Tratativas']);
  });
});

describe('validarConfirmacion', () => {
  it('sin errores con datos completos y transición válida', () => {
    expect(validarConfirmacion(extraccion(), 'Reunión coordinada', REUNION, transicionValida)).toEqual([]);
  });
  it('no se puede confirmar sin mail ni con un estado inválido', () => {
    expect(validarConfirmacion(extraccion({ mail: null }), undefined, REUNION, transicionValida)).toEqual(['Falta el mail del contacto.']);
    expect(validarConfirmacion(extraccion(), 'Va a ser sponsor', REUNION, transicionValida)[0]).toMatch(/No se puede pasar/);
  });
});

describe('próximo contacto: la fecha tiene que salir de las notas', () => {
  const NOTAS_LAURA = `### Próximos pasos
•  Nosotros: mandarle el PDB actualizado y el documento del BootCamp
•  Nosotros: mandarle métricas de la edición anterior (asistentes, carreras, redes)
•  Laura: presentar la propuesta internamente y respondernos después del 10/12, cuando tengan el presupuesto cerrado`;

  function respuesta(p: Partial<RespuestaGemini> = {}): RespuestaGemini {
    const { proximaAccion: _a, fechaProximaAccion: _f, ...base } = extraccion();
    return {
      ...base,
      camposFaltantes: [],
      proximoContactoConLaEmpresa: 'Seguimiento con Laura: respuesta sobre la propuesta',
      fechaProximoContacto: '2026-12-10',
      textoDeLaFecha: 'respondernos después del 10/12',
      ...p,
    };
  }

  it('acepta la fecha si el fragmento está en las notas (aunque cambien mayúsculas, acentos o espacios)', () => {
    expect(fechaRespaldadaPorLasNotas('respondernos después del 10/12', NOTAS_LAURA)).toBe(true);
    expect(fechaRespaldadaPorLasNotas('  Respondernos  despues del 10/12.', NOTAS_LAURA)).toBe(true);
    const e = aExtraccion(respuesta(), NOTAS_LAURA);
    expect(e.proximaAccion).toBe('Seguimiento con Laura: respuesta sobre la propuesta');
    expect(e.fechaProximaAccion).toBe('2026-12-10');
    expect(e.camposFaltantes).not.toContain('fechaProximaAccion');
  });

  it('descarta una fecha inventada: sin fragmento, con un fragmento que no está en las notas o sin fecha', () => {
    for (const textoDeLaFecha of [null, 'nos responden mañana', 'mandarle métricas de la edición anterior']) {
      const e = aExtraccion(respuesta({ fechaProximoContacto: '2026-11-24', textoDeLaFecha }), NOTAS_LAURA);
      expect(e.fechaProximaAccion).toBeNull();
      expect(e.camposFaltantes).toContain('fechaProximaAccion');
    }
  });

  it('traduce los nombres de campos faltantes de Gemini a los de Extraccion', () => {
    const e = aExtraccion(
      respuesta({ proximoContactoConLaEmpresa: null, fechaProximoContacto: null, textoDeLaFecha: null, camposFaltantes: ['telefono', 'fechaProximoContacto', 'textoDeLaFecha'] }),
      NOTAS_LAURA,
    );
    expect(e.camposFaltantes.sort()).toEqual(['fechaProximaAccion', 'proximaAccion', 'telefono']);
    expect(Object.keys(e)).not.toContain('textoDeLaFecha');
  });
});
