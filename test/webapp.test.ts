import { crearEndpoints, type DependenciasWebapp } from '../src/app/webapp';
import { crearExtraccionService } from '../src/extraccion/gemini';
import { fechaDeDia } from '../src/extraccion/validacion';
import type { ConfigService, Extraccion, FilaCRM, Usuario } from '../src/shared/types';
import { crearFakeCrmService } from './fakes/fakeCrmService';
import { crearFakeMailService } from './fakes/fakeMailService';

const USUARIOS: Usuario[] = [
  { mail: 'juana@itba.edu.ar', nombre: 'Juana Pérez', club: 'Agro', rol: 'FR' },
  { mail: 'codi@itba.edu.ar', nombre: 'Ana', club: null, rol: 'Codirectora' },
  { mail: 'admin@itba.edu.ar', nombre: 'Josefina Ravera', club: 'Emprendedores', rol: 'Coordinador', admin: true },
];

const config: ConfigService = {
  getUsuario: (mail) => USUARIOS.find((u) => u.mail === mail) ?? null,
  getUsuarios: () => USUARIOS,
  getClub: () => ({
    hoja: 'Agro',
    templateDocId: 'doc',
    carpetaAdjuntosId: 'carpeta-agro',
    templatePingueoPrimerContactoDocId: 'doc-pingueo-primer-contacto',
    templatePingueoPostReunionDocId: 'doc-pingueo-post-reunion',
  }),
  getParametro: () => 0,
  getParametroTexto: () => null,
  getClubesActivos: () => ['Agro'],
};

function fakeVerComo() {
  let mail: string | null = null;
  return { leer: () => mail, guardar: (m: string | null) => { mail = m; } };
}

const FILAS: FilaCRM[] = [
  { club: 'Agro', empresa: 'AgroTech SA', trameroEncargado: 'Juana Pérez', estado: 'Reunión coordinada', pingueosSinRespuesta: 1, fechaProximaAccion: fechaDeDia('2026-11-25') },
  { club: 'Agro', empresa: 'Granos Unidos', trameroEncargado: 'Juana Pérez', estado: 'Mail enviado', mail: 'contacto@granosunidos.com', pingueosSinRespuesta: 0, fechaProximaAccion: fechaDeDia('2026-11-10') },
  { club: 'Agro', empresa: 'Sin Fecha SRL', trameroEncargado: 'Juana Pérez', estado: 'Tuvimos reunión, esperando respuesta', mail: 'contacto@sinfecha.com', pingueosSinRespuesta: 0 },
  { club: 'Agro', empresa: 'Campo Verde', trameroEncargado: 'Juana Pérez', estado: 'Va a ser sponsor', pingueosSinRespuesta: 0 },
  { club: 'Agro', empresa: 'De Pedro', trameroEncargado: 'Pedro', estado: 'Mail enviado', pingueosSinRespuesta: 0 },
];

const NOTAS = 'Reunión con Martina (Marketing) de AgroTech. Mail martina@agrotech.com. Les interesa el BootCamp Agro, nos responden la semana que viene.';

const RESPUESTA: Extraccion = {
  persona: 'Martina',
  rolPersona: 'Marketing',
  mail: 'martina@agrotech.com',
  telefono: null,
  linkedin: null,
  compromisosEmpresa: ['Responder la semana que viene'],
  compromisosTrama: [],
  parrafoCompromisos: 'Quedamos atentos a tu respuesta.',
  estadoSugerido: 'Tuvimos reunión, esperando respuesta',
  comentarios: 'Reunión con Martina (Marketing). Interesados en el BootCamp Agro.',
  proximaAccion: 'Esperar respuesta de Martina',
  fechaProximaAccion: '2026-11-25',
  camposFaltantes: ['telefono', 'linkedin'],
};

