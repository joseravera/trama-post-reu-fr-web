import { evaluarReglas, resolverDestinatarios, type ParametrosReglas } from './reglas';
import type { Aviso, FilaCRM, Usuario } from '../shared/types';

const PARAMETROS: ParametrosReglas = {
  diasPingueoMail: 7,
  diasCoordinar: 3,
  horasCargaPost: 24,
  diasSeguimiento: 7,
  diasTratativasEscala: 14,
  pingueosEscala: 2,
  diasVencidoEscala: 3,
};

const AHORA = new Date('2026-11-25T09:00:00-03:00'); // miércoles

function filaBase(overrides: Partial<FilaCRM>): FilaCRM {
  return {
    club: 'Agro',
    empresa: 'Acme S.A.',
    trameroEncargado: 'Juan',
    pingueosSinRespuesta: 0,
    ...overrides,
  };
}

describe('evaluarReglas — CARGAR_POST_REUNION', () => {
  it('avisa si pasaron más de HORAS_CARGA_POST desde la reunión sin cargar el post-reunión', () => {
    const fila = filaBase({
      estado: 'Reunión coordinada',
      fechaProximaAccion: new Date('2026-11-23T10:00:00-03:00'), // hace 2 días
    });
    const avisos = evaluarReglas([fila], AHORA, PARAMETROS);
    expect(avisos.some((a) => a.tipo === 'CARGAR_POST_REUNION')).toBe(true);
  });

  it('no avisa si todavía no pasaron las horas', () => {
    const fila = filaBase({
      estado: 'Reunión coordinada',
      fechaProximaAccion: new Date('2026-11-25T08:00:00-03:00'), // hace 1 hora
    });
    expect(evaluarReglas([fila], AHORA, PARAMETROS)).toHaveLength(0);
  });
});

describe('evaluarReglas — PINGUEAR', () => {
  it('avisa en Mail enviado con DIAS_PINGUEO_MAIL sin respuesta', () => {
    const fila = filaBase({ estado: 'Mail enviado', fechaUltimoContacto: new Date('2026-11-18T09:00:00-03:00') });
    const avisos = evaluarReglas([fila], AHORA, PARAMETROS);
    expect(avisos.filter((a) => a.tipo === 'PINGUEAR')).toHaveLength(1);
  });

  it('avisa en Mail respondido con DIAS_COORDINAR sin reunión coordinada', () => {
    const fila = filaBase({ estado: 'Mail respondido', fechaUltimoContacto: new Date('2026-11-21T09:00:00-03:00') });
    const avisos = evaluarReglas([fila], AHORA, PARAMETROS);
    expect(avisos.filter((a) => a.tipo === 'PINGUEAR')).toHaveLength(1);
  });

  it('no avisa antes de tiempo', () => {
    const fila = filaBase({ estado: 'Mail enviado', fechaUltimoContacto: new Date('2026-11-24T09:00:00-03:00') });
    expect(evaluarReglas([fila], AHORA, PARAMETROS)).toHaveLength(0);
  });
});

