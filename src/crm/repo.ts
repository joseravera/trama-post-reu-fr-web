// Dueño: Persona B (sección 6, B2). Lectura/escritura de las 5 hojas de club, columnas por
// nombre de encabezado (nunca por índice fijo), upsert en la primera fila vacía de la tabla,
// LockService para concurrencia, idempotencia por club+empresa+fechaReunion.

import { now } from '../shared/clock';
import { COLUMNAS_CRM } from '../shared/constants';
import type { Club, CrmService, Estado, FilaCRM, PostReunionConfirmado, Usuario } from '../shared/types';
// fechaDeDia es de A (extraccion/validacion.ts): arma el Date al mediodía hora Argentina para que
// un "yyyy-mm-dd" nunca cruce medianoche UTC y se corra de día (bug real que encontramos: un
// `new Date("2026-12-01")` a secas se guarda como 30/11 en la hoja). La reusamos en vez de
// duplicarla con otro criterio.
import { fechaDeDia } from '../extraccion/validacion';
import { agregarMails } from '../shared/mails';
import { abrirCrm } from './config';
import { getEventos, registrarEvento } from './historial';
import {
  esEstadoFinal,
  estadoAlEscribirEncargado,
  estadoAlMandarResumen,
  estadoAlResponder,
  transicionValida as transicionValidaMaquina,
} from './maquinaEstados';
import { buscarFilaPorClave, indiceColumna, indiceColumnaOpcional, primeraFilaVacia } from './sheetUtils';

// ---------- Lógica pura (testeada en repo.test.ts) ----------

export function normalizarNombreEmpresa(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita tildes
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function formatearFechaCorta(fecha: Date): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
  }).formatToParts(fecha);
  const dd = partes.find((p) => p.type === 'day')!.value;
  const mm = partes.find((p) => p.type === 'month')!.value;
  return `${dd}/${mm}`;
}

export function formatearLineaComentario(fechaReunion: Date, comentario: string): string {
  return `[${formatearFechaCorta(fechaReunion)}] ${comentario}`;
}

// Agrega `lineaNueva` al historial de comentarios sin duplicarla si ya está (idempotencia:
// confirmar la misma reunión dos veces no duplica la línea, sección 6 B2).
export function agregarComentario(comentariosExistentes: string | undefined, lineaNueva: string): string {
  const existentes = comentariosExistentes ?? '';
  const yaEsta = existentes.split('\n').some((linea) => linea.trim() === lineaNueva.trim());
  if (yaEsta) return existentes;
  return existentes ? `${existentes}\n${lineaNueva}` : lineaNueva;
}

// Columnas que pueden faltar en alguna hoja de club: se leen como vacías y no se escriben.
const COLUMNAS_OPCIONALES: readonly string[] = [COLUMNAS_CRM.PINGUEOS_SIN_RESPUESTA];

function indiceColumnaCrm(encabezados: readonly unknown[], nombre: string): number {
  return COLUMNAS_OPCIONALES.includes(nombre) ? indiceColumnaOpcional(encabezados, nombre) : indiceColumna(encabezados, nombre);
}

// Acepta Date, "dd/mm/yyyy" (como se tipea a mano en la hoja) o cualquier texto que entienda Date.
export function parsearFechaCelda(v: unknown): Date | undefined {
  if (v === '' || v === null || v === undefined) return undefined;
  if (v instanceof Date) return v;
  const texto = String(v).trim();
  const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto);
  if (ddmmyyyy) {
    const [, d, m, a] = ddmmyyyy;
    return new Date(`${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T12:00:00-03:00`);
  }
  const fecha = new Date(texto);
  return Number.isNaN(fecha.getTime()) ? undefined : fecha;
}

