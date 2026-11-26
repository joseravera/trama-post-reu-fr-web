// Dueño: Persona C (sección 7, C5). Motor de reglas puro: filas + fecha actual + parámetros -> Aviso[].
// Testeado sin Apps Script. Solo decide QUÉ avisar; cuándo y cómo se agrupa lo decide notificadorMail.ts.
//
// Nota sobre destinatarios: FilaCRM solo tiene el *nombre* del tramero encargado, no su mail
// (eso vive en _Usuarios, vía ConfigService, al que estas funciones no acceden a propósito
// para quedar puras y testeables con filas en memoria). Por eso Aviso.destinatarios acá
// contiene el nombre del FR como identificador provisorio; resolverDestinatarios() —más abajo—
// lo reemplaza por el mail real antes de llamar a notificadorMail.enviar (lo hace el
// orquestador en scheduler.ts, que sí tiene ConfigService).

import { diferenciaDiasEnZona } from '../mail/fechas';
import type { Aviso, Club, Estado, FilaCRM, Usuario } from '../shared/types';
import { mismoNombre } from '../shared/nombres';
import { proximoDiaSemana, proximoEnvio } from './calendarioEnvios';

export interface ParametrosReglas {
  diasPingueoMail: number;
  diasCoordinar: number;
  horasCargaPost: number;
  diasSeguimiento: number;
  diasTratativasEscala: number;
  pingueosEscala: number;
  diasVencidoEscala: number;
  // Día de la semana del mail a los FR (0 = domingo). Si está, la ventana de "lo que vence
  // antes del próximo mail" llega hasta ese día de la semana siguiente; si no, hasta el próximo
  // día de envío (lun/mié/vie).
  diaEnvioFr?: number;
}

function finDeVentana(ahora: Date, parametros: ParametrosReglas): Date {
  return parametros.diaEnvioFr === undefined ? proximoEnvio(ahora) : proximoDiaSemana(ahora, parametros.diaEnvioFr);
}

function clave(tipo: Aviso['tipo'], fila: FilaCRM, fecha: Date): string {
  return `${tipo}|${fila.club}|${fila.empresa}|${fecha.toISOString().slice(0, 10)}`;
}

function avisoParaFr(tipo: Aviso['tipo'], fila: FilaCRM, fecha: Date, texto: string): Aviso {
  return { clave: clave(tipo, fila, fecha), tipo, destinatarios: [fila.trameroEncargado], club: fila.club, empresa: fila.empresa, texto };
}

const ESTADOS_DE_SEGUIMIENTO: Estado[] = ['Tuvimos reunión, esperando respuesta', 'Tratativas'];

function evaluarCargarPostReunion(fila: FilaCRM, ahora: Date, parametros: ParametrosReglas): Aviso | null {
  if (fila.estado !== 'Reunión coordinada') return null;
  const fechaReunion = fila.fechaProximaAccion ?? fila.fechaUltimoContacto;
  if (!fechaReunion) return null;
  const horas = (ahora.getTime() - fechaReunion.getTime()) / 3_600_000;
  if (horas < parametros.horasCargaPost) return null;
  return avisoParaFr(
    'CARGAR_POST_REUNION',
    fila,
    fechaReunion,
    `Cargá el post-reunión de ${fila.empresa}: tuvieron la reunión hace más de ${Math.floor(horas)}hs y todavía no está registrada.`,
  );
}

function evaluarPinguear(fila: FilaCRM, ahora: Date, parametros: ParametrosReglas): Aviso | null {
  // Las filas de traspaso solo tienen "Fecha primer contacto": se usa esa si no hay último contacto.
  const ultimoContacto = fila.fechaUltimoContacto ?? fila.fechaPrimerContacto;
  if (!ultimoContacto) return null;
  const dias = diferenciaDiasEnZona(ultimoContacto, ahora);
  if (fila.estado === 'FR viejo mando el mail de traspaso' && dias >= parametros.diasPingueoMail) {
    return avisoParaFr(
      'PINGUEAR',
      fila,
      ahora,
      `Pingueá a ${fila.empresa}: el FR anterior mandó el mail de traspaso hace ${dias} días y no respondieron.`,
    );
  }
  if (fila.estado === 'Mail enviado' && dias >= parametros.diasPingueoMail) {
    return avisoParaFr(
      'PINGUEAR',
      fila,
      ahora,
      `Pingueá a ${fila.empresa}: mandaste el mail hace ${dias} días y no respondieron.`,
    );
  }
  return null;
}

