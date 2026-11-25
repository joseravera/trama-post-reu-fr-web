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
  usuario: Usuario | null; // null → no registrado
  mail: string;
  clubes: Club[];
  hoy: string;
  avisoTriggers: string | null;
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

// Empresas del FR con estado no final, por fecha de próxima acción (vencidas primero; sin fecha al final).
export function armarSeguimientos(filas: FilaCRM[], fr: Usuario, hoy: string, crm: CrmService): Seguimiento[] {
  const nombre = fr.nombre.trim().toLowerCase();
  return filas
    .filter((f) => (f.trameroEncargado ?? '').trim().toLowerCase() === nombre && !esFinal(f.estado))
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

  function usuario(): Usuario {
    const u = deps.config.getUsuario(deps.mailActual());
    if (!u) throw new ErrorParaUsuario('No tenés acceso, pedíselo a tu coordinador.');
    return u;
  }

  // El club viene precargado con el del FR; solo las codirectoras pueden elegir otro (A2).
  function clubesDe(u: Usuario): Club[] {
    if (u.rol === 'Codirectora') return [...CLUBES];
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

  return {
    // A1: identifica al usuario y, al primer ingreso, instala sus triggers personales (B7).
    inicio(): Inicio {
      const mailActual = deps.mailActual();
      const u = deps.config.getUsuario(mailActual);
      let avisoTriggers: string | null = null;
      if (u && !deps.triggers.yaInstalados()) {
        try {
          deps.triggers.instalar();
          deps.triggers.marcarInstalados();
        } catch (e) {
          avisoTriggers = `No se pudieron instalar tus sincronizaciones automáticas: ${(e as Error).message}`;
        }
      }
      return { usuario: u, mail: mailActual, clubes: u ? clubesDe(u) : [], hoy: hoy(), avisoTriggers };
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

    // A7
    listarSeguimientos(): Seguimiento[] {
      const u = usuario();
      if (!u.club) return [];
      return armarSeguimientos(crm.listarFilas(u.club), u, hoy(), crm);
    },

    // A7: único botón de "Mis seguimientos". Genera el borrador de pingueo (con el template que
    // corresponda según el estado) y, solo si eso sale bien, registra el pingueo en el CRM
    // (incrementa el contador y actualiza la fecha de último contacto).
    registrarPingueo(club: Club, empresa: string): ResultadoPingueo {
      const u = usuarioDelClub(club);
      const fila = crm.getFila(club, empresa.trim());
      if (!fila) throw new ErrorParaUsuario(`"${empresa}" no está en el CRM.`);
      if (!fila.mail) throw new ErrorParaUsuario(`No se puede pinguear a ${empresa}: falta el mail de contacto.`);

      const borrador = mail.crearBorradorPingueo(
        { club, empresa: fila.empresa, persona: fila.persona ?? null, mail: fila.mail, tipo: tipoPingueoDe(fila.estado) },
        u,
      );
      const actualizado = crm.registrarPingueo(club, empresa, u);
      return { seguimiento: aSeguimiento(actualizado, hoy(), crm), borradorUrl: borrador.url };
    },
  };
}

// ---------- Conexión con Apps Script ----------

const PROPIEDAD_TRIGGERS = 'TRIGGERS_INSTALADOS';

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
export const registrarPingueo = conMensajeClaro('registrarPingueo', (club: Club, empresa: string) => api().registrarPingueo(club, empresa));
