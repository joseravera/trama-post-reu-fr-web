// Entrypoint que bundlea todo el proyecto en un único Code.js (ver build en package.json).
//
// esbuild empaqueta todo esto dentro de un closure ((() => {...})()), así que ninguna función
// queda declarada "a nivel superior" del archivo final — el editor de Apps Script (el desplegable
// de "función a ejecutar" y el panel de Triggers) solo lista funciones declaradas así, de verdad,
// en el texto del archivo. Por eso NO exponemos funciones sueltas acá: dejamos todo colgado de un
// único objeto en globalThis (`TramaImpl`), y `src/entrypoints.js` (un archivo escrito a mano, que
// NO pasa por esbuild) tiene las funciones top-level de verdad que delegan a este objeto. Si algo
// nuevo necesita ser invocable por nombre desde Apps Script, se agrega ACÁ (al objeto) Y en
// `src/entrypoints.js` (como función top-level que delega).
//
// Importante: el runtime V8 de Apps Script no tiene `global` (eso es un global de Node.js) —
// hay que usar `globalThis`, que Google documenta como soportado en el runtime V8.

import {
  doGet,
  include,
  inicio,
  buscarEmpresas,
  infoEmpresa,
  procesarNotas,
  previsualizarMail,
  listarAdjuntos,
  confirmarPostReunionUI,
  reintentarBorradorUI,
  listarSeguimientos,
  registrarPingueo,
  listarUsuarios,
  verComo,
  listarEquipo,
} from './app/webapp';
import { crearCrmService } from './crm/repo';
import { crearConfigService } from './crm/config';
import { NOMBRE_TRIGGER_HISTORIAL, detectarCambiosManuales, instalarTriggerDiarioHistorial } from './crm/historial';
import { instalarTriggersUsuario, desinstalarTriggersUsuario } from './sync/triggersUsuario';
import { sincronizarCalendar } from './sync/calendar';
import { sincronizarRespuestasGmail } from './sync/respuestasGmail';
import { instalarTriggersCentrales, ejecutarEnvioAgendaYAvisos, demoAvanzarDias } from './avisos/scheduler';
import { probarCrmManualmente, verificarTemplatesPingueo } from './debug/pruebasManuales';

function detectarCambiosManualesTrigger(): void {
  detectarCambiosManuales(crearCrmService(), crearConfigService().getClubesActivos());
}

const exportsGlobales: Record<string, unknown> = {
  doGet,
  include,
  // Persona A: funciones que la UI llama con google.script.run.
  inicio,
  buscarEmpresas,
  infoEmpresa,
  procesarNotas,
  previsualizarMail,
  listarAdjuntos,
  confirmarPostReunion: confirmarPostReunionUI,
  reintentarBorrador: reintentarBorradorUI,
  listarSeguimientos,
  registrarPingueo,
  listarUsuarios,
  verComo,
  listarEquipo,
  instalarTriggersUsuario,
  desinstalarTriggersUsuario,
  sincronizarCalendar,
  sincronizarRespuestasGmail,
  instalarTriggerDiarioHistorial,
  [NOMBRE_TRIGGER_HISTORIAL]: detectarCambiosManualesTrigger,
  instalarTriggersCentrales,
  ejecutarEnvioAgendaYAvisos,
  demoAvanzarDias,
  probarCrmManualmente, // solo para probar desde el editor de Apps Script, ver src/debug/
  verificarTemplatesPingueo, // idem: diagnóstico de los templates/caché de A7 (pingueo)
};

(globalThis as Record<string, unknown>).TramaImpl = exportsGlobales;
