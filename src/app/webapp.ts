// Dueño: Persona A (sección 5, A1, A2, A5, A7). doGet y funciones expuestas a google.script.run.
//
// google.script.run no puede pasar objetos Date, así que entre el navegador y el servidor las fechas
// viajan como texto yyyy-mm-dd.

import { crearConfigService } from '../crm/config';
import { crearCrmService } from '../crm/repo';
import { crearExtraccionService } from '../extraccion/gemini';
import { diaISO, esFechaISO, ESTADO_POR_DEFECTO, ESTADOS_POST_REUNION, fechaDeDia, validarConfirmacion } from '../extraccion/validacion';
import { crearMailService } from '../mail/borrador';
import { CLUBES, ESTADOS, ESTADOS_FINALES, ESTADOS_PINGUEO_POST_REUNION } from '../shared/constants';
import { now } from '../shared/clock';
import { extraerMails } from '../shared/mails';
import { mismoNombre } from '../shared/nombres';
import type {
  Club,
  ConfigService,
  CrmService,
  Estado,
  Extraccion,
  ExtraccionService,
  FilaCRM,
  MailService,
  PostReunionConfirmado,
  Usuario,
} from '../shared/types';
import { instalarTriggersUsuario } from '../sync/triggersUsuario';
import { conMensajeClaro, ErrorParaUsuario, registrarYTraducir } from './mensajes';
import { confirmarPostReunion, reintentarBorrador, type ResultadoPostReunion } from './postReunion';

export const MIN_CARACTERES_NOTAS = 100;

// ---------- Datos que viajan al navegador ----------

export interface Inicio {
  usuario: Usuario | null; // null → no registrado. En "ver como", el usuario elegido.
  mail: string; // siempre el de la cuenta real
  clubes: Club[];
  hoy: string;
  avisoTriggers: string | null;
  esAdmin: boolean; // la cuenta real es admin (muestra el selector de "ver como")
  viendoComo: boolean; // `usuario` es otra persona elegida por el admin
}

export interface UsuarioListado {
  mail: string;
  nombre: string;
  club: Club | null;
  rol: Usuario['rol'];
}

export interface InfoEmpresa {
  existe: boolean;
  estadoActual: Estado | null;
  comentarios: string | null;
  estadosValidos: Estado[];
}

export interface SolicitudProcesar {
  club: Club;
  empresa: string;
  fechaReunion: string; // yyyy-mm-dd
  notas: string;
}

export interface ResultadoProcesar {
  extraccion: Extraccion;
  error: string | null; // si la extracción falló dos veces: el FR completa a mano
  empresa: InfoEmpresa;
  estados: Estado[]; // opciones del desplegable de estado del paso 2
}

export interface PostReunionEnviado {
  club: Club;
  empresa: string;
  fechaReunion: string; // yyyy-mm-dd
  datos: Extraccion;
  adjuntosExtra: string[];
}

export interface Seguimiento {
  club: Club;
  empresa: string;
  estado: Estado | null;
  proximaAccion: string | null;
  fechaProximaAccion: string | null; // yyyy-mm-dd
  pingueosSinRespuesta: number;
  vencida: boolean;
  estadosValidos: Estado[];
}

// Vista "Equipo": todas las empresas de un club, solo lectura.
export interface FilaEquipo {
  club: Club;
  empresa: string;
  trameroEncargado: string;
  persona: string | null;
  mail: string | null;
  estado: Estado | null;
  proximaAccion: string | null;
  fechaProximaAccion: string | null; // yyyy-mm-dd
  fechaUltimoContacto: string | null; // yyyy-mm-dd
  pingueosSinRespuesta: number;
  vencida: boolean;
}

export interface ResultadoPingueo {
  seguimiento: Seguimiento;
  borradorUrl: string;
}

// ---------- Lógica (testeable con los fakes) ----------

export interface DependenciasWebapp {
  mailActual: () => string;
  config: ConfigService;
  crm: CrmService;
  mail: MailService;
  extraccion: ExtraccionService;
  archivosDeCarpeta: (carpetaId: string) => { id: string; nombre: string }[];
  triggers: { yaInstalados: () => boolean; instalar: () => void; marcarInstalados: () => void };
  ahora: () => Date;
  // "Ver como" del admin: mail del usuario elegido, guardado por cuenta (UserProperties).
  verComo?: { leer: () => string | null; guardar: (mail: string | null) => void };
}

