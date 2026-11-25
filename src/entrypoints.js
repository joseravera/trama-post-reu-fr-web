// Archivo escrito a mano, NO pasa por esbuild/tsc — se copia tal cual a dist/ (ver build:assets
// en package.json) y se sube con clasp junto a Code.js.
//
// Tiene que existir porque Code.js es un bundle de esbuild: todo queda adentro de un closure,
// así que ninguna función aparece "declarada arriba de todo" en ese archivo. El editor de Apps
// Script (el desplegable de "función a ejecutar" para probar a mano, y el panel de Triggers para
// instalar un trigger desde la UI) solo encuentra funciones declaradas así, de verdad, en el
// texto de ALGÚN archivo del proyecto — por eso estas funciones viven acá, cortitas, delegando a
// la implementación real que Code.js cuelga en `TramaImpl`.
//
// Si agregás algo nuevo que Apps Script tiene que poder invocar por nombre (un trigger, un
// endpoint para la UI con google.script.run, algo para probar a mano), agregalo ACÁ tal como está
// en `exportsGlobales` de src/main.ts.

function doGet(e) {
  return TramaImpl.doGet(e);
}

function include(nombreArchivo) {
  return TramaImpl.include(nombreArchivo);
}

// Persona A: endpoints que la UI llama con google.script.run.
function inicio() {
  return TramaImpl.inicio();
}

function buscarEmpresas(club, texto) {
  return TramaImpl.buscarEmpresas(club, texto);
}

function infoEmpresa(club, empresa) {
  return TramaImpl.infoEmpresa(club, empresa);
}

function procesarNotas(solicitud) {
  return TramaImpl.procesarNotas(solicitud);
}

function previsualizarMail(enviado) {
  return TramaImpl.previsualizarMail(enviado);
}

function listarAdjuntos(club) {
  return TramaImpl.listarAdjuntos(club);
}

function confirmarPostReunion(enviado) {
  return TramaImpl.confirmarPostReunion(enviado);
}

function reintentarBorrador(enviado) {
  return TramaImpl.reintentarBorrador(enviado);
}

function listarSeguimientos() {
  return TramaImpl.listarSeguimientos();
}

function registrarPingueo(club, empresa) {
  return TramaImpl.registrarPingueo(club, empresa);
}

function instalarTriggersUsuario() {
  return TramaImpl.instalarTriggersUsuario();
}

function desinstalarTriggersUsuario() {
  return TramaImpl.desinstalarTriggersUsuario();
}

function sincronizarCalendar() {
  return TramaImpl.sincronizarCalendar();
}

function sincronizarRespuestasGmail() {
  return TramaImpl.sincronizarRespuestasGmail();
}

function instalarTriggerDiarioHistorial() {
  return TramaImpl.instalarTriggerDiarioHistorial();
}

// El nombre tiene que coincidir con NOMBRE_TRIGGER_HISTORIAL en src/crm/historial.ts.
function detectarCambiosManualesTrigger() {
  return TramaImpl.detectarCambiosManualesTrigger();
}

function instalarTriggersCentrales() {
  return TramaImpl.instalarTriggersCentrales();
}

function ejecutarEnvioAgendaYAvisos() {
  return TramaImpl.ejecutarEnvioAgendaYAvisos();
}

function demoAvanzarDias(dias) {
  return TramaImpl.demoAvanzarDias(dias);
}

// Solo para probar desde el editor de Apps Script, ver src/debug/pruebasManuales.ts.
function probarCrmManualmente() {
  return TramaImpl.probarCrmManualmente();
}

function verificarTemplatesPingueo() {
  return TramaImpl.verificarTemplatesPingueo();
}