describe('evaluarReglas — SEGUIMIENTO_VENCIDO', () => {
  it('avisa si la fecha de próxima acción ya pasó', () => {
    const fila = filaBase({
      estado: 'Tratativas',
      fechaProximaAccion: new Date('2026-11-23T00:00:00-03:00'),
    });
    const avisos = evaluarReglas([fila], AHORA, PARAMETROS);
    const aviso = avisos.find((a) => a.tipo === 'SEGUIMIENTO_VENCIDO');
    expect(aviso?.texto).toContain('venció');
  });

  it('avisa (como "próximo") si la fecha cae antes del próximo envío aunque no haya llegado', () => {
    const fila = filaBase({
      estado: 'Tuvimos reunión, esperando respuesta',
      fechaProximaAccion: new Date('2026-11-25T23:00:00-03:00'), // hoy, miércoles
    });
    const avisos = evaluarReglas([fila], AHORA, PARAMETROS);
    expect(avisos.some((a) => a.tipo === 'SEGUIMIENTO_VENCIDO')).toBe(true);
  });

  it('no avisa si la fecha es posterior al próximo envío (viernes)', () => {
    const fila = filaBase({
      estado: 'Tratativas',
      fechaProximaAccion: new Date('2026-11-30T10:00:00-03:00'), // lunes siguiente, después del viernes
    });
    expect(evaluarReglas([fila], AHORA, PARAMETROS)).toHaveLength(0);
  });

  it('sin próxima acción, avisa tras DIAS_SEGUIMIENTO sin contacto', () => {
    const fila = filaBase({
      estado: 'Tratativas',
      fechaUltimoContacto: new Date('2026-11-17T10:00:00-03:00'),
    });
    expect(evaluarReglas([fila], AHORA, PARAMETROS).some((a) => a.tipo === 'SEGUIMIENTO_VENCIDO')).toBe(true);
  });
});

describe('evaluarReglas — COMPROMISO_TRAMA', () => {
  it('avisa si vence mañana y el estado no es de seguimiento', () => {
    const fila = filaBase({
      estado: 'Reunión coordinada',
      proximaAccion: 'Mandarles el PDB actualizado',
      fechaProximaAccion: new Date('2026-11-26T10:00:00-03:00'),
    });
    expect(evaluarReglas([fila], AHORA, PARAMETROS).some((a) => a.tipo === 'COMPROMISO_TRAMA')).toBe(true);
  });

  it('no duplica con SEGUIMIENTO_VENCIDO en los estados que esa regla ya cubre', () => {
    const fila = filaBase({
      estado: 'Tratativas',
      proximaAccion: 'Mandar propuesta',
      fechaProximaAccion: new Date('2026-11-26T10:00:00-03:00'),
    });
    const avisos = evaluarReglas([fila], AHORA, PARAMETROS);
    expect(avisos.filter((a) => a.empresa === fila.empresa)).toHaveLength(1);
  });
});

describe('evaluarReglas — estados finales', () => {
  it('no genera ningún aviso para un estado final', () => {
    const fila = filaBase({
      estado: 'Va a ser sponsor',
      fechaUltimoContacto: new Date('2026-01-01T10:00:00-03:00'),
      pingueosSinRespuesta: 10,
    });
    expect(evaluarReglas([fila], AHORA, PARAMETROS)).toHaveLength(0);
  });
});

describe('resolverDestinatarios', () => {
  const usuarios: Usuario[] = [
    { mail: 'juan@trama.org', nombre: 'Juan', club: 'Agro', rol: 'FR' },
    { mail: 'coordi.agro@trama.org', nombre: 'Coordi Agro', club: 'Agro', rol: 'Coordinador' },
  ];

  it('reemplaza el nombre del FR por su mail en avisos para FR', () => {
    const aviso: Aviso = { clave: 'k1', tipo: 'PINGUEAR', destinatarios: ['Juan'], club: 'Agro', empresa: 'Acme', texto: 't' };
    const resueltos = resolverDestinatarios([aviso], usuarios);
    expect(resueltos).toEqual([{ ...aviso, destinatarios: ['juan@trama.org'] }]);
  });

  it('agrega los coordinadores del club y al FR en copia en los escalamientos', () => {
    const aviso: Aviso = { clave: 'k2', tipo: 'ESCALAMIENTO', destinatarios: ['Juan'], club: 'Agro', empresa: 'Acme', texto: 't' };
    const [resuelto] = resolverDestinatarios([aviso], usuarios);
    expect(resuelto?.destinatarios).toEqual(['coordi.agro@trama.org', 'juan@trama.org']);
  });

  it('descarta el aviso si no puede resolver ningún destinatario', () => {
    const aviso: Aviso = { clave: 'k3', tipo: 'PINGUEAR', destinatarios: ['Alguien que no existe'], club: 'Agro', empresa: 'Acme', texto: 't' };
    expect(resolverDestinatarios([aviso], usuarios)).toHaveLength(0);
  });
});

