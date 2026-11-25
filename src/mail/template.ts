// Dueño: Persona C (sección 7, C1). Reemplaza placeholders; si @COMPROMISOS es null, elimina el párrafo.
// Lógica pura (no depende de Apps Script): opera sobre el HTML que ya generó docToHtml.ts.

import { PLACEHOLDERS_TEMPLATE } from '../shared/constants';

export interface DatosTemplate {
  persona: string;
  nombreEmpresa: string;
  fechaReunion: string; // ya formateada (ver fechas.ts)
  compromisos: string | null;
}

const ENTIDADES_HTML: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };

function escaparHtml(texto: string): string {
  return texto.replace(/[&<>]/g, (c) => ENTIDADES_HTML[c] ?? c);
}

function reemplazarTodas(html: string, placeholder: string, valor: string): string {
  return html.split(placeholder).join(valor);
}

// Borra el <p>...</p> o <li>...</li> más chico que contiene el placeholder, entero,
// para no dejar un hueco cuando @COMPROMISOS es null (ver docToHtml.ts: siempre envuelve
// párrafos en <p> y viñetas en <li>).
function borrarBloqueConPlaceholder(html: string, placeholder: string): string {
  const patron = new RegExp(
    `<(p|li)[^>]*>(?:(?!</?(?:p|li)\\b)[\\s\\S])*?${placeholder}(?:(?!</?(?:p|li)\\b)[\\s\\S])*?</\\1>`,
    'i',
  );
  return html.replace(patron, '');
}

// Todos los placeholders que el template de un club tiene que tener (se valida contra el
// Doc antes de reemplazar, ver borrador.ts).
export function validarTemplate(html: string, nombreClub: string): void {
  const faltantes = Object.values(PLACEHOLDERS_TEMPLATE).filter((placeholder) => !html.includes(placeholder));
  if (faltantes.length > 0) {
    throw new Error(`El template de ${nombreClub} no tiene: ${faltantes.join(', ')}`);
  }
}

export function reemplazarPlaceholders(html: string, datos: DatosTemplate): string {
  let resultado =
    datos.compromisos === null
      ? borrarBloqueConPlaceholder(html, PLACEHOLDERS_TEMPLATE.COMPROMISOS)
      : reemplazarTodas(html, PLACEHOLDERS_TEMPLATE.COMPROMISOS, escaparHtml(datos.compromisos));

  resultado = reemplazarTodas(resultado, PLACEHOLDERS_TEMPLATE.PERSONA, escaparHtml(datos.persona));
  resultado = reemplazarTodas(resultado, PLACEHOLDERS_TEMPLATE.NOMBRE_EMPRESA, escaparHtml(datos.nombreEmpresa));
  resultado = reemplazarTodas(resultado, PLACEHOLDERS_TEMPLATE.FECHA_REUNION, escaparHtml(datos.fechaReunion));
  return resultado;
}

// ---------- A7: templates de pingueo ----------
// Mails más simples que el de post-reunión: no tienen fecha de reunión ni compromisos, así que
// solo exigen @NOMBRE EMPRESA. @PERSONA es opcional (si el template no lo usa, no pasa nada).
export interface DatosTemplatePingueo {
  persona: string;
  nombreEmpresa: string;
}

export function validarTemplatePingueo(html: string, nombreClub: string): void {
  if (!html.includes(PLACEHOLDERS_TEMPLATE.NOMBRE_EMPRESA)) {
    throw new Error(`El template de pingueo de ${nombreClub} no tiene: ${PLACEHOLDERS_TEMPLATE.NOMBRE_EMPRESA}`);
  }
}

export function reemplazarPlaceholdersPingueo(html: string, datos: DatosTemplatePingueo): string {
  let resultado = reemplazarTodas(html, PLACEHOLDERS_TEMPLATE.PERSONA, escaparHtml(datos.persona));
  resultado = reemplazarTodas(resultado, PLACEHOLDERS_TEMPLATE.NOMBRE_EMPRESA, escaparHtml(datos.nombreEmpresa));
  return resultado;
}
