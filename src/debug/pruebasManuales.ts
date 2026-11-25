// Funciones de prueba manual, NO son parte del producto. Sirven para ejercitar src/crm/ y
// src/sync/ desde el editor de Apps Script (seleccionarlas en el desplegable y tocar "Ejecutar"),
// porque esos módulos llaman a SpreadsheetApp/CalendarApp/GmailApp y no se pueden testear con Jest.
// Se pueden dejar en el repo (no rompen nada en producción), pero no se llaman desde ningún flujo real.

import { crearConfigService } from '../crm/config';
import { crearCrmService } from '../crm/repo';
import { now } from '../shared/clock';
import { CLUBES } from '../shared/constants';
import type { Club, PostReunionConfirmado, Usuario } from '../shared/types';

const CLUB_DE_PRUEBA: Club = 'Emprendedores';
const EMPRESA_DE_PRUEBA = 'Empresa de Prueba (manual)';

function usuarioDePrueba(): Usuario {
  return { mail: Session.getActiveUser().getEmail(), nombre: 'Prueba Manual', club: CLUB_DE_PRUEBA, rol: 'FR' };
}

// Ejercita todo el camino de CrmService contra la hoja real: alta, pingueo, respuesta, cambio de
// estado. Déjalo correr y mirá la hoja "Agro" del spreadsheet del proyecto + el log de ejecución.
export function probarCrmManualmente(): void {
  const crm = crearCrmService();
  const fr = usuarioDePrueba();

  Logger.log('Empresas en %s antes: %s', CLUB_DE_PRUEBA, JSON.stringify(crm.buscarEmpresas(CLUB_DE_PRUEBA, '')));

  const confirmado: PostReunionConfirmado = {
    club: CLUB_DE_PRUEBA,
    empresa: EMPRESA_DE_PRUEBA,
    fechaReunion: now(),
    datos: {
      persona: 'Ana Testigo',
      rolPersona: 'Marketing',
      mail: 'ana@empresadeprueba.com',
      telefono: null,
      linkedin: null,
      compromisosEmpresa: [],
      compromisosTrama: [],
      parrafoCompromisos: null,
      estadoSugerido: 'Tratativas',
      comentarios: 'Reunión de prueba manual disparada desde el editor de Apps Script.',
      proximaAccion: 'Hacer seguimiento',
      fechaProximaAccion: null,
      camposFaltantes: [],
    },
    adjuntosExtra: [],
  };

  const fila1 = crm.aplicarPostReunion(confirmado, fr);
  Logger.log('1) aplicarPostReunion -> %s', JSON.stringify(fila1));

  const fila2 = crm.aplicarPostReunion(confirmado, fr); // mismo club+empresa+fechaReunion
  Logger.log('2) aplicarPostReunion de nuevo (idempotencia, no debería duplicar línea de Comentarios) -> %s', JSON.stringify(fila2));

  const fila3 = crm.registrarPingueo(CLUB_DE_PRUEBA, EMPRESA_DE_PRUEBA, fr);
  Logger.log('3) registrarPingueo -> pingueosSinRespuesta=%s', fila3.pingueosSinRespuesta);

  const fila4 = crm.registrarRespuesta(CLUB_DE_PRUEBA, EMPRESA_DE_PRUEBA, fr);
  Logger.log('4) registrarRespuesta -> pingueosSinRespuesta=%s', fila4.pingueosSinRespuesta);

  const fila5 = crm.cambiarEstado(CLUB_DE_PRUEBA, EMPRESA_DE_PRUEBA, 'Va a ser sponsor', fr);
  Logger.log('5) cambiarEstado -> estado=%s', fila5.estado);

  try {
    crm.cambiarEstado(CLUB_DE_PRUEBA, EMPRESA_DE_PRUEBA, 'Mail enviado', fr); // transición inválida a propósito
    Logger.log('6) ERROR: debería haber tirado "transición inválida" y no lo hizo');
  } catch (e) {
    Logger.log('6) OK, rechazó la transición inválida: %s', e);
  }

  const eventos = crm.getEventos(new Date(0), now(), CLUB_DE_PRUEBA);
  Logger.log('Eventos registrados para %s: %s', EMPRESA_DE_PRUEBA, JSON.stringify(eventos.filter((ev) => ev.empresa === EMPRESA_DE_PRUEBA)));
}

// Diagnóstico de A7 (pingueo): config.getClub() cachea la lectura de _Clubes 5 minutos
// (CacheService), así que si acabás de completar una celda y sigue fallando, puede ser caché
// vieja en vez de la hoja. Esta función limpia esa caché y muestra, club por club, exactamente
// lo que la app está leyendo de _Clubes en este momento (incluidas las columnas de template de
// pingueo) — mirá el resultado en el log de ejecución.
export function verificarTemplatesPingueo(): void {
  CacheService.getScriptCache().removeAll(['config:usuarios', 'config:clubes', 'config:parametros']);
  const config = crearConfigService();
  CLUBES.forEach((club) => {
    try {
      Logger.log('%s -> %s', club, JSON.stringify(config.getClub(club)));
    } catch (e) {
      Logger.log('%s -> ERROR: %s', club, e);
    }
  });
}