function esFinal(estado: Estado | undefined): boolean {
  return estado !== undefined && ESTADOS_FINALES.includes(estado);
}

// A7: qué template de pingueo corresponde según el estado (ver shared/constants.ts).
function tipoPingueoDe(estado: Estado | undefined): 'PRIMER_CONTACTO' | 'POST_REUNION' {
  return estado && ESTADOS_PINGUEO_POST_REUNION.includes(estado) ? 'POST_REUNION' : 'PRIMER_CONTACTO';
}

export function aSeguimiento(f: FilaCRM, hoy: string, crm: CrmService): Seguimiento {
  const fecha = f.fechaProximaAccion ? diaISO(f.fechaProximaAccion) : null;
  return {
    club: f.club,
    empresa: f.empresa,
    estado: f.estado ?? null,
    proximaAccion: f.proximaAccion ?? null,
    fechaProximaAccion: fecha,
    pingueosSinRespuesta: f.pingueosSinRespuesta,
    vencida: fecha !== null && fecha < hoy,
    estadosValidos: ESTADOS.filter((e) => crm.transicionValida(f.estado, e)),
  };
}

export function aFilaEquipo(f: FilaCRM, hoy: string): FilaEquipo {
  const fecha = f.fechaProximaAccion ? diaISO(f.fechaProximaAccion) : null;
  return {
    club: f.club,
    empresa: f.empresa,
    trameroEncargado: f.trameroEncargado,
    persona: f.persona ?? null,
    mail: f.mail ?? null,
    estado: f.estado ?? null,
    proximaAccion: f.proximaAccion ?? null,
    fechaProximaAccion: fecha,
    fechaUltimoContacto: f.fechaUltimoContacto ? diaISO(f.fechaUltimoContacto) : null,
    pingueosSinRespuesta: f.pingueosSinRespuesta,
    vencida: fecha !== null && fecha < hoy && !esFinal(f.estado),
  };
}

// Empresas del FR con estado no final, por fecha de próxima acción (vencidas primero; sin fecha al final).
export function armarSeguimientos(filas: FilaCRM[], fr: Usuario, hoy: string, crm: CrmService): Seguimiento[] {
  return filas
    .filter((f) => mismoNombre(f.trameroEncargado, fr.nombre) && !esFinal(f.estado))
    .map((f) => aSeguimiento(f, hoy, crm))
    .sort((a, b) => {
      if (a.fechaProximaAccion === b.fechaProximaAccion) return 0;
      if (a.fechaProximaAccion === null) return 1;
      if (b.fechaProximaAccion === null) return -1;
      return a.fechaProximaAccion < b.fechaProximaAccion ? -1 : 1;
    });
}