// "Tuvimos reunión..." o "Tratativas" con fecha de próxima acción vencida o próxima a vencer
// (hasta el próximo día de envío, ver C4), o sin próxima acción pero con DIAS_SEGUIMIENTO sin
// contacto.
function evaluarSeguimientoVencido(fila: FilaCRM, ahora: Date, parametros: ParametrosReglas): Aviso | null {
  if (!fila.estado || !ESTADOS_DE_SEGUIMIENTO.includes(fila.estado)) return null;

  const finVentana = finDeVentana(ahora, parametros);

  if (fila.fechaProximaAccion) {
    if (fila.fechaProximaAccion.getTime() > finVentana.getTime()) return null;
    const dias = diferenciaDiasEnZona(fila.fechaProximaAccion, ahora); // >0 vencido, 0 hoy, <0 próximo
    const accion = fila.proximaAccion ?? 'seguimiento';
    let texto: string;
    if (dias > 0) texto = `Seguí a ${fila.empresa}: "${accion}" venció hace ${dias} días.`;
    else if (dias === 0) texto = `Seguí a ${fila.empresa}: "${accion}" vence hoy.`;
    else texto = `Seguí a ${fila.empresa}: "${accion}" vence en ${-dias} día(s).`;
    return avisoParaFr('SEGUIMIENTO_VENCIDO', fila, fila.fechaProximaAccion, texto);
  }

  if (!fila.fechaUltimoContacto) return null;
  const diasSinContacto = diferenciaDiasEnZona(fila.fechaUltimoContacto, ahora);
  if (diasSinContacto < parametros.diasSeguimiento) return null;
  return avisoParaFr(
    'SEGUIMIENTO_VENCIDO',
    fila,
    ahora,
    `Seguí a ${fila.empresa}: no tiene próxima acción cargada y pasaron ${diasSinContacto} días sin contacto.`,
  );
}

// La empresa respondió ("Mail respondido" o "Respondió traspaso") y pasaron DIAS_COORDINAR días
// sin contacto (ni de ellos ni nuestro): hay que seguirla para coordinar la reunión. Es un
// seguimiento, no un pingueo (la empresa sí respondió).
function evaluarSeguimientoSinContacto(fila: FilaCRM, ahora: Date, parametros: ParametrosReglas): Aviso | null {
  if (fila.estado !== 'Mail respondido' && fila.estado !== 'Respondió traspaso') return null;
  const ultimoContacto = fila.fechaUltimoContacto ?? fila.fechaPrimerContacto;
  if (!ultimoContacto) return null;
  const dias = diferenciaDiasEnZona(ultimoContacto, ahora);
  if (dias < parametros.diasCoordinar) return null;
  const que = fila.estado === 'Respondió traspaso' ? 'respondieron el traspaso' : 'respondieron';
  return avisoParaFr(
    'SEGUIMIENTO_VENCIDO',
    fila,
    ahora,
    `Seguí a ${fila.empresa}: ${que} y pasaron ${dias} días sin contacto.`,
  );
}