function armar(mail = 'juana@itba.edu.ar', parcial: Partial<DependenciasWebapp> = {}) {
  const crm = crearFakeCrmService(FILAS.map((f) => ({ ...f })));
  let instalados = false;
  const instalar = jest.fn();
  const deps: DependenciasWebapp = {
    mailActual: () => mail,
    config,
    crm,
    mail: crearFakeMailService(),
    extraccion: crearExtraccionService((d, h) => crm.transicionValida(d, h), () => JSON.stringify(RESPUESTA)),
    archivosDeCarpeta: (id) => [{ id: `${id}-1`, nombre: 'Casos de éxito.pdf' }],
    triggers: { yaInstalados: () => instalados, instalar, marcarInstalados: () => { instalados = true; } },
    ahora: () => new Date('2026-11-20T15:00:00Z'),
    verComo: fakeVerComo(),
    ...parcial,
  };
  return { api: crearEndpoints(deps), crm, instalar };
}

describe('A1: ingreso', () => {
  it('un FR registrado ve su nombre y club; los triggers se instalan solo al primer ingreso', () => {
    const { api, instalar } = armar();
    const ini = api.inicio();
    expect(ini.usuario?.nombre).toBe('Juana Pérez');
    expect(ini.clubes).toEqual(['Agro']);
    expect(ini.hoy).toBe('2026-11-20');
    api.inicio();
    expect(instalar).toHaveBeenCalledTimes(1);
  });

  it('un usuario no registrado no tiene acceso', () => {
    const { api, instalar } = armar('otro@itba.edu.ar');
    expect(api.inicio().usuario).toBeNull();
    expect(instalar).not.toHaveBeenCalled();
    expect(() => api.buscarEmpresas('Agro', 'agro')).toThrow(/No tenés acceso, pedíselo a tu coordinador/);
  });

  it('si no se pudieron instalar los triggers, se avisa', () => {
    const { api } = armar('juana@itba.edu.ar', {
      triggers: { yaInstalados: () => false, instalar: () => { throw new Error('sin permiso'); }, marcarInstalados: () => undefined },
    });
    expect(api.inicio().avisoTriggers).toMatch(/sin permiso/);
  });
});

describe('A2: paso 1', () => {
  it('el club es el del FR; solo las codirectoras pueden elegir otro', () => {
    expect(() => armar().api.buscarEmpresas('Consultoría', 'a')).toThrow(/No podés operar/);
    expect(armar('codi@itba.edu.ar').api.inicio().clubes).toHaveLength(5);
  });

  it('autocompletado contra la hoja del club y empresa existente / nueva', () => {
    const { api } = armar();
    expect(api.buscarEmpresas('Agro', 'agro')).toEqual(['AgroTech SA']);
    expect(api.infoEmpresa('Agro', 'AgroTech SA')).toMatchObject({ existe: true, estadoActual: 'Reunión coordinada' });
    expect(api.infoEmpresa('Agro', 'Nueva SRL')).toMatchObject({ existe: false, estadoActual: null });
  });

  it('no se puede procesar sin empresa ni con notas cortas', () => {
    const { api } = armar();
    expect(() => api.procesarNotas({ club: 'Agro', empresa: ' ', fechaReunion: '2026-11-18', notas: NOTAS })).toThrow(/empresa/);
    expect(() => api.procesarNotas({ club: 'Agro', empresa: 'AgroTech SA', fechaReunion: '2026-11-18', notas: 'corto' })).toThrow(/100/);
  });
});

