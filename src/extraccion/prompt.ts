// Dueño: Persona A (sección 5, A3). Prompt de sistema para la extracción.

import type { Club, Estado, FilaCRM } from '../shared/types';
import type { RespuestaGemini } from './schema';
import { diaISO, fechaDeDia } from './validacion';

export interface ContextoExtraccion {
  club: Club;
  empresa: string;
  filaExistente: FilaCRM | null;
  fechaReunion: Date;
}

export interface ContenidoGemini {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export interface PromptGemini {
  sistema: string;
  contenidos: ContenidoGemini[];
}

// Estados posibles al confirmar un post-reunión (sección 3.5 del plan) y cuándo corresponde cada uno.
const ESTADOS_POST_REUNION: { estado: Estado; cuando: string }[] = [
  { estado: 'Tuvimos reunión, esperando respuesta', cuando: 'es el estado natural después de una primera reunión, o de una segunda reunión que quedó dudosa/sin definición: hubo interés pero la empresa todavía no se comprometió; quedó en responder o pensarlo.' },
  { estado: 'Tratativas', cuando: 'la empresa ya dijo que sí en principio (generalmente después de más de una reunión), pero ese sí depende de algo que nosotros le tenemos que mandar y ellos revisar o aprobar internamente (presupuesto, convenio, condiciones) — todavía no pagaron.' },
  { estado: 'Va a ser sponsor', cuando: 'la empresa confirmó explícitamente que va a ser sponsor.' },
  { estado: 'No va a ser sponsor', cuando: 'la empresa dijo explícitamente que no va a participar.' },
  { estado: 'Reunión coordinada', cuando: 'quedaron en tener otra reunión antes de avanzar.' },
];

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export const PROMPT_SISTEMA = `Sos un asistente del equipo de Fundraising de Trama ITBA, una organización estudiantil del ITBA (Argentina) con 5 clubes: Agro, Consultoría, Finanzas y Tecnología, Emprendedores y Trama Lab. Un FR (integrante de Fundraising) consigue empresas sponsors para los eventos de su club. Después de cada reunión con una empresa, el FR te pasa las notas que tomó Granola y vos extraés los datos de la reunión. Respondé solo con el JSON del esquema.

Reglas:
1. No inventes nada. Si un dato no está en las notas, va null y el nombre del campo se agrega a "camposFaltantes".
2. "persona" y "rolPersona" son de la persona de la empresa con la que se habló, no de los integrantes de Trama. Lo mismo para "mail", "telefono" y "linkedin".
3. Separá los compromisos: en "compromisosEmpresa" lo que prometió la empresa; en "compromisosTrama" lo que prometió Trama y también lo que la empresa nos pidió ("nos pidieron X").
4. "parrafoCompromisos": texto para el mail de agradecimiento, en primera persona del plural (nosotros = Trama), con el tono cordial del mail, de 1 a 3 oraciones. Si no hubo compromisos, null.
5. "comentarios": resumen de la reunión para la columna Comentarios del CRM. 2 a 4 oraciones, en tercera persona, sin saludos ni relleno. Cubrí con quién se habló, el nivel de interés de la empresa, qué se acordó y cualquier dato relevante para el próximo contacto (presupuesto, tiempos internos, quién decide).
6. "proximoContactoConLaEmpresa": el próximo contacto con la empresa después del mail de agradecimiento que el FR manda justo después de la reunión. Es lo que esperamos de la EMPRESA (su respuesta, una firma, que nos manden algo) o la próxima reunión con ellos, con el formato "Seguimiento con <persona>: <qué esperamos>". Las tareas de Trama (todo lo que en las notas diga "nosotros": mandar el PDB, el documento del evento, métricas, fotos, un reglamento) NUNCA van acá: van solo en "compromisosTrama".
   "fechaProximoContacto" (yyyy-mm-dd): la fecha que dicen las notas para ese contacto ("nos responden después del 10/12" → 10/12). Convertí las fechas relativas ("la semana que viene", "el jueves") a absolutas usando la fecha de la reunión.
   "textoDeLaFecha": el fragmento EXACTO de las notas, copiado letra por letra, de donde sacaste la fecha. Si las notas no dicen cuándo, "fechaProximoContacto" y "textoDeLaFecha" van null: nunca supongas una fecha ("mañana", "el próximo día hábil", "en una semana").
7. "estadoSugerido", según cómo terminó la reunión:
${ESTADOS_POST_REUNION.map((e) => `- "${e.estado}": ${e.cuando}`).join('\n')}
8. Si te paso la fila que la empresa ya tiene en el CRM, usala como contexto. Un dato de contacto que no aparece en las notas va null: el sistema no pisa con null lo que ya está cargado.`;

// TODO(A): ejemplos FICTICIOS (formato Granola). Reemplazarlos por notas de reuniones reales anonimizadas.
interface Ejemplo {
  club: Club;
  empresa: string;
  fechaReunion: string;
  fila: string | null;
  notas: string;
  salida: RespuestaGemini;
}

export const EJEMPLOS: Ejemplo[] = [
  {
    club: 'Agro',
    empresa: 'Semillas del Plata',
    fechaReunion: '2026-11-17',
    fila: null,
    notas: `Reunión Trama x Semillas del Plata
Participantes: Lucía Fernández (Gerenta de Marketing, Semillas del Plata), Tomás (Trama Agro)
- Lucía conoció Trama por el evento del año pasado
- Les interesa mucho el BootCamp Agro, sobre todo el desafío con casos reales
- Preguntaron por las categorías de sponsoreo y qué incluye cada una
- La decisión la toma con el director financiero, el presupuesto 2027 cierra la primera semana de diciembre
- Le mandamos el PDB actualizado con las categorías y casos de éxito, quedamos en mandarlo el jueves
- Ella lo presenta internamente y nos responde antes del 4/12
- Mail: lucia.fernandez@semillasdelplata.com.ar`,
    salida: {
      persona: 'Lucía Fernández',
      rolPersona: 'Gerenta de Marketing',
      mail: 'lucia.fernandez@semillasdelplata.com.ar',
      telefono: null,
      linkedin: null,
      compromisosEmpresa: ['Presentar la propuesta internamente y responder antes del 4/12'],
      compromisosTrama: ['Enviar el PDB actualizado con las categorías y casos de éxito el jueves 19/11'],
      parrafoCompromisos:
        'Como quedamos, el jueves te enviamos el Plan de Beneficios actualizado con las categorías y algunos casos de éxito, para que puedas presentarlo internamente antes del 4/12.',
      estadoSugerido: 'Tuvimos reunión, esperando respuesta',
      comentarios:
        'Reunión con Lucía Fernández (Gerenta de Marketing). Muy interesada en el BootCamp Agro, en especial en el desafío con casos reales. Decide junto al director financiero y el presupuesto 2027 cierra la primera semana de diciembre; responde antes del 4/12.',
      proximoContactoConLaEmpresa: 'Seguimiento con Lucía: respuesta sobre el sponsoreo del BootCamp Agro',
      fechaProximoContacto: '2026-12-04',
      textoDeLaFecha: 'nos responde antes del 4/12',
      camposFaltantes: ['telefono', 'linkedin'],
    },
  },
  {
    club: 'Finanzas y Tecnología',
    empresa: 'Banco Andino',
    fechaReunion: '2026-11-12',
    fila: 'Estado: Tuvimos reunión, esperando respuesta. Persona: Diego Ruiz. Mail: diego.ruiz@bancoandino.com.',
    notas: `Segunda reunión Banco Andino — Fintech Summit
Asistentes: Diego Ruiz (Relaciones Institucionales), Sofía y Martín (Trama FyT)
- Diego confirma que quieren ir con la categoría Gold para el Fintech Summit
- Legales tiene que revisar y firmar el convenio, dice que lo firman antes del viernes 20
- Nos pidió confirmar si puede haber un speaker del banco en el panel de pagos digitales`,
    salida: {
      persona: 'Diego Ruiz',
      rolPersona: 'Relaciones Institucionales',
      mail: null,
      telefono: null,
      linkedin: null,
      compromisosEmpresa: ['Firmar el convenio antes del viernes 20/11'],
      compromisosTrama: ['Confirmar si puede haber un speaker del banco en el panel de pagos digitales'],
      parrafoCompromisos:
        'Por nuestra parte, vamos a confirmarles si puede haber un speaker de Banco Andino en el panel de pagos digitales, y quedamos atentos al convenio firmado antes del viernes 20/11.',
      estadoSugerido: 'Tratativas',
      comentarios:
        'Segunda reunión con Diego Ruiz (Relaciones Institucionales). Quieren la categoría Gold para el Fintech Summit; Legales firma el convenio antes del 20/11. Pidieron un speaker del banco en el panel de pagos digitales.',
      proximoContactoConLaEmpresa: 'Seguimiento con Diego: convenio firmado por Legales',
      fechaProximoContacto: '2026-11-20',
      textoDeLaFecha: 'lo firman antes del viernes 20',
      camposFaltantes: ['mail', 'telefono', 'linkedin'],
    },
  },
  {
    club: 'Consultoría',
    empresa: 'Andes Consulting',
    fechaReunion: '2026-11-20',
    fila: null,
    notas: `Reunión Trama x Andes Consulting
Participantes: Valeria Sosa (HR Business Partner, Andes Consulting), Nico y Paula (Trama Consultoría)
- Valeria quiere sumar visibilidad con estudiantes de ingeniería industrial
- Le presentamos el Case Competition de Consultoría
- Nos pidió el reglamento de la competencia y fotos de la edición pasada
- Lo tiene que hablar con su equipo, nos avisa
- Mail: vsosa@andesconsulting.com`,
    salida: {
      persona: 'Valeria Sosa',
      rolPersona: 'HR Business Partner',
      mail: 'vsosa@andesconsulting.com',
      telefono: null,
      linkedin: null,
      compromisosEmpresa: ['Hablarlo con su equipo y avisarnos'],
      compromisosTrama: ['Enviar el reglamento de la competencia y fotos de la edición pasada'],
      parrafoCompromisos:
        'Como nos pediste, te compartimos el reglamento de la competencia y algunas fotos de la edición pasada. Quedamos atentos a lo que conversen con tu equipo.',
      estadoSugerido: 'Tuvimos reunión, esperando respuesta',
      comentarios:
        'Reunión con Valeria Sosa (HR Business Partner). Buscan visibilidad con estudiantes de ingeniería industrial y les interesó el Case Competition. Lo tiene que hablar con su equipo; no dio fecha de respuesta.',
      proximoContactoConLaEmpresa: 'Seguimiento con Valeria: respuesta después de hablarlo con su equipo',
      fechaProximoContacto: null,
      textoDeLaFecha: null,
      camposFaltantes: ['telefono', 'linkedin', 'fechaProximoContacto'],
    },
  },
];

function describirFila(f: FilaCRM | null): string | null {
  if (!f) return null;
  const partes = [`Estado: ${f.estado ?? 'sin estado'}.`];
  if (f.persona) partes.push(`Persona: ${f.persona}.`);
  if (f.rolPersona) partes.push(`Rol: ${f.rolPersona}.`);
  if (f.mail) partes.push(`Mail: ${f.mail}.`);
  if (f.telefono) partes.push(`Teléfono: ${f.telefono}.`);
  if (f.comentarios) partes.push(`Comentarios anteriores: ${f.comentarios}`);
  return partes.join(' ');
}

function mensaje(club: Club, empresa: string, fechaReunion: string, fila: string | null, notas: string): string {
  const dia = DIAS[fechaDeDia(fechaReunion).getUTCDay()];
  return `Club: ${club}
Empresa: ${empresa}
Fecha de la reunión: ${dia} ${fechaReunion}
Fila existente en el CRM: ${fila ?? 'ninguna (empresa nueva)'}

Notas de Granola:
"""
${notas}
"""`;
}

// Prompt completo: sistema + ejemplos (turnos user/model) + las notas. Si el intento anterior no cumplió
// el esquema, se agrega el error para que lo corrija (A4).
export function construirPrompt(notas: string, ctx: ContextoExtraccion, errorPrevio?: string): PromptGemini {
  const contenidos: ContenidoGemini[] = [];
  for (const ej of EJEMPLOS) {
    contenidos.push({ role: 'user', parts: [{ text: mensaje(ej.club, ej.empresa, ej.fechaReunion, ej.fila, ej.notas) }] });
    contenidos.push({ role: 'model', parts: [{ text: JSON.stringify(ej.salida) }] });
  }
  let final = mensaje(ctx.club, ctx.empresa, diaISO(ctx.fechaReunion), describirFila(ctx.filaExistente), notas);
  if (errorPrevio) final += `\n\nTu respuesta anterior no cumplía el esquema (${errorPrevio}). Respondé de nuevo cumpliéndolo.`;
  contenidos.push({ role: 'user', parts: [{ text: final }] });
  return { sistema: PROMPT_SISTEMA, contenidos };
}