export function crearEndpoints(deps: DependenciasWebapp) {
  const { crm, mail } = deps;

  function usuarioReal(): Usuario {
    const u = deps.config.getUsuario(deps.mailActual());
    if (!u) throw new ErrorParaUsuario('No tenés acceso, pedíselo a tu coordinador.');
    return u;
  }

  // Si quien llama es admin y eligió "ver como", devuelve a la persona elegida (marcada con
  // verComoPor = mail del admin). En cualquier otro caso, la cuenta real. Todos los endpoints
  // pasan por acá, así que "ver como" aplica a todo sin tocarlos uno por uno.
  function usuario(): Usuario {
    const real = usuarioReal();
    if (!real.admin || !deps.verComo) return real;
    const mailElegido = deps.verComo.leer();
    if (!mailElegido || mailElegido === real.mail) return real;
    const elegido = deps.config.getUsuario(mailElegido);
    if (!elegido) {
      deps.verComo.guardar(null); // lo sacaron de _Usuarios: vuelve a su propio usuario
      return real;
    }
    return { ...elegido, admin: false, verComoPor: real.mail };
  }

  function requerirAdmin(): Usuario {
    const real = usuarioReal();
    if (!real.admin) throw new ErrorParaUsuario('Solo un admin puede hacer esto.');
    return real;
  }

  // Codirectoras y admin pueden actuar sobre cualquier empresa; FR y coordinadores, solo sobre las
  // que tienen su nombre en "Tramero encargado" (las de sus compañeros solo las ven, en "Equipo").
  function puedeActuarSobre(u: Usuario, fila: FilaCRM): boolean {
    return u.rol === 'Codirectora' || Boolean(u.admin) || mismoNombre(fila.trameroEncargado, u.nombre);
  }

  // El club viene precargado con el del FR; solo las codirectoras y los admin pueden elegir otro (A2).
  function clubesDe(u: Usuario): Club[] {
    if (u.rol === 'Codirectora' || u.admin) return [...CLUBES];
    return u.club ? [u.club] : [];
  }

  function usuarioDelClub(club: Club): Usuario {
    const u = usuario();
    if (!clubesDe(u).includes(club)) throw new ErrorParaUsuario(`No podés operar sobre el club ${club}.`);
    return u;
  }

  function info(fila: FilaCRM | null): InfoEmpresa {
    return {
      existe: fila !== null,
      estadoActual: fila?.estado ?? null,
      comentarios: fila?.comentarios ?? null,
      estadosValidos: ESTADOS.filter((e) => crm.transicionValida(fila?.estado, e)),
    };
  }

  function aConfirmado(p: PostReunionEnviado): PostReunionConfirmado {
    return { club: p.club, empresa: p.empresa.trim(), fechaReunion: fechaDeDia(p.fechaReunion), datos: p.datos, adjuntosExtra: p.adjuntosExtra };
  }

  function hoy(): string {
    return diaISO(deps.ahora());
  }

  // A1: identifica al usuario y, al primer ingreso, instala sus triggers personales (B7).
  // Los triggers son siempre de la cuenta real, aunque el admin esté en "ver como".
  function inicio(): Inicio {
    const mailActual = deps.mailActual();
    const real = deps.config.getUsuario(mailActual);
    let avisoTriggers: string | null = null;
    if (real && !deps.triggers.yaInstalados()) {
      try {
        deps.triggers.instalar();
        deps.triggers.marcarInstalados();
      } catch (e) {
        avisoTriggers = `No se pudieron instalar tus sincronizaciones automáticas: ${(e as Error).message}`;
      }
    }
    const u = real ? usuario() : null;
    return {
      usuario: u,
      mail: mailActual,
      clubes: u ? clubesDe(u) : [],
      hoy: hoy(),
      avisoTriggers,
      esAdmin: Boolean(real?.admin),
      viendoComo: Boolean(u?.verComoPor),
    };
  }

  return {
    inicio,

    // Admin: lista de usuarios para el selector de "ver como".
    listarUsuarios(): UsuarioListado[] {
      requerirAdmin();
      return deps.config
        .getUsuarios()
        .map((u) => ({ mail: u.mail, nombre: u.nombre, club: u.club, rol: u.rol }))
        .sort((a, b) => (a.club ?? '').localeCompare(b.club ?? '') || a.nombre.localeCompare(b.nombre));
    },

    // Admin: empieza a ver la app como `mail`, o vuelve a su usuario con null.
    verComo(mail: string | null): Inicio {
      const real = requerirAdmin();
      if (!deps.verComo) throw new ErrorParaUsuario('"Ver como" no está disponible.');
      const elegido = mail ? mail.trim().toLowerCase() : null;
      if (elegido && !deps.config.getUsuario(elegido)) throw new ErrorParaUsuario(`${elegido} no está en _Usuarios.`);
      deps.verComo.guardar(elegido && elegido !== real.mail ? elegido : null);
      return inicio();
    },

    // A2
    buscarEmpresas(club: Club, texto: string): string[] {
      usuarioDelClub(club);
      return texto.trim() ? crm.buscarEmpresas(club, texto.trim()) : [];
    },

    infoEmpresa(club: Club, empresa: string): InfoEmpresa {
      usuarioDelClub(club);
      return info(crm.getFila(club, empresa.trim()));
    },

    // A3–A4
    procesarNotas(s: SolicitudProcesar): ResultadoProcesar {
      usuarioDelClub(s.club);
      const empresa = s.empresa.trim();
      if (!empresa) throw new ErrorParaUsuario('Falta la empresa.');
      if (s.notas.trim().length < MIN_CARACTERES_NOTAS) throw new ErrorParaUsuario(`Las notas tienen que tener al menos ${MIN_CARACTERES_NOTAS} caracteres.`);
      if (!esFechaISO(s.fechaReunion)) throw new ErrorParaUsuario('La fecha de la reunión no es válida.');

      const fila = crm.getFila(s.club, empresa);
      const ctx = { club: s.club, empresa, filaExistente: fila, fechaReunion: fechaDeDia(s.fechaReunion) };
      try {
        return { extraccion: deps.extraccion.extraer(s.notas, ctx), error: null, empresa: info(fila), estados: ESTADOS_POST_REUNION };
      } catch (e) {
        // Sin extracción automática: formulario con lo que ya había en el CRM, para completar a mano.
        const vacia: Extraccion = {
          persona: fila?.persona ?? null,
          rolPersona: fila?.rolPersona ?? null,
          mail: fila?.mail ?? null,
          telefono: fila?.telefono ?? null,
          linkedin: fila?.linkedin ?? null,
          compromisosEmpresa: [],
          compromisosTrama: [],
          parrafoCompromisos: null,
          estadoSugerido: ESTADO_POR_DEFECTO,
          comentarios: '',
          proximaAccion: null,
          fechaProximaAccion: null,
          camposFaltantes: ['estadoSugerido'],
        };
        return { extraccion: vacia, error: registrarYTraducir(e, 'procesarNotas'), empresa: info(fila), estados: ESTADOS_POST_REUNION };
      }
    },

    // A5
    previsualizarMail(p: PostReunionEnviado): string {
      const u = usuarioDelClub(p.club);
      return mail.previsualizar(aConfirmado(p), u);
    },

    // Archivos de la carpeta de adjuntos del club (ConfigService.getClub), para los adjuntos extra.
    listarAdjuntos(club: Club): { id: string; nombre: string }[] {
      usuarioDelClub(club);
      return deps.archivosDeCarpeta(deps.config.getClub(club).carpetaAdjuntosId);
    },

    // A5–A6: no se puede confirmar con un estado inválido ni sin mail del contacto.
    confirmarPostReunion(p: PostReunionEnviado): ResultadoPostReunion {
      const u = usuarioDelClub(p.club);
      const confirmado = aConfirmado(p);
      const actual = crm.getFila(confirmado.club, confirmado.empresa);
      const errores = validarConfirmacion(confirmado.datos, actual?.estado, confirmado.fechaReunion, (d, h) => crm.transicionValida(d, h));
      if (errores.length) return { ok: false, mensaje: errores.join(' ') };
      return confirmarPostReunion(confirmado, u, crm, mail);
    },

    reintentarBorrador(p: PostReunionEnviado): ResultadoPostReunion {
      const u = usuarioDelClub(p.club);
      return reintentarBorrador(aConfirmado(p), u, mail);
    },

    // Vista "Equipo": todas las empresas del club (las de todos), solo lectura. Cada uno ve su club;
    // codirectoras y admin, cualquiera.
    listarEquipo(club: Club): FilaEquipo[] {
      usuarioDelClub(club);
      const h = hoy();
      return crm
        .listarFilas(club)
        .map((f) => aFilaEquipo(f, h))
        .sort((a, b) => a.trameroEncargado.localeCompare(b.trameroEncargado) || a.empresa.localeCompare(b.empresa));
    },

    // A7
    listarSeguimientos(): Seguimiento[] {
      const u = usuario();
      if (!u.club) return [];
      return armarSeguimientos(crm.listarFilas(u.club), u, hoy(), crm);
    },

    // A7: único botón de "Mis seguimientos". Genera el borrador de pingueo (con el template que
    // corresponda según el estado). El pingueo NO se cuenta acá: lo cuenta el sync de Gmail cuando
    // el borrador se manda (suma uno al contador y actualiza la fecha de último contacto).
    registrarPingueo(club: Club, empresa: string): ResultadoPingueo {
      const u = usuarioDelClub(club);
      const fila = crm.getFila(club, empresa.trim());
      if (!fila) throw new ErrorParaUsuario(`"${empresa}" no está en el CRM.`);
      if (!puedeActuarSobre(u, fila)) {
        throw new ErrorParaUsuario(`${fila.empresa} la sigue ${fila.trameroEncargado || 'otra persona'}: solo esa persona puede pinguearla.`);
      }
      if (!extraerMails(fila.mail).length) throw new ErrorParaUsuario(`No se puede pinguear a ${empresa}: falta el mail de contacto.`);

      if (esFinal(fila.estado)) throw new ErrorParaUsuario(`${empresa} ya está en un estado final (${fila.estado}).`);
      const borrador = mail.crearBorradorPingueo(
        { club, empresa: fila.empresa, persona: fila.persona ?? null, mail: fila.mail ?? '', tipo: tipoPingueoDe(fila.estado) },
        u,
      );
      return { seguimiento: aSeguimiento(fila, hoy(), crm), borradorUrl: borrador.url };
    },
  };
}