// FilaCRM no distingue si la "próxima acción" es un compromiso de Trama o una tarea genérica
// del FR (A6: los compromisos de Trama se cargan ahí mismo). Para no duplicar el aviso de
// SEGUIMIENTO_VENCIDO, esta regla solo mira los estados que esa otra regla no cubre.
// Con mail semanal (diaEnvioFr), avisa todo lo que vence desde hoy hasta el próximo mail; si
// no, solo lo que vence mañana.
function evaluarCompromisoTrama(fila: FilaCRM, ahora: Date, parametros: ParametrosReglas): Aviso | null {
  if (!fila.estado || ESTADOS_DE_SEGUIMIENTO.includes(fila.estado)) return null;
  if (!fila.fechaProximaAccion) return null;
  const dias = diferenciaDiasEnZona(ahora, fila.fechaProximaAccion); // días que faltan
  if (parametros.diaEnvioFr === undefined) {
    if (dias !== 1) return null;
  } else if (dias < 0 || fila.fechaProximaAccion.getTime() > finDeVentana(ahora, parametros).getTime()) {
    return null;
  }
  const cuando = dias === 0 ? 'Hoy vence' : dias === 1 ? 'Mañana vence' : `En ${dias} días vence`;
  return avisoParaFr(
    'COMPROMISO_TRAMA',
    fila,
    fila.fechaProximaAccion,
    `${cuando} "${fila.proximaAccion ?? 'un compromiso'}" con ${fila.empresa}.`,
  );
}

export function evaluarReglas(filas: FilaCRM[], ahora: Date, parametros: ParametrosReglas): Aviso[] {
  const avisos: Aviso[] = [];
  for (const fila of filas) {
    for (const aviso of [
      evaluarCargarPostReunion(fila, ahora, parametros),
      evaluarPinguear(fila, ahora, parametros),
      evaluarSeguimientoVencido(fila, ahora, parametros),
      evaluarSeguimientoSinContacto(fila, ahora, parametros),
      evaluarCompromisoTrama(fila, ahora, parametros),
    ]) {
      if (aviso) avisos.push(aviso);
    }
  }
  return avisos;
}

// Exportados para que notificadorMail.ts sepa agrupar por FR o por club sin repetir la lista.
export const TIPOS_PARA_FR: Aviso['tipo'][] = ['CARGAR_POST_REUNION', 'PINGUEAR', 'SEGUIMIENTO_VENCIDO', 'COMPROMISO_TRAMA'];
export const TIPOS_PARA_CLUB: Aviso['tipo'][] = ['ESCALAMIENTO', 'RESUMEN_COORDINADOR'];

function mailDeFr(nombre: string, club: Club | undefined, usuarios: Usuario[]): string | null {
  const candidato =
    usuarios.find((u) => u.rol === 'FR' && u.club === club && mismoNombre(u.nombre, nombre)) ??
    usuarios.find((u) => u.club === club && mismoNombre(u.nombre, nombre)) ??
    usuarios.find((u) => mismoNombre(u.nombre, nombre));
  return candidato?.mail ?? null;
}

function mailesDeCoordinadores(club: Club, usuarios: Usuario[]): string[] {
  return usuarios.filter((u) => u.rol === 'Coordinador' && u.club === club).map((u) => u.mail);
}

// Reemplaza los nombres de FR puestos por evaluarReglas/evaluarEscalamientos por los mails
// reales (usando _Usuarios vía ConfigService) y, para los avisos de club, agrega los
// coordinadores. Avisos que no se puedan resolver (FR dado de baja, etc.) se descartan: mejor
// perder un aviso que mandarlo a un destinatario inválido.
export function resolverDestinatarios(avisos: Aviso[], usuarios: Usuario[]): Aviso[] {
  const resueltos: Aviso[] = [];
  for (const aviso of avisos) {
    if (TIPOS_PARA_CLUB.includes(aviso.tipo) && aviso.club) {
      const coordinadores = mailesDeCoordinadores(aviso.club, usuarios);
      const frEnCopia = aviso.destinatarios[0] ? mailDeFr(aviso.destinatarios[0], aviso.club, usuarios) : null;
      const destinatarios = [...coordinadores, ...(frEnCopia ? [frEnCopia] : [])];
      if (destinatarios.length === 0) continue;
      resueltos.push({ ...aviso, destinatarios });
      continue;
    }
    if (TIPOS_PARA_FR.includes(aviso.tipo)) {
      const nombre = aviso.destinatarios[0];
      const mail = nombre ? mailDeFr(nombre, aviso.club, usuarios) : null;
      if (!mail) continue;
      resueltos.push({ ...aviso, destinatarios: [mail] });
      continue;
    }
    resueltos.push(aviso); // RESUMEN_CODIS u otros ya armados con mails reales por el scheduler
  }
  return resueltos;
}