describe('A3–A6: procesar y confirmar', () => {
  it('flujo completo y todo lo que viaja al navegador es serializable (sin Date)', () => {
    const { api, crm } = armar();
    const r = api.procesarNotas({ club: 'Agro', empresa: 'AgroTech SA', fechaReunion: '2026-11-18', notas: NOTAS });
    expect(r.error).toBeNull();
    // Quedarse en el mismo estado es válido (regla de B en crm/maquinaEstados.ts).
    expect(r.empresa.estadosValidos).toEqual(['Reunión coordinada', 'Tuvimos reunión, esperando respuesta', 'Tratativas', 'No va a ser sponsor']);
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);

    const enviado = { club: 'Agro' as const, empresa: 'AgroTech SA', fechaReunion: '2026-11-18', datos: r.extraccion, adjuntosExtra: [] };
    expect(api.previsualizarMail(enviado)).toContain('AgroTech SA');
    expect(api.confirmarPostReunion(enviado).ok).toBe(true);
    // Gemini sugirió "Tuvimos reunión…", pero queda "Reunión coordinada" hasta que se mande el mail.
    expect(r.extraccion.estadoSugerido).toBe('Reunión coordinada');
    expect(r.estados).toEqual(['Reunión coordinada', 'Tuvimos reunión, esperando respuesta', 'Va a ser sponsor', 'No va a ser sponsor', 'Tratativas']);
    expect(crm.getFila('Agro', 'AgroTech SA')?.estado).toBe('Reunión coordinada');
  });

  it('si la extracción falla, devuelve el error y un formulario para completar a mano', () => {
    const { api } = armar('juana@itba.edu.ar', { extraccion: { extraer: () => { throw new Error('Gemini caído'); } } });
    const r = api.procesarNotas({ club: 'Agro', empresa: 'AgroTech SA', fechaReunion: '2026-11-18', notas: NOTAS });
    expect(r.error).toMatch(/Gemini caído/);
    expect(r.extraccion.camposFaltantes).toContain('estadoSugerido');
  });

  it('no se puede confirmar sin mail ni con un estado inválido', () => {
    const { api, crm } = armar();
    const base = { club: 'Agro' as const, empresa: 'AgroTech SA', fechaReunion: '2026-11-18', adjuntosExtra: [] };
    expect(api.confirmarPostReunion({ ...base, datos: { ...RESPUESTA, mail: null } }).ok).toBe(false);
    expect(api.confirmarPostReunion({ ...base, datos: { ...RESPUESTA, estadoSugerido: 'Va a ser sponsor' } }).mensaje).toMatch(/No se puede pasar/);
    expect(crm.getFila('Agro', 'AgroTech SA')?.estado).toBe('Reunión coordinada');
  });

  it('lista los archivos de la carpeta de adjuntos del club', () => {
    expect(armar().api.listarAdjuntos('Agro')).toEqual([{ id: 'carpeta-agro-1', nombre: 'Casos de éxito.pdf' }]);
  });
});

describe('A7: mis seguimientos', () => {
  it('empresas del FR con estado no final, por fecha de próxima acción (vencidas primero)', () => {
    const lista = armar().api.listarSeguimientos();
    expect(lista.map((s) => s.empresa)).toEqual(['Granos Unidos', 'AgroTech SA', 'Sin Fecha SRL']);
    expect(lista.map((s) => s.vencida)).toEqual([true, false, false]);
  });

  it('genera el borrador de pingueo de "primer contacto" sin contarlo todavía en el CRM', () => {
    const { api, crm } = armar();
    const r = api.registrarPingueo('Agro', 'Granos Unidos'); // estado: 'Mail enviado' -> todavía no hubo reunión
    expect(r.borradorUrl).toMatch(/PRIMER_CONTACTO/);
    // El pingueo se cuenta cuando se manda el borrador (lo hace el sync de Gmail), no al crearlo.
    expect(r.seguimiento.pingueosSinRespuesta).toBe(0);
    expect(crm.getFila('Agro', 'Granos Unidos')?.pingueosSinRespuesta).toBe(0);
  });

  it('genera el borrador de pingueo "post reunión" cuando ya hubo reunión y no respondió', () => {
    const { api } = armar();
    const r = api.registrarPingueo('Agro', 'Sin Fecha SRL'); // estado: 'Tuvimos reunión, esperando respuesta'
    expect(r.borradorUrl).toMatch(/POST_REUNION/);
  });

  it('no se puede pinguear sin el mail del contacto', () => {
    const { api } = armar();
    expect(() => api.registrarPingueo('Agro', 'AgroTech SA')).toThrow(/falta el mail de contacto/);
  });
});

