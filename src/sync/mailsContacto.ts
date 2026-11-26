// Lógica pura para la celda "Mail" del CRM, que a veces tiene varias direcciones separadas por
// coma, ";", "/", "y" o saltos de línea (ej. en los traspasos de Emprendedores).

import { extraerMails } from '../shared/mails';

export { extraerMails };

// Consulta de Gmail para mails recibidos de cualquiera de esas direcciones en los últimos `dias`.
// null si no hay ninguna dirección válida.
export function consultaRespuestas(mails: readonly string[], dias: number): string | null {
  if (mails.length === 0) return null;
  const remitentes = mails.length === 1 ? mails[0] : `(${mails.join(' OR ')})`;
  return `from:${remitentes} newer_than:${dias}d`;
}

// Consulta de Gmail para mails que `remitente` le mandó a cualquiera de `destinatarios` (en Para o
// en CC) en los últimos `dias`. Sirve tanto en la casilla del remitente (sus enviados) como en la
// de alguien que estaba en copia. Las llaves {…} son un OR en la búsqueda de Gmail.
export function consultaEnviosA(remitente: string, destinatarios: readonly string[], dias: number): string | null {
  if (!remitente || destinatarios.length === 0) return null;
  const para = destinatarios.map((m) => `to:${m} cc:${m}`).join(' ');
  return `from:${remitente} {${para}} newer_than:${dias}d`;
}

// Un mensaje de Gmail reducido a lo que necesita el sync (para poder testearlo sin GmailApp).
export interface MensajeSimple {
  de: string;
  para: string;
  cc: string;
  fecha: Date;
}

// Fecha del mensaje más reciente cuyo remitente está en `remitentes` y, si se pasan
// `destinatarios`, que tenga a alguno de ellos en Para o CC. null si no hay ninguno.
export function ultimaFecha(
  mensajes: readonly MensajeSimple[],
  remitentes: readonly string[],
  destinatarios?: readonly string[],
): Date | null {
  let ultima: Date | null = null;
  for (const m of mensajes) {
    if (!extraerMails(m.de).some((x) => remitentes.includes(x))) continue;
    if (destinatarios && !extraerMails(`${m.para} ${m.cc}`).some((x) => destinatarios.includes(x))) continue;
    if (!ultima || m.fecha > ultima) ultima = m.fecha;
  }
  return ultima;
}

// `fecha` es posterior a `referencia` (con un margen, porque Sheets puede redondear la hora que
// guardamos y no queremos registrar dos veces el mismo mensaje). Sin referencia, siempre true.
export function esPosterior(fecha: Date, referencia: Date | undefined, margenMs = 60_000): boolean {
  return !referencia || fecha.getTime() > referencia.getTime() + margenMs;
}

// Empresa en "Respondió traspaso": qué pasó después, mirando la secuencia de mails en Gmail.
// - `mailEnviado`: el encargado le escribió (último mail suyo = `envioEncargado`) después de alguna
//   respuesta de la empresa → pasa a "Mail enviado". Se compara contra los mails reales de la
//   empresa, no contra "Fecha último contacto" del CRM, que puede haber quedado con la hora del
//   sync. Si no hay mails de la empresa a la vista, se usa "Fecha último contacto".
// - `respuestaPosterior`: la empresa volvió a escribir después de ese mail del encargado (la más
//   reciente) → además pasa a "Mail respondido".
export function evaluarTraspaso(
  envioEncargado: Date | null,
  mensajesEmpresa: readonly Date[],
  fechaUltimoContacto: Date | undefined,
): { mailEnviado: boolean; respuestaPosterior: Date | null } {
  if (!envioEncargado) return { mailEnviado: false, respuestaPosterior: null };
  const mailEnviado = mensajesEmpresa.length > 0
    ? mensajesEmpresa.some((f) => f < envioEncargado)
    : esPosterior(envioEncargado, fechaUltimoContacto);
  if (!mailEnviado) return { mailEnviado: false, respuestaPosterior: null };
  const posteriores = mensajesEmpresa.filter((f) => f > envioEncargado);
  const respuestaPosterior = posteriores.length
    ? posteriores.reduce((a, b) => (b > a ? b : a))
    : null;
  return { mailEnviado, respuestaPosterior };
}