export function filaCRMDesdeValores(club: Club, encabezados: readonly unknown[], valores: readonly unknown[]): FilaCRM {
  const obtener = (nombre: string) => {
    const i = indiceColumnaCrm(encabezados, nombre);
    return i === -1 ? undefined : valores[i];
  };
  const comoTexto = (v: unknown): string | undefined =>
    v === '' || v === null || v === undefined ? undefined : String(v);
  const comoFecha = parsearFechaCelda;
  const comoNumero = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  return {
    club,
    empresa: String(obtener(COLUMNAS_CRM.EMPRESA) ?? ''),
    trameroEncargado: String(obtener(COLUMNAS_CRM.TRAMERO_ENCARGADO) ?? ''),
    persona: comoTexto(obtener(COLUMNAS_CRM.PERSONA)),
    rolPersona: comoTexto(obtener(COLUMNAS_CRM.ROL_PERSONA)),
    telefono: comoTexto(obtener(COLUMNAS_CRM.TELEFONO)),
    mail: comoTexto(obtener(COLUMNAS_CRM.MAIL)),
    linkedin: comoTexto(obtener(COLUMNAS_CRM.LINKEDIN)),
    estado: comoTexto(obtener(COLUMNAS_CRM.ESTADO)) as Estado | undefined,
    comentarios: comoTexto(obtener(COLUMNAS_CRM.COMENTARIOS)),
    fechaPrimerContacto: comoFecha(obtener(COLUMNAS_CRM.FECHA_PRIMER_CONTACTO)),
    fechaUltimoContacto: comoFecha(obtener(COLUMNAS_CRM.FECHA_ULTIMO_CONTACTO)),
    canal: comoTexto(obtener(COLUMNAS_CRM.CANAL)),
    proximaAccion: comoTexto(obtener(COLUMNAS_CRM.PROXIMA_ACCION)),
    fechaProximaAccion: comoFecha(obtener(COLUMNAS_CRM.FECHA_PROXIMA_ACCION)),
    pingueosSinRespuesta: comoNumero(obtener(COLUMNAS_CRM.PINGUEOS_SIN_RESPUESTA)),
  };
}

// Pares (índice de columna, valor) de las columnas que maneja el sistema. Las columnas que no
// conoce (ej. "Es traspaso?" en Emprendedores) no aparecen: nunca se escriben.
export function celdasDesdeFilaCRM(encabezados: readonly unknown[], fila: FilaCRM): Array<[number, unknown]> {
  const celdas: Array<[number, unknown]> = [];
  const asignar = (nombre: string, valor: unknown) => {
    const i = indiceColumnaCrm(encabezados, nombre);
    if (i === -1) return;
    celdas.push([i, valor instanceof Date ? valor : valor ?? '']);
  };
  asignar(COLUMNAS_CRM.EMPRESA, fila.empresa);
  asignar(COLUMNAS_CRM.TRAMERO_ENCARGADO, fila.trameroEncargado);
  asignar(COLUMNAS_CRM.PERSONA, fila.persona);
  asignar(COLUMNAS_CRM.ROL_PERSONA, fila.rolPersona);
  asignar(COLUMNAS_CRM.TELEFONO, fila.telefono);
  asignar(COLUMNAS_CRM.MAIL, fila.mail);
  asignar(COLUMNAS_CRM.LINKEDIN, fila.linkedin);
  asignar(COLUMNAS_CRM.ESTADO, fila.estado);
  asignar(COLUMNAS_CRM.COMENTARIOS, fila.comentarios);
  asignar(COLUMNAS_CRM.FECHA_PRIMER_CONTACTO, fila.fechaPrimerContacto);
  asignar(COLUMNAS_CRM.FECHA_ULTIMO_CONTACTO, fila.fechaUltimoContacto);
  asignar(COLUMNAS_CRM.CANAL, fila.canal);
  asignar(COLUMNAS_CRM.PROXIMA_ACCION, fila.proximaAccion);
  asignar(COLUMNAS_CRM.FECHA_PROXIMA_ACCION, fila.fechaProximaAccion);
  asignar(COLUMNAS_CRM.PINGUEOS_SIN_RESPUESTA, fila.pingueosSinRespuesta);
  return celdas;
}

// Agrupa las celdas en tramos de columnas contiguas, para escribir cada tramo con un solo
// setValues sin tocar las columnas del medio. `columna` es 1-based, como la usa Sheets.
export function tramosDeEscritura(celdas: Array<[number, unknown]>): Array<{ columna: number; valores: unknown[] }> {
  const ordenadas = [...celdas].sort((a, b) => a[0] - b[0]);
  const tramos: Array<{ columna: number; valores: unknown[] }> = [];
  for (const [i, valor] of ordenadas) {
    const ultimo = tramos[tramos.length - 1];
    if (ultimo && ultimo.columna + ultimo.valores.length === i + 1) ultimo.valores.push(valor);
    else tramos.push({ columna: i + 1, valores: [valor] });
  }
  return tramos;
}

