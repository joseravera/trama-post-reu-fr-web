// Dueño: Persona B (sección 6, B1). ConfigService: lee _Usuarios, _Clubes, _Parametros, con caché.
//
// Encabezados esperados (en minúscula, tal cual quedan en la hoja):
//   _Usuarios:    mail, nombre, club, rol
//   _Clubes:      club, hoja, templateDocId, carpetaAdjuntosId, templatePingueoPrimerContactoDocId,
//                 templatePingueoPostReunionDocId
//   _Parametros:  nombre, valor

import { HOJAS_SISTEMA, SPREADSHEET_ID } from '../shared/constants';
import type { Club, ConfigService, Rol, Usuario } from '../shared/types';
import { indiceColumna } from './sheetUtils';

const CACHE_TTL_SEGUNDOS = 5 * 60;

// Único punto de acceso al spreadsheet del proyecto (regla de la sección 3.3): queda
// prohibido usar SpreadsheetApp.openById / openByUrl en cualquier otro lugar del código.
export function abrirSpreadsheet(): GoogleAppsScript.Spreadsheet.Spreadsheet {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function leerHojaSistema(nombreHoja: string): { encabezados: unknown[]; filas: unknown[][] } {
  const hoja = abrirSpreadsheet().getSheetByName(nombreHoja);
  if (!hoja) throw new Error(`No existe la hoja de sistema "${nombreHoja}" (¿falta crearla? ver sección 6, B1)`);
  const valores = hoja.getDataRange().getValues();
  return { encabezados: valores[0] ?? [], filas: valores.slice(1) };
}

function leerConCache<T>(clave: string, leer: () => T): T {
  const cache = CacheService.getScriptCache();
  const cacheado = cache.get(clave);
  if (cacheado !== null) return JSON.parse(cacheado) as T;
  const valor = leer();
  cache.put(clave, JSON.stringify(valor), CACHE_TTL_SEGUNDOS);
  return valor;
}

interface FilaUsuario {
  mail: string;
  nombre: string;
  club: Club | null;
  rol: Rol;
}

function leerUsuarios(): FilaUsuario[] {
  return leerConCache('config:usuarios', () => {
    const { encabezados, filas } = leerHojaSistema(HOJAS_SISTEMA.USUARIOS);
    const iMail = indiceColumna(encabezados, 'mail');
    const iNombre = indiceColumna(encabezados, 'nombre');
    const iClub = indiceColumna(encabezados, 'club');
    const iRol = indiceColumna(encabezados, 'rol');
    return filas
      .filter((f) => f[iMail])
      .map((f) => ({
        mail: String(f[iMail]).trim().toLowerCase(),
        nombre: String(f[iNombre]),
        club: (f[iClub] ? (f[iClub] as Club) : null),
        rol: f[iRol] as Rol,
      }));
  });
}

interface FilaClub {
  club: Club;
  hoja: string;
  templateDocId: string;
  carpetaAdjuntosId: string;
  templatePingueoPrimerContactoDocId: string;
  templatePingueoPostReunionDocId: string;
}

function leerClubes(): FilaClub[] {
  return leerConCache('config:clubes', () => {
    const { encabezados, filas } = leerHojaSistema(HOJAS_SISTEMA.CLUBES);
    const iClub = indiceColumna(encabezados, 'club');
    const iHoja = indiceColumna(encabezados, 'hoja');
    const iTemplate = indiceColumna(encabezados, 'templateDocId');
    const iCarpeta = indiceColumna(encabezados, 'carpetaAdjuntosId');
    // Columnas nuevas de A7 (pingueo): la columna tiene que existir en el encabezado para
    // todos los clubes, pero la celda puede quedar vacía en los que todavía no tienen el Doc
    // (por ahora, solo Emprendedores) — MailService.crearBorradorPingueo avisa con un error
    // claro si se intenta pinguear sin ese template configurado.
    const iTemplatePrimerContacto = indiceColumna(encabezados, 'templatePingueoPrimerContactoDocId');
    const iTemplatePostReunion = indiceColumna(encabezados, 'templatePingueoPostReunionDocId');
    return filas
      .filter((f) => f[iClub])
      .map((f) => ({
        club: f[iClub] as Club,
        hoja: String(f[iHoja]),
        templateDocId: String(f[iTemplate]),
        carpetaAdjuntosId: String(f[iCarpeta]),
        templatePingueoPrimerContactoDocId: String(f[iTemplatePrimerContacto] ?? ''),
        templatePingueoPostReunionDocId: String(f[iTemplatePostReunion] ?? ''),
      }));
  });
}

function leerParametros(): Map<string, string> {
  const mapa = leerConCache('config:parametros', () => {
    const { encabezados, filas } = leerHojaSistema(HOJAS_SISTEMA.PARAMETROS);
    const iNombre = indiceColumna(encabezados, 'nombre');
    const iValor = indiceColumna(encabezados, 'valor');
    const registro: Record<string, string> = {};
    for (const f of filas) {
      if (!f[iNombre]) continue;
      registro[String(f[iNombre])] = String(f[iValor]);
    }
    return registro;
  });
  return new Map(Object.entries(mapa));
}

export function crearConfigService(): ConfigService {
  return {
    getUsuario(mail: string): Usuario | null {
      const buscado = mail.trim().toLowerCase();
      const fila = leerUsuarios().find((u) => u.mail === buscado);
      return fila ? { mail: fila.mail, nombre: fila.nombre, club: fila.club, rol: fila.rol } : null;
    },

    getUsuarios(filtro?: { rol?: Rol; club?: Club }): Usuario[] {
      return leerUsuarios()
        .filter((u) => !filtro?.rol || u.rol === filtro.rol)
        .filter((u) => !filtro?.club || u.club === filtro.club)
        .map((u) => ({ mail: u.mail, nombre: u.nombre, club: u.club, rol: u.rol }));
    },

    getClub(club: Club) {
      const fila = leerClubes().find((c) => c.club === club);
      if (!fila) throw new Error(`El club "${club}" no está dado de alta en ${HOJAS_SISTEMA.CLUBES}`);
      return {
        hoja: fila.hoja,
        templateDocId: fila.templateDocId,
        carpetaAdjuntosId: fila.carpetaAdjuntosId,
        templatePingueoPrimerContactoDocId: fila.templatePingueoPrimerContactoDocId,
        templatePingueoPostReunionDocId: fila.templatePingueoPostReunionDocId,
      };
    },

    getParametro(nombre: string): number {
      const valor = leerParametros().get(nombre);
      if (valor === undefined) {
        throw new Error(`No existe el parámetro "${nombre}" en ${HOJAS_SISTEMA.PARAMETROS}`);
      }
      const numero = Number(valor);
      if (Number.isNaN(numero)) {
        // ej: DIAS_ENVIO_AGENDA = "LUN,MIE,VIE" no es numérico; getParametro es solo para los
        // parámetros numéricos del contrato (shared/types.ts). Si C necesita ese valor,
        // lee la hoja _Parametros directo o pedimos ampliar ConfigService.
        throw new Error(`El parámetro "${nombre}" no es numérico (valor: "${valor}")`);
      }
      return numero;
    },
  };
}
