// La celda "Mail" del CRM (y el campo Mail del paso 2) puede tener varias direcciones separadas
// por coma, ";", "/", espacios o saltos de línea. Lógica pura, sin Apps Script.

const MAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const MAIL_SOLO_RE = /^[^\s@,;/]+@[^\s@,;/]+\.[^\s@,;/]+$/;

// Todas las direcciones del texto, en minúscula y sin repetir.
export function extraerMails(texto: string | null | undefined): string[] {
  if (!texto) return [];
  const encontrados = texto.match(MAIL_RE) ?? [];
  return Array.from(new Set(encontrados.map((m) => m.toLowerCase())));
}

// true si el texto es una lista de uno o más mails válidos (separados por coma, ";", "/" o
// espacios). null cuenta como válido (campo vacío).
export function validarListaMails(texto: string | null): boolean {
  if (texto === null) return true;
  const partes = texto.split(/[\s,;/]+/).filter(Boolean);
  return partes.length > 0 && partes.every((p) => MAIL_SOLO_RE.test(p));
}

// Lista limpia "a@x.com, b@y.com" con todas las direcciones de los textos, sin repetir, en orden.
// null si no hay ninguna.
export function unirMails(...textos: Array<string | null | undefined>): string | null {
  const todos = Array.from(new Set(textos.flatMap((t) => extraerMails(t))));
  return todos.length ? todos.join(', ') : null;
}

// Agrega a la celda existente los mails de `nuevos` que no estaban, sin tocar lo que ya había
// (aunque tenga texto que no es un mail, como "Contacto joaco").
export function agregarMails(celdaExistente: string | null | undefined, nuevos: string | null | undefined): string | null {
  const actuales = extraerMails(celdaExistente);
  const faltan = extraerMails(nuevos).filter((m) => !actuales.includes(m));
  const base = (celdaExistente ?? '').trim();
  if (!faltan.length) return base || null;
  return base ? `${base}, ${faltan.join(', ')}` : faltan.join(', ');
}

// Dominios que no identifican a una empresa: mails personales y el del ITBA (Trama).
export const DOMINIOS_GENERICOS: readonly string[] = [
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.com.ar', 'outlook.com', 'outlook.com.ar',
  'live.com', 'live.com.ar', 'yahoo.com', 'yahoo.com.ar', 'icloud.com', 'me.com', 'aol.com',
  'protonmail.com', 'proton.me', 'fibertel.com.ar', 'itba.edu.ar',
];

export function dominioDe(mail: string): string {
  return mail.split('@')[1]?.toLowerCase().trim() ?? '';
}

// Direcciones de sistemas automáticos (no son una persona de la empresa).
export function esMailAutomatico(mail: string): boolean {
  const usuario = mail.split('@')[0]?.toLowerCase() ?? '';
  return /^(no-?reply|do-?not-?reply|notifications?|notificaciones|mailer-daemon|postmaster|bounces?)([.+_-]|$)/.test(usuario);
}

// Dominios propios de la empresa a partir de sus mails (sin los genéricos), sin repetir.
export function dominiosEmpresa(mails: readonly string[]): string[] {
  return Array.from(new Set(mails.map(dominioDe).filter((d) => d && !DOMINIOS_GENERICOS.includes(d))));
}

// ¿Esta dirección es de la empresa? Sí si está en su celda Mail, o si es de su dominio propio y
// no es una dirección automática ni de Trama.
export function crearEsDeLaEmpresa(
  mailsEmpresa: readonly string[],
  excluir: readonly string[] = [],
): (mail: string) => boolean {
  const dominios = dominiosEmpresa(mailsEmpresa);
  return (mail: string) => {
    const m = mail.toLowerCase();
    if (mailsEmpresa.includes(m)) return true;
    if (excluir.includes(m) || esMailAutomatico(m)) return false;
    return dominios.includes(dominioDe(m));
  };
}