// La fila completa tal como quedaría en la hoja: parte de `valoresActuales` (lo que ya había) y
// pisa solo las columnas del sistema.
export function valoresDesdeFilaCRM(
  encabezados: readonly unknown[],
  fila: FilaCRM,
  valoresActuales: readonly unknown[] = [],
): unknown[] {
  const valores: unknown[] = encabezados.map((_, i) => valoresActuales[i] ?? '');
  for (const [i, valor] of celdasDesdeFilaCRM(encabezados, fila)) valores[i] = valor;
  return valores;
}

// ---------- Acceso a Sheets ----------

function obtenerHojaClub(club: Club): GoogleAppsScript.Spreadsheet.Sheet {
  const hoja = abrirCrm().getSheetByName(club);
  if (!hoja) throw new Error(`No existe la hoja del club "${club}"`);
  return hoja;
}

function leerTabla(hoja: GoogleAppsScript.Spreadsheet.Sheet): { encabezados: unknown[]; valores: unknown[][] } {
  const valores = hoja.getDataRange().getValues();
  return { encabezados: valores[0] ?? [], valores };
}

function buscarNumeroFilaEmpresa(valores: readonly unknown[][], idxEmpresa: number, empresa: string): number | null {
  return buscarFilaPorClave(valores, idxEmpresa, normalizarNombreEmpresa(empresa), (a, b) => normalizarNombreEmpresa(a) === b);
}

function requerirFila(club: Club, empresa: string, encabezados: readonly unknown[], valores: readonly unknown[][]): {
  numeroFila: number;
  fila: FilaCRM;
} {
  const idxEmpresa = indiceColumna(encabezados, COLUMNAS_CRM.EMPRESA);
  const numeroFila = buscarNumeroFilaEmpresa(valores, idxEmpresa, empresa);
  if (numeroFila === null) throw new Error(`No se encontró la empresa "${empresa}" en la hoja "${club}"`);
  return { numeroFila, fila: filaCRMDesdeValores(club, encabezados, valores[numeroFila - 1]) };
}

// Escribe solo las columnas del sistema; el resto de la fila (columnas propias del club,
// casillas, fórmulas) queda como estaba.
function escribirFila(hoja: GoogleAppsScript.Spreadsheet.Sheet, numeroFila: number, encabezados: readonly unknown[], fila: FilaCRM): void {
  for (const tramo of tramosDeEscritura(celdasDesdeFilaCRM(encabezados, fila))) {
    hoja.getRange(numeroFila, tramo.columna, 1, tramo.valores.length).setValues([tramo.valores]);
  }
}

// Cambio de estado que detecta el sync de Gmail a partir de un mail nuestro (`siguiente` dice a
// qué estado pasa; si devuelve el mismo, no se toca nada). Pone pingueos en 0, "Fecha último
// contacto" = fecha del mail y lo registra en _Historial con origen GMAIL.
function cambiarEstadoPorMail(
  club: Club,
  empresa: string,
  fr: Usuario,
  fecha: Date,
  siguiente: (estado: Estado | undefined) => Estado | undefined,
): FilaCRM {
  const lock = LockService.getScriptLock();
  lock.waitLock(30_000);
  try {
    const hoja = obtenerHojaClub(club);
    const { encabezados, valores } = leerTabla(hoja);
    const { numeroFila, fila } = requerirFila(club, empresa, encabezados, valores);
    const nuevoEstado = siguiente(fila.estado);
    if (nuevoEstado === fila.estado) return fila;
    // Nunca retrocede "Fecha último contacto" (ej. si la empresa ya respondió después de este mail).
    const ultimo = fila.fechaUltimoContacto && fila.fechaUltimoContacto > fecha ? fila.fechaUltimoContacto : fecha;
    const nuevaFila: FilaCRM = { ...fila, estado: nuevoEstado, pingueosSinRespuesta: 0, fechaUltimoContacto: ultimo };
    escribirFila(hoja, numeroFila, encabezados, nuevaFila);
    registrarEvento({
      timestamp: now(),
      club,
      empresa,
      fr: fr.nombre,
      hechoPor: fr.verComoPor,
      tipo: 'CAMBIO_ESTADO',
      estadoAnterior: fila.estado,
      estadoNuevo: nuevoEstado,
      origen: 'GMAIL',
    });
    return nuevaFila;
  } finally {
    lock.releaseLock();
  }
}

