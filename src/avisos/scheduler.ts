// Dueño: Persona C (sección 7, C8). Triggers centrales (lunes/miércoles/viernes 9:00) + modo demo.
// Es el orquestador: acá sí se junta todo (ConfigService/CrmService de B + reglas/notificador de
// C) porque es el único lugar de avisos/ que tiene sentido que dependa de Apps Script de punta a
// punta. No se testea con Jest (ver README, sección 9); las piezas que usa ya están testeadas.

import { crearConfigService } from '../crm/config';
import { crearCrmService } from '../crm/repo';
import { now, setDemoNow } from '../shared/clock';
import { CLUBES, PARAMETROS } from '../shared/constants';
import type { Aviso, Club, ConfigService, CrmService } from '../shared/types';
import { esDiaDeEnvio, esLunes } from './calendarioEnvios';
import { evaluarEscalamientos } from './escalamiento';
import { enviarMails } from './notificadorMail';
import { tarjetaResumenCodis, tarjetaResumenCoordinador, type Tarjeta } from './plantillaMail';
import type { ParametrosReglas } from './reglas';
import { evaluarReglas, resolverDestinatarios } from './reglas';
import {
  construirResumenCodis,
  construirResumenCoordinador,
  formatearResumenCodis,
  formatearResumenCoordinador,
  type ResumenCoordinador,
} from './resumenes';

const UN_DIA_MS = 86_400_000;

function leerParametros(config: ConfigService): ParametrosReglas {
  return {
    diasPingueoMail: config.getParametro(PARAMETROS.DIAS_PINGUEO_MAIL),
    diasCoordinar: config.getParametro(PARAMETROS.DIAS_COORDINAR),
    horasCargaPost: config.getParametro(PARAMETROS.HORAS_CARGA_POST),
    diasSeguimiento: config.getParametro(PARAMETROS.DIAS_SEGUIMIENTO),
    diasTratativasEscala: config.getParametro(PARAMETROS.DIAS_TRATATIVAS_ESCALA),
    pingueosEscala: config.getParametro(PARAMETROS.PINGUEOS_ESCALA),
    diasVencidoEscala: config.getParametro(PARAMETROS.DIAS_VENCIDO_ESCALA),
  };
}

function claveResumen(tipo: 'RESUMEN_COORDINADOR' | 'RESUMEN_CODIS', club: Club | '_', ahora: Date): string {
  return `${tipo}|${club}|_|${ahora.toISOString().slice(0, 10)}`;
}

// Resúmenes semanales (C7), ya con mails reales (no pasan por resolverDestinatarios). Además del
// texto, devuelve la tarjeta HTML de cada resumen (por clave del aviso) para el mail con formato.
function construirAvisosResumenSemanal(
  config: ConfigService,
  crm: CrmService,
  ahora: Date,
): { avisos: Aviso[]; tarjetas: Map<string, Tarjeta> } {
  const finSemanaActual = ahora;
  const inicioSemanaActual = new Date(ahora.getTime() - 7 * UN_DIA_MS);
  const inicioSemanaAnterior = new Date(ahora.getTime() - 14 * UN_DIA_MS);

  const avisos: Aviso[] = [];
  const tarjetas = new Map<string, Tarjeta>();
  const resumenesPorClub: ResumenCoordinador[] = [];

  for (const club of CLUBES) {
    const filas = crm.listarFilas(club);
    const eventosActuales = crm.getEventos(inicioSemanaActual, finSemanaActual, club);
    const eventosAnteriores = crm.getEventos(inicioSemanaAnterior, inicioSemanaActual, club);
    const resumen = construirResumenCoordinador(club, filas, eventosActuales, eventosAnteriores, ahora);
    resumenesPorClub.push(resumen);

    const coordinadores = config.getUsuarios({ rol: 'Coordinador', club }).map((u) => u.mail);
    if (coordinadores.length === 0) continue;
    const clave = claveResumen('RESUMEN_COORDINADOR', club, ahora);
    tarjetas.set(clave, tarjetaResumenCoordinador(resumen));
    avisos.push({
      clave,
      tipo: 'RESUMEN_COORDINADOR',
      destinatarios: coordinadores,
      club,
      texto: formatearResumenCoordinador(resumen),
    });
  }

  const codirectoras = config.getUsuarios({ rol: 'Codirectora' }).map((u) => u.mail);
  if (codirectoras.length > 0) {
    const clave = claveResumen('RESUMEN_CODIS', '_', ahora);
    const resumenCodis = construirResumenCodis(resumenesPorClub);
    tarjetas.set(clave, tarjetaResumenCodis(resumenCodis));
    avisos.push({
      clave,
      tipo: 'RESUMEN_CODIS',
      destinatarios: codirectoras,
      texto: formatearResumenCodis(resumenCodis),
    });
  }

  return { avisos, tarjetas };
}

// URL de la web app publicada, para el botón "Abrir FR Assistant" del mail. null si no está publicada.
function urlWebApp(): string | null {
  try {
    return ScriptApp.getService().getUrl() || null;
  } catch (e) {
    return null;
  }
}

export function instalarTriggersCentrales(): void {
  const yaInstalado = ScriptApp.getProjectTriggers().some(
    (t) => t.getHandlerFunction() === 'ejecutarEnvioAgendaYAvisos',
  );
  if (yaInstalado) return;
  ScriptApp.newTrigger('ejecutarEnvioAgendaYAvisos').timeBased().everyDays(1).atHour(9).create();
}

// El trigger corre todos los días a las 9; la función se autolimita a lunes/miércoles/viernes
// (sección 7, C4) salvo que la llame el modo demo con forzar=true.
export function ejecutarEnvioAgendaYAvisos(forzar = false): void {
  const ahora = now();
  if (!forzar && !esDiaDeEnvio(ahora)) return;

  const config = crearConfigService();
  const crm = crearCrmService();
  const parametros = leerParametros(config);

  const avisosPorNombre: Aviso[] = [];
  for (const club of CLUBES) {
    const filas = crm.listarFilas(club);
    avisosPorNombre.push(...evaluarReglas(filas, ahora, parametros));
    avisosPorNombre.push(...evaluarEscalamientos(filas, ahora, parametros));
  }
  const avisosResueltos = resolverDestinatarios(avisosPorNombre, config.getUsuarios());

  const resumenes = esLunes(ahora) ? construirAvisosResumenSemanal(config, crm, ahora) : { avisos: [], tarjetas: new Map<string, Tarjeta>() };

  const avisos = [...avisosResueltos, ...resumenes.avisos];
  if (avisos.length === 0) return;

  enviarMails(avisos, { tarjetasResumen: resumenes.tarjetas, urlApp: urlWebApp() });
}

// Para la demo: adelanta el reloj y fuerza un envío en el momento, aunque no sea día de envío.
export function demoAvanzarDias(dias: number): void {
  const ahora = new Date();
  ahora.setDate(ahora.getDate() + dias);
  setDemoNow(ahora);
  ejecutarEnvioAgendaYAvisos(true);
}
