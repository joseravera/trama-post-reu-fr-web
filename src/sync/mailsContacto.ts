// Lógica pura para la celda "Mail" del CRM, que a veces tiene varias direcciones separadas por
// coma, ";", "/", "y" o saltos de línea (ej. en los traspasos de Emprendedores).

import { dominiosEmpresa, extraerMails } from '../shared/mails';
import type { Estado } from '../shared/types';

export { extraerMails };

// Términos de búsqueda para una empresa: sus mails y sus dominios propios (ver shared/mails.ts),
// así también aparecen mails de personas nuevas de la empresa.
function terminosEmpresa(mails: readonly string[]): string[] {
  return [...mails, ...dominiosEmpresa(mails)];
}

// Consulta de Gmail para mails recibidos de la empresa (sus mails o su dominio) en los últimos
// `dias`. null si no hay ninguna dirección válida.
export function consultaRespuestas(mails: readonly string[], dias: number): string | null {
  if (mails.length === 0) return null;
  const terminos = terminosEmpresa(mails);
  const remitentes = terminos.length === 1 ? terminos[0] : `(${terminos.join(' OR ')})`;
  return `from:${remitentes} newer_than:${dias}d`;
}

// Consulta de Gmail para mails que `remitente` le mandó a cualquiera de `destinatarios` (en Para o
// en CC) en los últimos `dias`. Sirve tanto en la casilla del remitente (sus enviados) como en la
// de alguien que estaba en copia. Las llaves {…} son un OR en la búsqueda de Gmail.
export function consultaEnviosA(remitente: string, destinatarios: readonly string[], dias: number): string | null {
  if (!remitente || destinatarios.length === 0) return null;
  const para = terminosEmpresa(destinatarios).map((m) => `to:${m} cc:${m}`).join(' ');
  return `from:${remitente} {${para}} newer_than:${dias}d`;
}

// Un mensaje de Gmail reducido a lo que necesita el sync (para poder testearlo sin GmailApp).
export interface MensajeSimple {
  de: string;
  para: string;
  cc: string;
  fecha: Date;
}

// Lista de direcciones o función que dice si una dirección cuenta (ej. "es de la empresa").
export type FiltroMails = readonly string[] | ((mail: string) => boolean);

function cumple(filtro: FiltroMails, mail: string): boolean {
  return typeof filtro === 'function' ? filtro(mail) : filtro.includes(mail);
}

// Fecha del mensaje más reciente cuyo remitente cumple `remitentes` y, si se pasan
// `destinatarios`, que tenga a alguno que los cumpla en Para o CC. null si no hay ninguno.
export function ultimaFecha(
  mensajes: readonly MensajeSimple[],
  remitentes: FiltroMails,
  destinatarios?: FiltroMails,
): Date | null {
  let ultima: Date | null = null;
  for (const m of mensajes) {
    if (!extraerMails(m.de).some((x) => cumple(remitentes, x))) continue;
    if (destinatarios && !extraerMails(`${m.para} ${m.cc}`).some((x) => cumple(destinatarios, x))) continue;
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

// Consulta de Gmail para mails a cualquiera de `destinatarios` (Para o CC) en los últimos `dias`.
// El sync después se queda con los que mandó alguien de Trama (nuestros mails a la empresa).
export function consultaMailsA(destinatarios: readonly string[], dias: number): string | null {
  if (destinatarios.length === 0) return null;
  const para = terminosEmpresa(destinatarios).map((m) => `to:${m} cc:${m}`).join(' ');
  return `{${para}} newer_than:${dias}d`;
}

// ¿Una respuesta de la empresa tiene que cambiar el estado? Solo si llegó después de nuestro último
// mail: si nosotros escribimos después, la última palabra es nuestra (y una respuesta vieja, por
// ejemplo al traspaso, no puede pasar un "Mail enviado" a "Mail respondido").
// Excepción: en "FR viejo mando el mail de traspaso" el mail anterior es del FR del año pasado
// (no está en _Usuarios), así que cualquier respuesta cuenta; si además el encargado ya contestó,
// el paso siguiente del sync lo pasa a "Mail enviado".
export function respuestaCambiaEstado(estado: Estado | undefined, respuesta: Date, ultimoNuestro: Date | null): boolean {
  if (estado === 'FR viejo mando el mail de traspaso') return true;
  return !ultimoNuestro || respuesta > ultimoNuestro;
}

// Direcciones de la empresa que aparecen (De, Para o CC) en `mensajes` y todavía no están en la
// celda Mail. Se agregan a la celda para no perder a la gente nueva que suma la empresa.
export function mailsNuevosDeLaEmpresa(
  mensajes: readonly MensajeSimple[],
  esDeLaEmpresa: (mail: string) => boolean,
  conocidos: readonly string[],
): string[] {
  const nuevos = new Set<string>();
  for (const m of mensajes) {
    for (const mail of extraerMails(`${m.de} ${m.para} ${m.cc}`)) {
      if (!conocidos.includes(mail) && esDeLaEmpresa(mail)) nuevos.add(mail);
    }
  }
  return Array.from(nuevos);
}
