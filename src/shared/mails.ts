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
