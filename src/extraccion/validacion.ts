// Dueño: Persona A (sección 5, A4). Lógica pura — se testea sin Apps Script.

import { ESTADOS } from '../shared/constants';
import type { Estado, Extraccion, FilaCRM } from '../shared/types';
import type { RespuestaGemini } from './schema';

type TransicionValida = (desde: Estado | undefined, hacia: Estado) => boolean;

// ---------- Fechas de día (yyyy-mm-dd) en hora Argentina ----------

const ZONA = 'America/Buenos_Aires';

// Día (yyyy-mm-dd) en hora Argentina de un instante.
export function diaISO(fecha: Date): string {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(fecha);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return `${v('year')}-${v('month')}-${v('day')}`;
}

export function esFechaISO(texto: string | null | undefined): texto is string {
  if (!texto || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const [a, m, d] = texto.split('-').map(Number) as [number, number, number];
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

// Date de un día yyyy-mm-dd, a las 12:00 hora Argentina (así no se corre de día al pasar por UTC).
export function fechaDeDia(dia: string): Date {
  if (!esFechaISO(dia)) throw new Error(`Fecha inválida: "${dia}"`);
  return new Date(`${dia}T12:00:00-03:00`);
}

// ---------- Validaciones sueltas ----------

export function validarMail(mail: string | null): boolean {
  if (mail === null) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail);
}

// La fecha de próxima acción no puede ser anterior a la reunión. Se comparan días en hora Argentina
// (una próxima acción el mismo día de la reunión es válida).
export function validarFechaProximaAccion(fechaProximaAccion: string | null, fechaReunion: Date): boolean {
  if (fechaProximaAccion === null) return true;
  return esFechaISO(fechaProximaAccion) && fechaProximaAccion >= diaISO(fechaReunion);
}

// Un dato de contacto null del LLM no sobrescribe un valor existente. La próxima acción y su fecha
// NO se copian del CRM: la que había era de antes de esta reunión; si las notas no la dicen, queda
// vacía y marcada para que el FR la complete.
export function combinarConFilaExistente(extraccion: Extraccion, filaExistente: FilaCRM | null): Extraccion {
  if (!filaExistente) return extraccion;
  return {
    ...extraccion,
    persona: extraccion.persona ?? filaExistente.persona ?? null,
    rolPersona: extraccion.rolPersona ?? filaExistente.rolPersona ?? null,
    mail: extraccion.mail ?? filaExistente.mail ?? null,
    telefono: extraccion.telefono ?? filaExistente.telefono ?? null,
    linkedin: extraccion.linkedin ?? filaExistente.linkedin ?? null,
  };
}

// ---------- Estado preseleccionado en el paso 2 (decisión del grupo, 2026-11-22) ----------

// Opciones del desplegable de estado al cargar un post-reunión, en este orden.
export const ESTADOS_POST_REUNION: Estado[] = [
  'Reunión coordinada',
  'Tuvimos reunión, esperando respuesta',
  'Va a ser sponsor',
  'No va a ser sponsor',
  'Tratativas',
];

// Sugerencias de Gemini que se respetan. Cualquier otra cosa queda en "Reunión coordinada": el paso a
// "Tuvimos reunión, esperando respuesta" lo hace la sincronización con Gmail cuando el FR manda el mail
// de agradecimiento (no la app al confirmar, porque en ese momento el mail es solo un borrador).
const SUGERENCIAS_RESPETADAS: Estado[] = ['Tratativas', 'Va a ser sponsor', 'No va a ser sponsor'];
export const ESTADO_POR_DEFECTO: Estado = 'Reunión coordinada';

export function estadoPreseleccionado(sugerido: Estado): Estado {
  return SUGERENCIAS_RESPETADAS.includes(sugerido) ? sugerido : ESTADO_POR_DEFECTO;
}

export function transicionSugeridaValida(
  estadoSugerido: Estado,
  estadoActual: Estado | undefined,
  transicionValida: TransicionValida,
): boolean {
  return transicionValida(estadoActual, estadoSugerido);
}

// ---------- Esquema ----------

function textoONull(v: unknown, campo: string): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string') throw new Error(`"${campo}" tiene que ser texto o null`);
  return v.trim() === '' ? null : v.trim();
}

