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
import { abrirSpreadsheet } from './config';
import { getEventos, registrarEvento } from './historial';
import { esEstadoFinal, transicionValida as transicionValidaMaquina } from './maquinaEstados';
import { buscarFilaPorClave, indiceColumna, primeraFilaVacia } from './sheetUtils';

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

export function filaCRMDesdeValores(club: Club, encabezados: readonly unknown[], valores: readonly unknown[]): FilaCRM {
  const obtener = (nombre: string) => valores[indiceColumna(encabezados, nombre)];
  const comoTexto = (v: unknown): string | undefined =>
    v === '' || v === null || v === undefined ? undefined : String(v);
  const comoFecha = (v: unknown): Date | undefined => {
    if (v === '' || v === null || v === undefined) return undefined;
    return v instanceof Date ? v : new Date(String(v));
  };
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

export function valoresDesdeFilaCRM(encabezados: readonly unknown[], fila: FilaCRM): unknown[] {
  const valores = new Array(encabezados.length).fill('');
  const asignar = (nombre: string, valor: unknown) => {
    valores[indiceColumna(encabezados, nombre)] = valor instanceof Date ? valor : valor ?? '';
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
  return valores;
}

// ---------- Acceso a Sheets ----------

function obtenerHojaClub(club: Club): GoogleAppsScript.Spreadsheet.Sheet {
  const hoja = abrirSpreadsheet().getSheetByName(club);
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

function escribirFila(hoja: GoogleAppsScript.Spreadsheet.Sheet, numeroFila: number, encabezados: readonly unknown[], fila: FilaCRM): void {
  hoja.getRange(numeroFila, 1, 1, encabezados.length).setValues([valoresDesdeFilaCRM(encabezados, fila)]);
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
          mail: p.datos.mail ?? existente?.mail,
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

        const numeroFila = numeroFilaExistente ?? primeraFilaVacia(valores);
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

    registrarPingueo(club, empresa, fr) {
      const lock = LockService.getScriptLock();
      lock.waitLock(30_000);
      try {
        const hoja = obtenerHojaClub(club);
        const { encabezados, valores } = leerTabla(hoja);
        const { numeroFila, fila } = requerirFila(club, empresa, encabezados, valores);
        if (fila.estado && esEstadoFinal(fila.estado)) {
          throw new Error(`No se puede pinguear: "${empresa}" ya está en un estado final (${fila.estado})`);
        }
        const nuevaFila: FilaCRM = {
          ...fila,
          pingueosSinRespuesta: fila.pingueosSinRespuesta + 1,
          fechaUltimoContacto: now(),
        };
        escribirFila(hoja, numeroFila, encabezados, nuevaFila);
        registrarEvento({
          timestamp: now(),
          club,
          empresa,
          fr: fr.nombre,
          tipo: 'PINGUEO',
          estadoAnterior: fila.estado,
          estadoNuevo: fila.estado,
          origen: 'UI',
        });
        return nuevaFila;
      } finally {
        lock.releaseLock();
      }
    },

    registrarRespuesta(club, empresa, fr, origen = 'UI') {
      const lock = LockService.getScriptLock();
      lock.waitLock(30_000);
      try {
        const hoja = obtenerHojaClub(club);
        const { encabezados, valores } = leerTabla(hoja);
        const { numeroFila, fila } = requerirFila(club, empresa, encabezados, valores);
        const nuevoEstado: Estado | undefined = fila.estado === 'Mail enviado' ? 'Mail respondido' : fila.estado;
        const nuevaFila: FilaCRM = {
          ...fila,
          estado: nuevoEstado,
          pingueosSinRespuesta: 0,
          fechaUltimoContacto: now(),
        };
        escribirFila(hoja, numeroFila, encabezados, nuevaFila);
        registrarEvento({
          timestamp: now(),
          club,
          empresa,
          fr: fr.nombre,
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
          fechaUltimoContacto: now(),
        };
        escribirFila(hoja, numeroFila, encabezados, nuevaFila);

        if (!yaCoordinada) {
          registrarEvento({
            timestamp: now(),
            club,
            empresa,
            fr: fr.nombre,
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