describe('Admin y "ver como"', () => {
  it('el admin elige cualquier club y ve el selector', () => {
    const ini = armar('admin@itba.edu.ar').api.inicio();
    expect(ini.esAdmin).toBe(true);
    expect(ini.viendoComo).toBe(false);
    expect(ini.clubes).toHaveLength(5);
    expect(ini.usuario?.club).toBe('Emprendedores');
  });

  it('puede ver la app como un FR: su club y sus seguimientos, y lo que guarda queda marcado', () => {
    const { api, crm } = armar('admin@itba.edu.ar');
    const ini = api.verComo('juana@itba.edu.ar');
    expect(ini.viendoComo).toBe(true);
    expect(ini.mail).toBe('admin@itba.edu.ar');
    expect(ini.usuario).toMatchObject({ nombre: 'Juana Pérez', club: 'Agro', admin: false, verComoPor: 'admin@itba.edu.ar' });
    expect(ini.clubes).toEqual(['Agro']);
    expect(api.listarSeguimientos().map((s) => s.empresa)).toContain('AgroTech SA');
    expect(() => api.buscarEmpresas('Emprendedores', 'a')).toThrow(/No podés operar/);

    const spy = jest.spyOn(crm, 'aplicarPostReunion');
    const r = api.procesarNotas({ club: 'Agro', empresa: 'AgroTech SA', fechaReunion: '2026-11-18', notas: NOTAS });
    api.confirmarPostReunion({ club: 'Agro', empresa: 'AgroTech SA', fechaReunion: '2026-11-18', datos: r.extraccion, adjuntosExtra: [] });
    expect(spy.mock.calls[0][1]).toMatchObject({ nombre: 'Juana Pérez', verComoPor: 'admin@itba.edu.ar' });
  });

  it('"volver" restaura su usuario', () => {
    const { api } = armar('admin@itba.edu.ar');
    api.verComo('juana@itba.edu.ar');
    const ini = api.verComo(null);
    expect(ini.viendoComo).toBe(false);
    expect(ini.usuario?.nombre).toBe('Josefina Ravera');
  });

  it('no se puede ver como alguien que no está en _Usuarios', () => {
    expect(() => armar('admin@itba.edu.ar').api.verComo('nadie@itba.edu.ar')).toThrow(/no está en _Usuarios/);
  });

  it('un usuario no admin no puede usar "ver como" ni listar usuarios', () => {
    const { api } = armar();
    expect(() => api.verComo('codi@itba.edu.ar')).toThrow(/Solo un admin/);
    expect(() => api.listarUsuarios()).toThrow(/Solo un admin/);
  });

  it('si a un no admin le quedó un "ver como" guardado, se ignora', () => {
    const verComo = fakeVerComo();
    verComo.guardar('codi@itba.edu.ar');
    const ini = armar('juana@itba.edu.ar', { verComo }).api.inicio();
    expect(ini.usuario?.nombre).toBe('Juana Pérez');
    expect(ini.clubes).toEqual(['Agro']);
  });
});

describe('Vista "Equipo" (solo lectura)', () => {
  it('un FR ve todas las empresas de su club, incluidas las de sus compañeros y las finales', () => {
    const lista = armar().api.listarEquipo('Agro');
    expect(lista.map((f) => f.empresa)).toEqual(['AgroTech SA', 'Campo Verde', 'Granos Unidos', 'Sin Fecha SRL', 'De Pedro']);
    expect(lista.find((f) => f.empresa === 'De Pedro')?.trameroEncargado).toBe('Pedro');
    expect(JSON.parse(JSON.stringify(lista))).toEqual(lista);
  });

  it('no puede ver otro club; la codirectora sí', () => {
    expect(() => armar().api.listarEquipo('Consultoría')).toThrow(/No podés operar/);
    expect(armar('codi@itba.edu.ar').api.listarEquipo('Agro')).toHaveLength(5);
  });

  it('un FR no puede pinguear una empresa de un compañero; la codirectora sí', () => {
    const fr = armar().api;
    expect(() => fr.registrarPingueo('Agro', 'De Pedro')).toThrow(/la sigue Pedro/);
    expect(() => armar('codi@itba.edu.ar').api.registrarPingueo('Agro', 'De Pedro')).not.toThrow(/la sigue/);
  });
});