// ---------- Conexión con Apps Script ----------

const PROPIEDAD_TRIGGERS = 'TRIGGERS_INSTALADOS';
const PROPIEDAD_VER_COMO = 'VER_COMO';

let endpoints: ReturnType<typeof crearEndpoints> | null = null;
function api(): ReturnType<typeof crearEndpoints> {
  if (endpoints) return endpoints;
  const crm = crearCrmService();
  const config = crearConfigService();
  endpoints = crearEndpoints({
    mailActual: () => Session.getActiveUser().getEmail(),
    config,
    crm,
    mail: crearMailService(config),
    extraccion: crearExtraccionService((d, h) => crm.transicionValida(d, h)),
    archivosDeCarpeta: (carpetaId) => {
      const archivos: { id: string; nombre: string }[] = [];
      const it = DriveApp.getFolderById(carpetaId).getFiles();
      while (it.hasNext()) {
        const a = it.next();
        archivos.push({ id: a.getId(), nombre: a.getName() });
      }
      return archivos;
    },
    triggers: {
      yaInstalados: () => PropertiesService.getUserProperties().getProperty(PROPIEDAD_TRIGGERS) === '1',
      instalar: instalarTriggersUsuario,
      marcarInstalados: () => PropertiesService.getUserProperties().setProperty(PROPIEDAD_TRIGGERS, '1'),
    },
    ahora: now,
    verComo: {
      leer: () => PropertiesService.getUserProperties().getProperty(PROPIEDAD_VER_COMO),
      guardar: (mail) => {
        const props = PropertiesService.getUserProperties();
        if (mail) props.setProperty(PROPIEDAD_VER_COMO, mail);
        else props.deleteProperty(PROPIEDAD_VER_COMO);
      },
    },
  });
  return endpoints;
}

