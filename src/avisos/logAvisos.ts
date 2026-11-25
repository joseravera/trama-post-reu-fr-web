// Dueño: Persona C (sección 7, C6). Deduplicación por clave (tipo|club|empresa|fecha) en _LogAvisos.
// Depende de Sheets: no se puede testear con Jest (ver README, sección 9). Reusa abrirSpreadsheet()
// de crm/config.ts (B1) en vez de abrir el spreadsheet de nuevo (regla de la sección 3.3).

import { abrirSpreadsheet } from '../crm/config';
import { HOJAS_SISTEMA } from '../shared/constants';
import type { Aviso } from '../shared/types';

const ESTADO_ENVIADO = 'ENVIADO';
const ESTADO_FALLIDO = 'FALLIDO';
const COLUMNA_CLAVE = 0;
const COLUMNA_ESTADO = 6;

function hojaLogAvisos(): GoogleAppsScript.Spreadsheet.Sheet {
  const hoja = abrirSpreadsheet().getSheetByName(HOJAS_SISTEMA.LOG_AVISOS);
  if (!hoja) throw new Error(`No existe la hoja ${HOJAS_SISTEMA.LOG_AVISOS}`);
  return hoja;
}

// Solo se usa para ESCALAMIENTO (sección 7, C6): "se mandan una sola vez por clave". Los
// ítems de la agenda del FR no pasan por acá, se repiten mientras sigan pendientes.
export function yaSeEnvio(clave: string): boolean {
  const hoja = hojaLogAvisos();
  const filas = hoja.getDataRange().getValues();
  return filas.some((fila) => fila[COLUMNA_CLAVE] === clave && fila[COLUMNA_ESTADO] === ESTADO_ENVIADO);
}

// Si el envío falló, se registra igual (estado FALLIDO) para que yaSeEnvio() siga devolviendo
// false y se reintente en el siguiente día de envío (sección 7, C4).
export function registrarEnvio(aviso: Aviso, exito = true): void {
  const hoja = hojaLogAvisos();
  hoja.appendRow([
    aviso.clave,
    new Date().toISOString(),
    aviso.tipo,
    aviso.club ?? '',
    aviso.empresa ?? '',
    aviso.destinatarios.join(', '),
    exito ? ESTADO_ENVIADO : ESTADO_FALLIDO,
  ]);
}
