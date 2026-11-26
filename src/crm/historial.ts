// Dueño: Persona B (sección 6, B4). Historial de eventos en _Historial + detección de cambios
// manuales comparando contra _Snapshot. Recibe un CrmService por parámetro (no lo importa de
// repo.ts) para evitar una dependencia circular repo.ts <-> historial.ts.

import { abrirConfig } from './config';
import { CLUBES, HOJAS_SISTEMA } from '../shared/constants';
import { indiceColumna } from './sheetUtils';
import { now } from '../shared/clock';
import type { Club, CrmService, Estado, Evento } from '../shared/types';

const ENCABEZADOS_HISTORIAL = ['timestamp', 'club', 'empresa', 'fr', 'tipo', 'estadoAnterior', 'estadoNuevo', 'origen', 'hechoPor'];
const ENCABEZADOS_SNAPSHOT = ['club', 'empresa', 'estado', 'timestamp'];

// Nombre de la función global que instala el trigger diario (ver src/main.ts).
export const NOMBRE_TRIGGER_HISTORIAL = 'detectarCambiosManualesTrigger';

function obtenerOCrearHoja(nombre: string, encabezados: string[]): GoogleAppsScript.Spreadsheet.Sheet {
  const ss = abrirConfig();
  const existente = ss.getSheetByName(nombre);
  if (existente) return existente;
  const hoja = ss.insertSheet(nombre);
  hoja.getRange(1, 1, 1, encabezados.length).setValues([encabezados]);
  hoja.hideSheet();
  return hoja;
}

function obtenerHojaHistorial(): GoogleAppsScript.Spreadsheet.Sheet {
  return obtenerOCrearHoja(HOJAS_SISTEMA.HISTORIAL, ENCABEZADOS_HISTORIAL);
}

export function registrarEvento(evento: Evento): void {
  const hoja = obtenerHojaHistorial();
  hoja.appendRow([
    evento.timestamp,
    evento.club,
    evento.empresa,
    evento.fr,
    evento.tipo,
    evento.estadoAnterior ?? '',
    evento.estadoNuevo ?? '',
    evento.origen,
    evento.hechoPor ?? '',
  ]);
}

export function getEventos(desde: Date, hasta: Date, club?: Club): Evento[] {
  const hoja = obtenerHojaHistorial();
  const valores = hoja.getDataRange().getValues();
  const encabezados = valores[0] ?? ENCABEZADOS_HISTORIAL;
  const iTs = indiceColumna(encabezados, 'timestamp');
  const iClub = indiceColumna(encabezados, 'club');
  const iEmpresa = indiceColumna(encabezados, 'empresa');
  const iFr = indiceColumna(encabezados, 'fr');
  const iTipo = indiceColumna(encabezados, 'tipo');
  const iAnt = indiceColumna(encabezados, 'estadoAnterior');
  const iNuevo = indiceColumna(encabezados, 'estadoNuevo');
  const iOrigen = indiceColumna(encabezados, 'origen');

  const eventos: Evento[] = [];
  for (let i = 1; i < valores.length; i++) {
    const fila = valores[i];
    if (!fila[iTs]) continue;
    const timestamp = fila[iTs] instanceof Date ? fila[iTs] : new Date(String(fila[iTs]));
    if (timestamp < desde || timestamp > hasta) continue;
    if (club && fila[iClub] !== club) continue;
    eventos.push({
      timestamp,
      club: fila[iClub] as Club,
      empresa: String(fila[iEmpresa]),
      fr: String(fila[iFr]),
      tipo: fila[iTipo] as Evento['tipo'],
      estadoAnterior: (fila[iAnt] || undefined) as Estado | undefined,
      estadoNuevo: (fila[iNuevo] || undefined) as Estado | undefined,
      origen: fila[iOrigen] as Evento['origen'],
    });
  }
  return eventos;
}

/**
 * Trigger diario (ver instalarTriggerDiarioHistorial). Compara el estado actual de cada fila de
 * las 5 hojas de club contra el snapshot del día anterior. Un cambio de estado que ya está
 * explicado por un Evento registrado desde el último snapshot (porque pasó por `aplicarPostReunion`,
 * `cambiarEstado`, Calendar o Gmail) no genera nada nuevo; el resto son ediciones manuales en el
 * sheet y se registran como Evento con origen 'MANUAL'.
 */
export function detectarCambiosManuales(crm: CrmService, clubes: readonly Club[] = CLUBES): void {
  const hojaSnapshot = obtenerOCrearHoja(HOJAS_SISTEMA.SNAPSHOT, ENCABEZADOS_SNAPSHOT);
  const valoresSnapshot = hojaSnapshot.getDataRange().getValues();

  const snapshotAnterior = new Map<string, Estado | undefined>();
  let timestampSnapshotAnterior = new Date(0);
  for (let i = 1; i < valoresSnapshot.length; i++) {
    const [club, empresa, estado, timestamp] = valoresSnapshot[i];
    if (!club) continue;
    snapshotAnterior.set(`${club}|${empresa}`, (estado || undefined) as Estado | undefined);
    if (timestamp) timestampSnapshotAnterior = new Date(timestamp);
  }

  const ahora = now();
  const filasNuevasSnapshot: unknown[][] = [];

  for (const club of clubes) {
    const eventosDesdeSnapshot = crm.getEventos(timestampSnapshotAnterior, ahora, club);
    for (const fila of crm.listarFilas(club)) {
      const clave = `${club}|${fila.empresa}`;
      const estadoAnterior = snapshotAnterior.get(clave);
      if (estadoAnterior !== fila.estado) {
        const yaExplicado = eventosDesdeSnapshot.some(
          (e) => e.empresa === fila.empresa && e.estadoNuevo === fila.estado,
        );
        if (!yaExplicado) {
          registrarEvento({
            timestamp: ahora,
            club,
            empresa: fila.empresa,
            fr: fila.trameroEncargado,
            tipo: 'CAMBIO_ESTADO',
            estadoAnterior,
            estadoNuevo: fila.estado,
            origen: 'MANUAL',
          });
        }
      }
      filasNuevasSnapshot.push([club, fila.empresa, fila.estado ?? '', ahora]);
    }
  }

  hojaSnapshot.getRange(2, 1, Math.max(hojaSnapshot.getMaxRows() - 1, 1), ENCABEZADOS_SNAPSHOT.length).clearContent();
  if (filasNuevasSnapshot.length > 0) {
    hojaSnapshot.getRange(2, 1, filasNuevasSnapshot.length, ENCABEZADOS_SNAPSHOT.length).setValues(filasNuevasSnapshot);
  }
}

export function instalarTriggerDiarioHistorial(): void {
  const yaInstalado = ScriptApp.getProjectTriggers().some((t) => t.getHandlerFunction() === NOMBRE_TRIGGER_HISTORIAL);
  if (yaInstalado) return;
  ScriptApp.newTrigger(NOMBRE_TRIGGER_HISTORIAL).timeBased().everyDays(1).atHour(6).create();
}