export function doGet(_e: GoogleAppsScript.Events.DoGet): GoogleAppsScript.HTML.HtmlOutput {
  return HtmlService.createTemplateFromFile('index').evaluate().setTitle('Trama FR Assistant');
}

export function include(nombreArchivo: string): string {
  return HtmlService.createHtmlOutputFromFile(nombreArchivo).getContent();
}

// Todo lo que llama el navegador pasa por conMensajeClaro: si algo falla, el FR ve un mensaje claro
// y el detalle técnico queda en el log de Apps Script (Ejecuciones).
export const inicio = conMensajeClaro('inicio', () => api().inicio());
export const buscarEmpresas = conMensajeClaro('buscarEmpresas', (club: Club, texto: string) => api().buscarEmpresas(club, texto));
export const infoEmpresa = conMensajeClaro('infoEmpresa', (club: Club, empresa: string) => api().infoEmpresa(club, empresa));
export const procesarNotas = conMensajeClaro('procesarNotas', (s: SolicitudProcesar) => api().procesarNotas(s));
export const previsualizarMail = conMensajeClaro('previsualizarMail', (p: PostReunionEnviado) => api().previsualizarMail(p));
export const listarAdjuntos = conMensajeClaro('listarAdjuntos', (club: Club) => api().listarAdjuntos(club));
export const confirmarPostReunionUI = conMensajeClaro('confirmarPostReunion', (p: PostReunionEnviado) => api().confirmarPostReunion(p));
export const reintentarBorradorUI = conMensajeClaro('reintentarBorrador', (p: PostReunionEnviado) => api().reintentarBorrador(p));
export const listarSeguimientos = conMensajeClaro('listarSeguimientos', () => api().listarSeguimientos());
export const listarEquipo = conMensajeClaro('listarEquipo', (club: Club) => api().listarEquipo(club));
export const listarUsuarios = conMensajeClaro('listarUsuarios', () => api().listarUsuarios());
export const verComo = conMensajeClaro('verComo', (mail: string | null) => api().verComo(mail));
export const registrarPingueo = conMensajeClaro('registrarPingueo', (club: Club, empresa: string) => api().registrarPingueo(club, empresa));