// ---------- CrmService ----------

export function crearCrmService(): CrmService {
  return {
    buscarEmpresas(club, texto) {
      const { encabezados, valores } = leerTabla(obtenerHojaClub(club));
      const idxEmpresa = indiceColumna(encabezados, COLUMNAS_CRM.EMPRESA);
      const textoNorm = normalizarNombreEmpresa(texto);
      const resultado: string[] = [];
      for (let i = 1; i < valores.length; i++) {
        const empresa = String(valores[i][idxEmpresa] ?? '');
        if (empresa && normalizarNombreEmpresa(empresa).includes(textoNorm)) resultado.push(empresa);
      }
      return resultado;
    },

    getFila(club, empresa) {
      const { encabezados, valores } = leerTabla(obtenerHojaClub(club));
      const idxEmpresa = indiceColumna(encabezados, COLUMNAS_CRM.EMPRESA);
      const numeroFila = buscarNumeroFilaEmpresa(valores, idxEmpresa, empresa);
      return numeroFila === null ? null : filaCRMDesdeValores(club, encabezados, valores[numeroFila - 1]);
    },

    listarFilas(club) {
      const { encabezados, valores } = leerTabla(obtenerHojaClub(club));
      const idxEmpresa = indiceColumna(encabezados, COLUMNAS_CRM.EMPRESA);
      const filas: FilaCRM[] = [];
      for (let i = 1; i < valores.length; i++) {
        if (!valores[i][idxEmpresa]) continue;
        filas.push(filaCRMDesdeValores(club, encabezados, valores[i]));
      }
      return filas;
    },

    aplicarPostReunion(p: PostReunionConfirmado, fr: Usuario): FilaCRM {
      const lock = LockService.getScriptLock();
      lock.waitLock(30_000);
      try {
        const hoja = obtenerHojaClub(p.club);
        const { encabezados, valores } = leerTabla(hoja);
        const idxEmpresa = indiceColumna(encabezados, COLUMNAS_CRM.EMPRESA);
        const numeroFilaExistente = buscarNumeroFilaEmpresa(valores, idxEmpresa, p.empresa);
        const existente = numeroFilaExistente
          ? filaCRMDesdeValores(p.club, encabezados, valores[numeroFilaExistente - 1])
          : null;

        if (!transicionValidaMaquina(existente?.estado, p.datos.estadoSugerido)) {
          throw new Error(
            `Transición inválida: "${existente?.estado ?? '(empresa nueva)'}" -> "${p.datos.estadoSugerido}"`,
          );
        }

        const lineaComentario = formatearLineaComentario(p.fechaReunion, p.datos.comentarios);
        const nuevaFila: FilaCRM = {
          club: p.club,
          empresa: p.empresa,
          trameroEncargado: existente?.trameroEncargado || fr.nombre,
          persona: p.datos.persona ?? existente?.persona,
          rolPersona: p.datos.rolPersona ?? existente?.rolPersona,
          telefono: p.datos.telefono ?? existente?.telefono,
          // Suma los mails del paso 2 a los que ya había en la celda, sin borrar ninguno.
          mail: agregarMails(existente?.mail, p.datos.mail) ?? undefined,
          linkedin: p.datos.linkedin ?? existente?.linkedin,
          estado: p.datos.estadoSugerido,
          comentarios: agregarComentario(existente?.comentarios, lineaComentario),
          fechaPrimerContacto: existente?.fechaPrimerContacto ?? p.fechaReunion,
          fechaUltimoContacto: p.fechaReunion,
          canal: existente?.canal,
          proximaAccion: p.datos.proximaAccion ?? existente?.proximaAccion,
          fechaProximaAccion: p.datos.fechaProximaAccion
            ? fechaDeDia(p.datos.fechaProximaAccion)
            : existente?.fechaProximaAccion,
          pingueosSinRespuesta: 0,
        };

        const numeroFila = numeroFilaExistente ?? primeraFilaVacia(valores, idxEmpresa);
        escribirFila(hoja, numeroFila, encabezados, nuevaFila);

        // Idempotencia: confirmar la misma reunión (club+empresa+fechaReunion) dos veces no
        // duplica el historial — la línea de comentario ya es idempotente (agregarComentario);
        // acá evitamos duplicar también los Eventos.
        const yaRegistrado = getEventos(p.fechaReunion, p.fechaReunion, p.club).some(
          (e) => e.tipo === 'POST_REUNION' && e.empresa === p.empresa,
        );
        if (!yaRegistrado) {
          if (!numeroFilaExistente) {
            registrarEvento({
              timestamp: p.fechaReunion,
              club: p.club,
              empresa: p.empresa,
              fr: fr.nombre,
              hechoPor: fr.verComoPor,
              tipo: 'ALTA',
              estadoNuevo: nuevaFila.estado,
              origen: 'UI',
            });
          }
          registrarEvento({
            timestamp: p.fechaReunion,
            club: p.club,
            empresa: p.empresa,
            fr: fr.nombre,
            hechoPor: fr.verComoPor,
            tipo: 'POST_REUNION',
            estadoAnterior: existente?.estado,
            estadoNuevo: nuevaFila.estado,
            origen: 'UI',
          });
        }

        return nuevaFila;
      } finally {
        lock.releaseLock();
      }
    },

    registrarPingueo(club, empresa, fr, fecha, origen = 'UI') {
      const lock = LockService.getScriptLock();
      lock.waitLock(30_000);
      try {
        const hoja = obtenerHojaClub(club);
        const { encabezados, valores } = leerTabla(hoja);
        const { numeroFila, fila } = requerirFila(club, empresa, encabezados, valores);
        if (fila.estado && esEstadoFinal(fila.estado)) {
          throw new Error(`No se puede pinguear: "${empresa}" ya está en un estado final (${fila.estado})`);
        }
        const enviado = fecha ?? now();
        const nuevaFila: FilaCRM = {
          ...fila,
          pingueosSinRespuesta: fila.pingueosSinRespuesta + 1,
          // Nunca retrocede (ej. si la empresa ya respondió después).
          fechaUltimoContacto: fila.fechaUltimoContacto && fila.fechaUltimoContacto > enviado ? fila.fechaUltimoContacto : enviado,
        };
        escribirFila(hoja, numeroFila, encabezados, nuevaFila);
        registrarEvento({
          timestamp: now(),
          club,
          empresa,
          fr: fr.nombre,
          hechoPor: fr.verComoPor,
          tipo: 'PINGUEO',
          estadoAnterior: fila.estado,
          estadoNuevo: fila.estado,
          origen,
        });
        return nuevaFila;
      } finally {
        lock.releaseLock();
      }
    },

    registrarRespuesta(club, empresa, fr, origen = 'UI', fecha, cambiarEstado = true) {
      const lock = LockService.getScriptLock();
      lock.waitLock(30_000);
      try {
        const hoja = obtenerHojaClub(club);
        const { encabezados, valores } = leerTabla(hoja);
        const { numeroFila, fila } = requerirFila(club, empresa, encabezados, valores);
        const nuevoEstado: Estado | undefined = cambiarEstado ? estadoAlResponder(fila.estado) : fila.estado;
        const nuevaFila: FilaCRM = {
          ...fila,
          estado: nuevoEstado,
          pingueosSinRespuesta: 0,
          fechaUltimoContacto: fecha ?? now(),
        };
        escribirFila(hoja, numeroFila, encabezados, nuevaFila);
        registrarEvento({
          timestamp: now(),
          club,
          empresa,
          fr: fr.nombre,
          hechoPor: fr.verComoPor,
          tipo: 'RESPUESTA',
          estadoAnterior: fila.estado,
          estadoNuevo: nuevoEstado,
          origen,
        });
        return nuevaFila;
      } finally {
        lock.releaseLock();
      }
    },

    agregarMailsContacto(club, empresa, mails) {
      const lock = LockService.getScriptLock();
      lock.waitLock(30_000);
      try {
        const hoja = obtenerHojaClub(club);
        const { encabezados, valores } = leerTabla(hoja);
        const { numeroFila, fila } = requerirFila(club, empresa, encabezados, valores);
        const mail = agregarMails(fila.mail, mails.join(', ')) ?? undefined;
        if (mail === fila.mail) return fila;
        const nuevaFila: FilaCRM = { ...fila, mail };
        escribirFila(hoja, numeroFila, encabezados, nuevaFila);
        return nuevaFila;
      } finally {
        lock.releaseLock();
      }
    },

    registrarContactoNuestro(club, empresa, _fr, fecha) {
      const lock = LockService.getScriptLock();
      lock.waitLock(30_000);
      try {
        const hoja = obtenerHojaClub(club);
        const { encabezados, valores } = leerTabla(hoja);
        const { numeroFila, fila } = requerirFila(club, empresa, encabezados, valores);
        if (fila.fechaUltimoContacto && fila.fechaUltimoContacto >= fecha) return fila;
        const nuevaFila: FilaCRM = { ...fila, fechaUltimoContacto: fecha };
        escribirFila(hoja, numeroFila, encabezados, nuevaFila);
        return nuevaFila;
      } finally {
        lock.releaseLock();
      }
    },

    registrarMailDelEncargado(club, empresa, fr, fecha) {
      return cambiarEstadoPorMail(club, empresa, fr, fecha, estadoAlEscribirEncargado);
    },

    registrarResumenEnviado(club, empresa, fr, fecha) {
      return cambiarEstadoPorMail(club, empresa, fr, fecha, estadoAlMandarResumen);
    },

    cambiarEstado(club, empresa, nuevo, fr) {
      const lock = LockService.getScriptLock();
      lock.waitLock(30_000);
      try {
        const hoja = obtenerHojaClub(club);
        const { encabezados, valores } = leerTabla(hoja);
        const { numeroFila, fila } = requerirFila(club, empresa, encabezados, valores);
        if (!transicionValidaMaquina(fila.estado, nuevo)) {
          throw new Error(`Transición inválida: "${fila.estado}" -> "${nuevo}"`);
        }
        const nuevaFila: FilaCRM = { ...fila, estado: nuevo, fechaUltimoContacto: now() };
        escribirFila(hoja, numeroFila, encabezados, nuevaFila);
        registrarEvento({
          timestamp: now(),
          club,
          empresa,
          fr: fr.nombre,
          hechoPor: fr.verComoPor,
          tipo: 'CAMBIO_ESTADO',
          estadoAnterior: fila.estado,
          estadoNuevo: nuevo,
          origen: 'UI',
        });
        return nuevaFila;
      } finally {
        lock.releaseLock();
      }
    },

    registrarReunionCoordinada(club, empresa, fechaEvento, fr) {
      const lock = LockService.getScriptLock();
      lock.waitLock(30_000);
      try {
        const hoja = obtenerHojaClub(club);
        const { encabezados, valores } = leerTabla(hoja);
        const { numeroFila, fila } = requerirFila(club, empresa, encabezados, valores);

        const yaCoordinada = fila.estado === 'Reunión coordinada';
        if (!yaCoordinada && !transicionValidaMaquina(fila.estado, 'Reunión coordinada')) {
          // La empresa ya avanzó más allá (Tratativas, Va a ser sponsor, etc.): el sync de
          // Calendar no la retrocede, solo acelera el camino Mail enviado/respondido -> Reunión.
          return fila;
        }

        const nuevaFila: FilaCRM = {
          ...fila,
          estado: 'Reunión coordinada',
          proximaAccion: 'Reunión',
          fechaProximaAccion: fechaEvento,
          // "Fecha último contacto" no se toca: ver un evento en el Calendar no es un contacto.
        };
        escribirFila(hoja, numeroFila, encabezados, nuevaFila);

        if (!yaCoordinada) {
          registrarEvento({
            timestamp: now(),
            club,
            empresa,
            fr: fr.nombre,
            hechoPor: fr.verComoPor,
            tipo: 'CAMBIO_ESTADO',
            estadoAnterior: fila.estado,
            estadoNuevo: 'Reunión coordinada',
            origen: 'CALENDAR',
          });
        }
        return nuevaFila;
      } finally {
        lock.releaseLock();
      }
    },

    transicionValida(desde, hacia) {
      return transicionValidaMaquina(desde, hacia);
    },

    getEventos(desde, hasta, club) {
      return getEventos(desde, hasta, club);
    },
  };
}
