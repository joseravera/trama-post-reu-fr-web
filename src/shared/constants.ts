import type { Club, Estado } from './types';

// Único ID de spreadsheet que puede aparecer en el código (ver sección 3.3 del plan).
// Copia de 💸 Contactos '26-'27 💸 — el CRM real de Trama NO se toca.
export const SPREADSHEET_ID = '11T2Z17wZpostplko4ayov_qCxOk4gBwMcL6ZiC9B5rM';

export const CLUBES: Club[] = ['Agro', 'Consultoría', 'Finanzas y Tecnología', 'Emprendedores', 'Trama Lab'];

export const ESTADOS: Estado[] = [
  'Mail enviado',
  'Mail respondido',
  'Reunión coordinada',
  'Tuvimos reunión, esperando respuesta',
  'Tratativas',
  'Va a ser sponsor',
  'No va a ser sponsor',
];

export const ESTADOS_FINALES: Estado[] = ['Va a ser sponsor', 'No va a ser sponsor'];

// A7 (pingueo): estados en los que ya hubo reunión y se mandó el mail post-reunión, pero no
// respondió. Cualquier otro estado no final ('Mail enviado', 'Mail respondido', 'Reunión
// coordinada') es "primer contacto" todavía: solo se le mandó el mail inicial.
export const ESTADOS_PINGUEO_POST_REUNION: Estado[] = ['Tuvimos reunión, esperando respuesta', 'Tratativas'];

// Nombres de las columnas del CRM (hojas de club), en el orden de la sección 3.4.
// El acceso siempre es por nombre de encabezado, nunca por índice fijo.
export const COLUMNAS_CRM = {
  EMPRESA: 'Empresa',
  TRAMERO_ENCARGADO: 'Tramero encargado',
  PERSONA: 'Persona (de empresa)',
  ROL_PERSONA: 'Rol de la persona',
  TELEFONO: 'Teléfono',
  MAIL: 'Mail',
  LINKEDIN: 'LinkedIn contacto',
  ESTADO: 'Estado del contacto',
  COMENTARIOS: 'Comentarios',
  FECHA_PRIMER_CONTACTO: 'Fecha primer contacto',
  FECHA_ULTIMO_CONTACTO: 'Fecha último contacto',
  CANAL: 'Canal',
  PROXIMA_ACCION: 'Próxima acción',
  FECHA_PROXIMA_ACCION: 'Fecha próxima acción',
  PINGUEOS_SIN_RESPUESTA: 'Pingueos sin respuesta',
} as const;

// Hojas de sistema, dentro del mismo spreadsheet (prefijo `_`, ver sección 3.3).
export const HOJAS_SISTEMA = {
  USUARIOS: '_Usuarios',
  CLUBES: '_Clubes',
  PARAMETROS: '_Parametros',
  HISTORIAL: '_Historial',
  LOG_AVISOS: '_LogAvisos',
  SNAPSHOT: '_Snapshot',
} as const;

// Nombres de parámetros en la hoja _Parametros (sección 6, B1).
export const PARAMETROS = {
  DIAS_PINGUEO_MAIL: 'DIAS_PINGUEO_MAIL',
  DIAS_COORDINAR: 'DIAS_COORDINAR',
  HORAS_CARGA_POST: 'HORAS_CARGA_POST',
  DIAS_SEGUIMIENTO: 'DIAS_SEGUIMIENTO',
  DIAS_TRATATIVAS_FR: 'DIAS_TRATATIVAS_FR',
  DIAS_TRATATIVAS_ESCALA: 'DIAS_TRATATIVAS_ESCALA',
  PINGUEOS_ESCALA: 'PINGUEOS_ESCALA',
  DIAS_VENCIDO_ESCALA: 'DIAS_VENCIDO_ESCALA',
  DIAS_ENVIO_AGENDA: 'DIAS_ENVIO_AGENDA',
} as const;

// Placeholders del template de mail por club (sección 7, C1).
export const PLACEHOLDERS_TEMPLATE = {
  PERSONA: '@PERSONA',
  NOMBRE_EMPRESA: '@NOMBRE EMPRESA',
  FECHA_REUNION: '@FECHA_REUNION',
  COMPROMISOS: '@COMPROMISOS',
} as const;

// Asunto del borrador del mail a la empresa (sección 7, C3). ConfigService.getClub no expone
// un asunto por club, así que por ahora es el mismo formato para todos (usa el mismo
// placeholder de empresa que el template del cuerpo).
export const ASUNTO_BORRADOR_TEMPLATE = `Trama ITBA x ${PLACEHOLDERS_TEMPLATE.NOMBRE_EMPRESA} — Resumen de la reunión`;

// Asunto del borrador de pingueo (A7). Mismo formato simple para los dos templates.
export const ASUNTO_PINGUEO_TEMPLATE = `Trama ITBA x ${PLACEHOLDERS_TEMPLATE.NOMBRE_EMPRESA}`;

export const PREFIJO_ASUNTO_AVISOS = '[Trama FR]';