function listaDeTextos(v: unknown, campo: string): string[] {
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) throw new Error(`"${campo}" tiene que ser una lista de textos`);
  return (v as string[]).map((x) => x.trim()).filter((x) => x !== '');
}

// Verifica que la respuesta de Gemini cumpla el esquema (schema.ts).
export function parsearRespuestaGemini(texto: string): { ok: true; respuesta: RespuestaGemini } | { ok: false; error: string } {
  let o: Record<string, unknown>;
  try {
    const crudo: unknown = JSON.parse(texto);
    if (typeof crudo !== 'object' || crudo === null || Array.isArray(crudo)) return { ok: false, error: 'la respuesta no es un objeto JSON' };
    o = crudo as Record<string, unknown>;
  } catch {
    return { ok: false, error: 'la respuesta no es JSON válido' };
  }
  try {
    if (!ESTADOS.includes(o.estadoSugerido as Estado)) throw new Error(`"estadoSugerido" no es un estado válido`);
    if (typeof o.comentarios !== 'string') throw new Error('"comentarios" tiene que ser texto');
    return {
      ok: true,
      respuesta: {
        persona: textoONull(o.persona, 'persona'),
        rolPersona: textoONull(o.rolPersona, 'rolPersona'),
        mail: textoONull(o.mail, 'mail'),
        telefono: textoONull(o.telefono, 'telefono'),
        linkedin: textoONull(o.linkedin, 'linkedin'),
        compromisosEmpresa: listaDeTextos(o.compromisosEmpresa, 'compromisosEmpresa'),
        compromisosTrama: listaDeTextos(o.compromisosTrama, 'compromisosTrama'),
        parrafoCompromisos: textoONull(o.parrafoCompromisos, 'parrafoCompromisos'),
        estadoSugerido: o.estadoSugerido as Estado,
        comentarios: o.comentarios.trim(),
        proximoContactoConLaEmpresa: textoONull(o.proximoContactoConLaEmpresa, 'proximoContactoConLaEmpresa'),
        fechaProximoContacto: textoONull(o.fechaProximoContacto, 'fechaProximoContacto'),
        textoDeLaFecha: textoONull(o.textoDeLaFecha, 'textoDeLaFecha'),
        camposFaltantes: [...new Set(listaDeTextos(o.camposFaltantes, 'camposFaltantes'))],
      },
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---------- Fecha del próximo contacto: tiene que salir de las notas ----------

function normalizar(t: string): string {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[“”"«»'‘’]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s.,;:•*\-–]+|[\s.,;:•*\-–]+$/g, '');
}

// "10/12", "20-11", "5 de diciembre", "el jueves", "la semana que viene", "después del receso", etc.
const EXPRESION_DE_FECHA =
  /\d{1,2}\s*[/.-]\s*\d{1,2}|\b\d{1,2} de [a-z]+|\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|lunes|martes|miercoles|jueves|viernes|sabado|domingo|semana|quincena|mes|manana|receso|vacaciones|principios|mediados|fines|fin de)\b/;

// La fecha solo se acepta si Gemini citó de dónde la sacó, ese fragmento está literalmente en las
// notas y habla de una fecha. Una fecha inventada ("mañana", "el próximo día hábil") no tiene respaldo.
export function fechaRespaldadaPorLasNotas(textoDeLaFecha: string | null, notas: string): boolean {
  if (!textoDeLaFecha) return false;
  const fragmento = normalizar(textoDeLaFecha);
  return fragmento.length > 0 && normalizar(notas).includes(fragmento) && EXPRESION_DE_FECHA.test(fragmento);
}

const NOMBRES_GEMINI_A_EXTRACCION: Record<string, string> = {
  proximoContactoConLaEmpresa: 'proximaAccion',
  fechaProximoContacto: 'fechaProximaAccion',
};

// Convierte la respuesta de Gemini en la Extraccion del contrato (shared/types.ts).
export function aExtraccion(r: RespuestaGemini, notas: string): Extraccion {
  const { proximoContactoConLaEmpresa, fechaProximoContacto, textoDeLaFecha, ...resto } = r;
  const fecha = fechaProximoContacto && fechaRespaldadaPorLasNotas(textoDeLaFecha, notas) ? fechaProximoContacto : null;
  const faltantes = new Set(
    r.camposFaltantes.filter((c) => c !== 'textoDeLaFecha').map((c) => NOMBRES_GEMINI_A_EXTRACCION[c] ?? c),
  );
  if (!proximoContactoConLaEmpresa) faltantes.add('proximaAccion');
  if (!fecha) faltantes.add('fechaProximaAccion');
  return {
    ...resto,
    proximaAccion: proximoContactoConLaEmpresa,
    fechaProximaAccion: fecha,
    camposFaltantes: [...faltantes],
  };
}

export type ResultadoValidacion = { ok: true; extraccion: Extraccion } | { ok: false; error: string };

// Respuesta de Gemini → Extraccion (esquema + fecha respaldada por las notas).
export function parsearExtraccion(texto: string, notas: string): ResultadoValidacion {
  const r = parsearRespuestaGemini(texto);
  return r.ok ? { ok: true, extraccion: aExtraccion(r.respuesta, notas) } : r;
}

// ---------- Validación completa de una extracción (A4) ----------

export interface ContextoValidacion {
  filaExistente: FilaCRM | null;
  fechaReunion: Date;
  transicionValida: TransicionValida;
}

// Formato de mail y fecha, combinación con la fila existente y estado alcanzable.
// Lo que no pasa queda en camposFaltantes para que el FR lo revise en el paso 2.
export function validarExtraccion(entrada: Extraccion, ctx: ContextoValidacion): Extraccion {
  const faltantes = new Set(entrada.camposFaltantes);
  let e: Extraccion = { ...entrada };

  if (!validarMail(e.mail)) {
    e.mail = null;
    faltantes.add('mail');
  }
  if (!validarFechaProximaAccion(e.fechaProximaAccion, ctx.fechaReunion)) {
    e.fechaProximaAccion = null;
    faltantes.add('fechaProximaAccion');
  }

  e = combinarConFilaExistente(e, ctx.filaExistente);
  e.estadoSugerido = estadoPreseleccionado(e.estadoSugerido);

  if (!transicionSugeridaValida(e.estadoSugerido, ctx.filaExistente?.estado, ctx.transicionValida)) {
    faltantes.add('estadoSugerido'); // marcado para revisión
  }

  // Un campo que quedó con valor (por ejemplo, desde la fila existente) ya no falta.
  const valores = e as unknown as Record<string, unknown>;
  for (const campo of [...faltantes]) {
    if (campo !== 'estadoSugerido' && valores[campo] !== null && valores[campo] !== undefined) faltantes.delete(campo);
  }
  e.camposFaltantes = [...faltantes];
  return e;
}

// ---------- Validación al confirmar (paso 2) ----------

export function validarConfirmacion(
  datos: Extraccion,
  estadoActual: Estado | undefined,
  fechaReunion: Date,
  transicionValida: TransicionValida,
): string[] {
  const errores: string[] = [];
  if (!ESTADOS_POST_REUNION.includes(datos.estadoSugerido)) {
    errores.push(`"${datos.estadoSugerido}" no es un estado posible al cargar un post-reunión.`);
  } else if (!transicionValida(estadoActual, datos.estadoSugerido)) {
    errores.push(`No se puede pasar de "${estadoActual ?? 'empresa nueva'}" a "${datos.estadoSugerido}".`);
  }
  if (!datos.mail) errores.push('Falta el mail del contacto.');
  else if (!validarMail(datos.mail)) errores.push('El mail del contacto no es válido.');
  if (!validarFechaProximaAccion(datos.fechaProximaAccion, fechaReunion)) {
    errores.push('La fecha de próxima acción no es válida o es anterior a la reunión.');
  }
  return errores;
}