describe('evaluarReglas — traspasos', () => {
  it('pide pinguear un traspaso sin respuesta usando la fecha de primer contacto', () => {
    const fila = filaBase({ estado: 'FR viejo mando el mail de traspaso', fechaPrimerContacto: new Date('2026-11-10T10:00:00-03:00') });
    const avisos = evaluarReglas([fila], AHORA, PARAMETROS);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({ tipo: 'PINGUEAR' });
    expect(avisos[0].texto).toMatch(/traspaso/);
  });

  it('pide coordinar si respondió el traspaso hace días', () => {
    const fila = filaBase({ estado: 'Respondió traspaso', fechaUltimoContacto: new Date('2026-11-20T10:00:00-03:00') });
    expect(evaluarReglas([fila], AHORA, PARAMETROS).map((a) => a.tipo)).toEqual(['PINGUEAR']);
  });

  it('no avisa si el traspaso es reciente', () => {
    const fila = filaBase({ estado: 'FR viejo mando el mail de traspaso', fechaPrimerContacto: new Date('2026-11-24T10:00:00-03:00') });
    expect(evaluarReglas([fila], AHORA, PARAMETROS)).toHaveLength(0);
  });
});

describe('evaluarReglas — mail semanal a los FR (diaEnvioFr)', () => {
  const LUNES = new Date('2026-11-23T09:00:00-03:00');
  const SEMANAL: ParametrosReglas = { ...PARAMETROS, diaEnvioFr: 1 };

  it('avisa los compromisos que vencen antes del próximo mail, no solo los de mañana', () => {
    const fila = filaBase({ estado: 'Reunión coordinada', proximaAccion: 'Mandar PDB', fechaProximaAccion: new Date('2026-11-27T10:00:00-03:00') });
    expect(evaluarReglas([fila], LUNES, PARAMETROS).some((a) => a.tipo === 'COMPROMISO_TRAMA')).toBe(false);
    const aviso = evaluarReglas([fila], LUNES, SEMANAL).find((a) => a.tipo === 'COMPROMISO_TRAMA');
    expect(aviso?.texto).toMatch(/En 4 días vence "Mandar PDB"/);
  });

  it('no avisa compromisos que vencen después del próximo mail', () => {
    const fila = filaBase({ estado: 'Reunión coordinada', fechaProximaAccion: new Date('2026-12-05T10:00:00-03:00') });
    expect(evaluarReglas([fila], LUNES, SEMANAL).some((a) => a.tipo === 'COMPROMISO_TRAMA')).toBe(false);
  });

  it('el seguimiento vencido mira toda la semana hasta el próximo mail', () => {
    const fila = filaBase({ estado: 'Tratativas', proximaAccion: 'Llamar', fechaProximaAccion: new Date('2026-11-28T10:00:00-03:00') });
    expect(evaluarReglas([fila], LUNES, PARAMETROS).some((a) => a.tipo === 'SEGUIMIENTO_VENCIDO')).toBe(false);
    expect(evaluarReglas([fila], LUNES, SEMANAL).some((a) => a.tipo === 'SEGUIMIENTO_VENCIDO')).toBe(true);
  });
});

describe('resolverDestinatarios — nombres', () => {
  it('encuentra al FR aunque el nombre del CRM tenga tildes o espacios distintos', () => {
    const usuarios: Usuario[] = [{ mail: 'jdealba@itba.edu.ar', nombre: 'Joaquín de Alba', club: 'Trama Lab', rol: 'Coordinador' }];
    const aviso: Aviso = { clave: 'k', tipo: 'PINGUEAR', destinatarios: ['joaquin de alba '], club: 'Trama Lab', empresa: 'X', texto: 't' };
    expect(resolverDestinatarios([aviso], usuarios)[0].destinatarios).toEqual(['jdealba@itba.edu.ar']);
  });
});
